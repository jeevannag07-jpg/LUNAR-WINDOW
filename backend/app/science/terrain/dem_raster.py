"""Memory-mapped access to LOLA polar Digital Elevation Model (DEM) rasters."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Final

import numpy as np

from app.science.terrain.models import (
    DEMPixelCoord,
    GeographicCoverageState,
    MeasurementSupportStatus,
    PDSLabelMetadata,
    SubRasterWindow,
    TerrainPatch,
    TerrainSampleResult,
)
from app.science.terrain.projection import (
    LAT_BOUNDARY_DEG,
    RHO_80S_M,
    latlon_to_pixel,
    pixel_to_latlon,
)


class DEMRasterReader:
    """Memory-mapped reader for 16-bit LOLA DEM binary rasters (<i2).

    Strictly complies with Stage 6 geodetic requirements:
    - Never loads full raster into memory (uses np.memmap).
    - Strictly checks array and polar stereographic boundaries.
    - Explicitly represents missing/invalid samples without heuristics.
    - Correctly distinguishes valid zero elevation (DN = 0) from missing data.
    """

    def __init__(
        self,
        raster_path: Path | str,
        metadata: PDSLabelMetadata,
        explicit_nodata_value: int | None = None,
    ) -> None:
        """Initialize the memory-mapped DEM reader.

        Args:
            raster_path: Path to the binary raster file (.IMG).
            metadata: Parsed authoritative PDSLabelMetadata.
            explicit_nodata_value: Optional user-supplied NoData sentinel value.
                If None, uses metadata.nodata_value. If neither is set, no sentinel
                is assumed (unresolved NoData policy).

        Raises:
            FileNotFoundError: If the raster file does not exist.
            ValueError: If file size does not match expected lines * samples * 2 bytes.
        """
        self.raster_path = Path(raster_path)
        if not self.raster_path.is_file():
            raise FileNotFoundError(f"DEM raster file not found: {self.raster_path}")

        self.metadata = metadata
        self.lines = metadata.lines
        self.line_samples = metadata.line_samples
        self.scaling_factor = metadata.scaling_factor
        self.offset_m = metadata.offset_m
        self.map_scale_m = metadata.map_scale_m_pix
        self.offset_0_based = metadata.sample_projection_offset

        # NoData sentinel resolution: never assume undocumented -32768
        self.nodata_value = (
            explicit_nodata_value
            if explicit_nodata_value is not None
            else metadata.nodata_value
        )

        expected_bytes = self.lines * self.line_samples * (metadata.sample_bits // 8)
        actual_bytes = self.raster_path.stat().st_size
        if actual_bytes != expected_bytes:
            raise ValueError(
                f"Raster file size mismatch for {self.raster_path.name}: "
                f"expected {expected_bytes} bytes ({self.lines}x{self.line_samples}x{metadata.sample_bits // 8}), "
                f"found {actual_bytes} bytes."
            )

        # Open raster in read-only memory-mapped mode with little-endian signed 16-bit integer
        self._mmap: np.memmap = np.memmap(
            self.raster_path,
            dtype="<i2",
            mode="r",
            shape=(self.lines, self.line_samples),
        )

    def close(self) -> None:
        """Close the underlying memory map."""
        if hasattr(self, "_mmap") and self._mmap is not None:
            # Explicitly delete reference to allow Windows file handle release
            del self._mmap

    def __enter__(self) -> DEMRasterReader:
        return self

    def __exit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        self.close()

    @property
    def has_documented_nodata(self) -> bool:
        """Whether a documented or explicit NoData sentinel is active."""
        return self.nodata_value is not None

    def is_valid_dn(self, dn: int | np.ndarray) -> bool | np.ndarray:
        """Determine whether raw DN represents a physically valid elevation sample.

        If a NoData sentinel is established, checks that dn != nodata_value.
        If no NoData sentinel is declared (as in LDEM_80S_20M.LBL), all raw samples
        are treated as valid measurements without guessing.
        """
        if self.nodata_value is None:
            if isinstance(dn, (int, np.integer)):
                return True
            return np.ones(dn.shape, dtype=bool)

        if isinstance(dn, (int, np.integer)):
            return dn != self.nodata_value
        return dn != self.nodata_value

    def dn_to_relative_elevation(self, dn: int | np.ndarray) -> float | np.ndarray:
        """Convert valid raw DN to relative elevation in meters above reference sphere: h = DN * scaling_factor."""
        return dn * self.scaling_factor

    def dn_to_planetary_radius(self, dn: int | np.ndarray) -> float | np.ndarray:
        """Convert valid raw DN to absolute planetary radius in meters: R = offset_m + (DN * scaling_factor)."""
        return self.offset_m + (dn * self.scaling_factor)

    def get_sample_at_pixel(
        self,
        col_0: float,
        row_0: float,
    ) -> TerrainSampleResult:
        """Query terrain elevation at continuous 0-based pixel coordinates.

        Sampling rule:
        - Checks physical outer footprint [-0.5, N - 0.5] and pixel center hull [0, N - 1].
        - Uses nearest-neighbor discrete indexing: int(floor(coord + 0.5)).
        - Clamps the exact outer footprint edge boundary at N - 0.5 to index N - 1.
        """
        # Continuous footprint and center boundary checks
        is_within_footprint = (-0.5 <= col_0 <= (self.line_samples - 0.5)) and (-0.5 <= row_0 <= (self.lines - 0.5))
        is_within_centers = (0.0 <= col_0 <= (self.line_samples - 1.0)) and (0.0 <= row_0 <= (self.lines - 1.0))

        # Nearest-neighbor cell index computation
        c_int = int(math.floor(col_0 + 0.5))
        r_int = int(math.floor(row_0 + 0.5))
        if c_int == self.line_samples and col_0 <= (self.line_samples - 0.5):
            c_int = self.line_samples - 1
        if r_int == self.lines and row_0 <= (self.lines - 0.5):
            r_int = self.lines - 1

        is_within_storage = (0 <= c_int < self.line_samples) and (0 <= r_int < self.lines)
        is_within_dem = is_within_footprint and is_within_storage

        lat_deg, lon_deg = pixel_to_latlon(
            col_0=col_0,
            row_0=row_0,
            map_scale_m=self.map_scale_m,
            offset_0_based=self.offset_0_based,
            r_body_m=self.offset_m,
        )

        pixel_coord = DEMPixelCoord(
            sample_1=col_0 + 1.0,
            line_1=row_0 + 1.0,
            col_0=col_0,
            row_0=row_0,
        )

        # Geographic domain checking against declared PDS bounds
        if not math.isfinite(lat_deg) or lat_deg > 0.0 or lat_deg < -90.0:
            geo_state = GeographicCoverageState.INVALID_COORDINATE
            is_within_declared = False
        elif (self.metadata.minimum_latitude_deg - 1e-7) <= lat_deg <= (self.metadata.maximum_latitude_deg + 1e-7):
            geo_state = GeographicCoverageState.WITHIN_DECLARED_DOMAIN
            is_within_declared = True
        else:
            geo_state = GeographicCoverageState.OUTSIDE_DECLARED_DOMAIN
            is_within_declared = False

        if not is_within_dem:
            return TerrainSampleResult(
                lat_deg=lat_deg,
                lon_deg=lon_deg,
                relative_elevation_m=None,
                planetary_radius_m=None,
                raw_dn=None,
                is_valid=False,
                is_within_dem=False,
                is_within_declared_coverage=is_within_declared,
                is_within_raster_storage=False,
                is_within_footprint=is_within_footprint,
                is_within_pixel_centers=is_within_centers,
                geographic_coverage_state=geo_state,
                measurement_support=MeasurementSupportStatus.UNKNOWN_UNTRACKED,
                pixel_coord=pixel_coord,
            )

        raw_dn = int(self._mmap[r_int, c_int])
        dn_valid = bool(self.is_valid_dn(raw_dn))

        # Scientific validity strictly requires: inside footprint AND within declared geographic coverage AND valid DN
        is_valid = is_within_declared and dn_valid

        if not is_valid:
            return TerrainSampleResult(
                lat_deg=lat_deg,
                lon_deg=lon_deg,
                relative_elevation_m=None,
                planetary_radius_m=None,
                raw_dn=raw_dn,
                is_valid=False,
                is_within_dem=True,
                is_within_declared_coverage=is_within_declared,
                is_within_raster_storage=is_within_storage,
                is_within_footprint=is_within_footprint,
                is_within_pixel_centers=is_within_centers,
                geographic_coverage_state=geo_state,
                measurement_support=MeasurementSupportStatus.UNKNOWN_UNTRACKED,
                pixel_coord=pixel_coord,
            )

        rel_elev = float(self.dn_to_relative_elevation(raw_dn))
        radius_m = float(self.dn_to_planetary_radius(raw_dn))

        return TerrainSampleResult(
            lat_deg=lat_deg,
            lon_deg=lon_deg,
            relative_elevation_m=rel_elev,
            planetary_radius_m=radius_m,
            raw_dn=raw_dn,
            is_valid=True,
            is_within_dem=True,
            is_within_declared_coverage=is_within_declared,
            is_within_raster_storage=is_within_storage,
            is_within_footprint=is_within_footprint,
            is_within_pixel_centers=is_within_centers,
            geographic_coverage_state=geo_state,
            measurement_support=MeasurementSupportStatus.UNKNOWN_UNTRACKED,
            pixel_coord=pixel_coord,
        )

    def get_sample_at_latlon(
        self,
        lat_deg: float,
        lon_deg: float,
    ) -> TerrainSampleResult:
        """Query terrain elevation at selenographic coordinates.

        Calculates continuous projected pixel coordinates and determines inclusion
        based on the actual physical raster footprint.
        """
        if not math.isfinite(lat_deg) or not math.isfinite(lon_deg) or lat_deg > 0.0 or lat_deg < -90.0:
            return TerrainSampleResult(
                lat_deg=lat_deg,
                lon_deg=lon_deg,
                relative_elevation_m=None,
                planetary_radius_m=None,
                raw_dn=None,
                is_valid=False,
                is_within_dem=False,
                is_within_declared_coverage=False,
                is_within_raster_storage=False,
                is_within_footprint=False,
                is_within_pixel_centers=False,
                geographic_coverage_state=GeographicCoverageState.INVALID_COORDINATE,
                measurement_support=MeasurementSupportStatus.UNKNOWN_UNTRACKED,
                pixel_coord=None,
            )

        pixel_coord = latlon_to_pixel(
            lat_deg=lat_deg,
            lon_deg=lon_deg,
            map_scale_m=self.map_scale_m,
            offset_0_based=self.offset_0_based,
            r_body_m=self.offset_m,
            validate_bounds=False,
        )

        return self.get_sample_at_pixel(
            col_0=pixel_coord.col_0,
            row_0=pixel_coord.row_0,
        )

    def extract_subraster_window(
        self,
        window: SubRasterWindow,
    ) -> np.ndarray:
        """Extract a 2D window of raw DN values using memory-mapped array slicing."""
        if window.col_min < 0 or window.col_max > self.line_samples:
            raise ValueError(f"Column bounds [{window.col_min}, {window.col_max}] outside raster [0, {self.line_samples}]")
        if window.row_min < 0 or window.row_max > self.lines:
            raise ValueError(f"Row bounds [{window.row_min}, {window.row_max}] outside raster [0, {self.lines}]")

        # Memory-mapped slice: reads only the requested bounding box from disk
        return np.array(self._mmap[window.row_min:window.row_max, window.col_min:window.col_max], copy=True)

    def extract_patch(
        self,
        center_lat_deg: float,
        center_lon_deg: float,
        radius_km: float,
    ) -> TerrainPatch:
        """Extract a square terrain patch centered on a mission site.

        Args:
            center_lat_deg: Site latitude in degrees [-90.0, -80.0].
            center_lon_deg: Site longitude in degrees [0.0, 360.0].
            radius_km: Radius of the bounding box in kilometers.

        Returns:
            TerrainPatch container with relative elevations in meters and valid mask.
        """
        center_px = latlon_to_pixel(
            lat_deg=center_lat_deg,
            lon_deg=center_lon_deg,
            map_scale_m=self.map_scale_m,
            offset_0_based=self.offset_0_based,
            r_body_m=self.offset_m,
        )

        radius_pix = int(math.ceil((radius_km * 1000.0) / self.map_scale_m))

        col_center = int(round(center_px.col_0))
        row_center = int(round(center_px.row_0))

        col_min = max(0, col_center - radius_pix)
        col_max = min(self.line_samples, col_center + radius_pix + 1)
        row_min = max(0, row_center - radius_pix)
        row_max = min(self.lines, row_center + radius_pix + 1)

        window = SubRasterWindow(
            col_min=col_min,
            col_max=col_max,
            row_min=row_min,
            row_max=row_max,
        )

        raw_sub = self.extract_subraster_window(window)
        valid_mask = self.is_valid_dn(raw_sub)

        # Convert to relative elevation in meters; assign NaN to invalid pixels
        elevation_data = np.full(raw_sub.shape, np.nan, dtype=np.float32)
        elevation_data[valid_mask] = self.dn_to_relative_elevation(raw_sub[valid_mask])

        return TerrainPatch(
            center_lat_deg=center_lat_deg,
            center_lon_deg=center_lon_deg,
            radius_km=radius_km,
            window=window,
            elevation_data_m=elevation_data,
            valid_mask=valid_mask,
        )
