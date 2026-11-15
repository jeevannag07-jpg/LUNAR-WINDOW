"""Data models for lunar terrain elevation, PDS metadata, and polar projections."""

from __future__ import annotations

from enum import Enum
from typing import Any
import numpy as np
from pydantic import BaseModel, ConfigDict, Field, field_validator


class DEMCoverageState(str, Enum):
    """Categorical state of DEM coverage for an evaluation."""
    FULLY_WITHIN_DEM = "FULLY_WITHIN_DEM"
    BOUNDARY_TRUNCATED = "BOUNDARY_TRUNCATED"
    OUT_OF_BOUNDS_SITE = "OUT_OF_BOUNDS_SITE"


class DataCompletenessState(str, Enum):
    """Categorical state of data completeness along evaluated paths."""
    COMPLETE_DATA = "COMPLETE_DATA"
    CONTAINS_MISSING_DATA = "CONTAINS_MISSING_DATA"


class ComputationState(str, Enum):
    """Categorical state of execution completeness."""
    COMPLETED_TO_MAX_RADIUS = "COMPLETED_TO_MAX_RADIUS"
    HALTED_EARLY_DUE_TO_ERROR = "HALTED_EARLY_DUE_TO_ERROR"


class GeographicCoverageState(str, Enum):
    """Categorical state of geographic coverage relative to product declaration."""
    WITHIN_DECLARED_DOMAIN = "WITHIN_DECLARED_DOMAIN"       # Latitude is within declared product bounds (e.g. [-90.0, -80.0])
    OUTSIDE_DECLARED_DOMAIN = "OUTSIDE_DECLARED_DOMAIN"     # Latitude is outside declared domain (e.g. > -80.0 in raster corners)
    INVALID_COORDINATE = "INVALID_COORDINATE"               # Non-finite or non-physical latitude


class MeasurementSupportStatus(str, Enum):
    """Status of observational measurement support for an elevation sample."""
    UNKNOWN_UNTRACKED = "UNKNOWN_UNTRACKED"   # Source product does not bundle track count or error planes
    DIRECT_OBSERVATION = "DIRECT_OBSERVATION" # Confirmed direct laser altimeter return in cell
    INTERPOLATED_FILL = "INTERPOLATED_FILL"   # Identified interpolated fill cell without direct track support


class DirectionalVisibilityStatus(str, Enum):
    """Directional line-of-sight status along a specific azimuth ray."""
    VISIBLE = "VISIBLE"
    OCCULTED = "OCCULTED"
    UNRESOLVED_BOUNDARY = "UNRESOLVED_BOUNDARY"
    UNRESOLVED_MISSING_DATA = "UNRESOLVED_MISSING_DATA"


class PDSLabelMetadata(BaseModel):
    """Authoritative metadata parsed from a PDS3 label file (.LBL).

    Conforms strictly to NASA PDS3 standards and LOLA Gridded Data Record specifications.
    Preserves exact original values extracted from the label.
    """
    model_config = ConfigDict(frozen=True)

    product_id: str = Field(..., description="PDS product identifier, e.g. LDEM_80S_20M")
    map_projection_type: str = Field(..., description="Map projection type (POLAR STEREOGRAPHIC)")
    coordinate_system_name: str = Field(..., description="Reference coordinate system name")
    coordinate_system_type: str = Field(
        default="BODY-FIXED ROTATING",
        description="Coordinate system type"
    )
    a_axis_radius_km: float = Field(..., gt=0.0, description="Semi-major axis radius in km")
    b_axis_radius_km: float = Field(..., gt=0.0, description="Semi-minor axis radius in km")
    c_axis_radius_km: float = Field(..., gt=0.0, description="Polar axis radius in km")
    center_latitude_deg: float = Field(..., description="Center projection latitude in degrees")
    center_longitude_deg: float = Field(..., description="Center projection longitude in degrees")
    maximum_latitude_deg: float = Field(..., description="Maximum latitude coverage in degrees")
    minimum_latitude_deg: float = Field(..., description="Minimum latitude coverage in degrees")
    map_resolution_pix_deg: float = Field(..., gt=0.0, description="Map resolution in pixels per degree")
    map_scale_m_pix: float = Field(..., gt=0.0, description="Map scale in meters per pixel")
    lines: int = Field(..., ge=1, description="Number of raster lines (rows)")
    line_samples: int = Field(..., ge=1, description="Number of raster samples (columns)")
    line_projection_offset: float = Field(..., description="0-based line projection offset from PDS label")
    sample_projection_offset: float = Field(..., description="0-based sample projection offset from PDS label")
    sample_type: str = Field(..., description="Sample binary encoding (e.g. LSB_INTEGER)")
    sample_bits: int = Field(..., ge=8, description="Bits per sample (e.g. 16)")
    unit: str = Field(default="METER", description="Elevation physical unit")
    scaling_factor: float = Field(..., gt=0.0, description="Elevation scaling factor in meters/DN")
    offset_m: float = Field(..., gt=0.0, description="Planetary reference radius in meters")
    derived_minimum: int | None = Field(default=None, description="Informational derived minimum DN in label (not a validity threshold)")
    derived_maximum: int | None = Field(default=None, description="Informational derived maximum DN in label (not a validity threshold)")
    nodata_value: int | None = Field(default=None, description="Explicit NoData sentinel value if documented, otherwise None (unresolved)")

    @property
    def has_documented_nodata(self) -> bool:
        """Whether the label or product explicitly documents a NoData sentinel value."""
        return self.nodata_value is not None


class PolarStereoCoord(BaseModel):
    """Planar South Polar Stereographic projection coordinates in meters."""
    model_config = ConfigDict(frozen=True)

    x_m: float = Field(..., description="Projected Eastward X coordinate in meters")
    y_m: float = Field(..., description="Projected Earthward Y coordinate in meters")
    rho_m: float = Field(..., ge=0.0, description="Radial distance from pole in meters")

    @property
    def x_km(self) -> float:
        return self.x_m / 1000.0

    @property
    def y_km(self) -> float:
        return self.y_m / 1000.0

    @property
    def rho_km(self) -> float:
        return self.rho_m / 1000.0


class DEMPixelCoord(BaseModel):
    """Pixel coordinates in a LOLA polar DEM raster.

    Distinguishes 1-based Fortran/PDS coordinates (I, J) from 0-based NumPy/C indices (col_0, row_0).
    """
    model_config = ConfigDict(frozen=True)

    sample_1: float = Field(..., description="1-based continuous PDS sample (column) index")
    line_1: float = Field(..., description="1-based continuous PDS line (row) index")
    col_0: float = Field(..., description="0-based continuous array column index")
    row_0: float = Field(..., description="0-based continuous array row index")

    @field_validator("col_0", mode="before")
    @classmethod
    def set_col_0(cls, v: Any, info: Any) -> float:
        if v is not None:
            return float(v)
        sample = info.data.get("sample_1")
        return float(sample) - 1.0 if sample is not None else 0.0

    @field_validator("row_0", mode="before")
    @classmethod
    def set_row_0(cls, v: Any, info: Any) -> float:
        if v is not None:
            return float(v)
        line = info.data.get("line_1")
        return float(line) - 1.0 if line is not None else 0.0


class SubRasterWindow(BaseModel):
    """Integer bounding box for windowed sub-raster slicing."""
    model_config = ConfigDict(frozen=True)

    col_min: int = Field(..., ge=0, description="Minimum 0-based column index (inclusive)")
    col_max: int = Field(..., ge=0, description="Maximum 0-based column index (exclusive)")
    row_min: int = Field(..., ge=0, description="Minimum 0-based row index (inclusive)")
    row_max: int = Field(..., ge=0, description="Maximum 0-based row index (exclusive)")

    @property
    def width(self) -> int:
        return self.col_max - self.col_min

    @property
    def height(self) -> int:
        return self.row_max - self.row_min


class DirectionalRayResult(BaseModel):
    """Result of ray traversal along a specific azimuth direction."""
    model_config = ConfigDict(frozen=True)

    azimuth_deg: float = Field(..., ge=0.0, lt=360.0, description="Ray azimuth in degrees [0, 360)")
    horizon_elevation_deg: float | None = Field(
        None,
        description="Maximum observed horizon elevation angle in degrees, or None if unresolved"
    )
    distance_evaluated_km: float = Field(..., ge=0.0, description="Surface distance evaluated in km")
    is_boundary_truncated: bool = Field(default=False, description="Whether ray intersected DEM boundary")
    has_missing_data: bool = Field(default=False, description="Whether ray intersected unmapped data cells")
    directional_status: DirectionalVisibilityStatus = Field(
        ...,
        description="Definitive status of this directional ray"
    )


class TerrainSampleResult(BaseModel):
    """Result of sampling elevation at a specific selenographic coordinate.

    Explicitly separates binary storage, pixel footprint, pixel center hull,
    declared geographic coverage, and measurement support.
    """
    model_config = ConfigDict(frozen=True)

    lat_deg: float = Field(..., description="Selenographic latitude in degrees")
    lon_deg: float = Field(..., description="Selenographic longitude in degrees")
    relative_elevation_m: float | None = Field(
        None,
        description="Topographic elevation relative to reference radius in meters"
    )
    planetary_radius_m: float | None = Field(
        None,
        description="Absolute planetary radius from lunar center in meters"
    )
    raw_dn: int | None = Field(None, description="Raw integer digital number (DN) from raster")
    is_valid: bool = Field(
        ...,
        description="Whether the sample is scientifically valid (within declared coverage, inside footprint, non-null)"
    )
    is_within_dem: bool = Field(..., description="Whether the coordinate falls within the DEM boundaries (alias for is_within_footprint)")
    is_within_declared_coverage: bool = Field(
        default=True,
        description="Whether the coordinate falls within the declared geographic coverage [-90.0, -80.0]"
    )
    is_within_raster_storage: bool = Field(
        default=True,
        description="Whether discrete cell index falls within binary array [0, lines-1] x [0, samples-1]"
    )
    is_within_footprint: bool = Field(
        default=True,
        description="Whether continuous coordinate falls within physical raster footprint [-0.5, N-0.5]"
    )
    is_within_pixel_centers: bool = Field(
        default=True,
        description="Whether continuous coordinate falls within convex hull of pixel centers [0, N-1]"
    )
    geographic_coverage_state: GeographicCoverageState = Field(
        default=GeographicCoverageState.WITHIN_DECLARED_DOMAIN,
        description="Status of coordinate relative to declared geographic product domain"
    )
    measurement_support: MeasurementSupportStatus = Field(
        default=MeasurementSupportStatus.UNKNOWN_UNTRACKED,
        description="Status of observational measurement support (untracked in standalone DEM)"
    )
    pixel_coord: DEMPixelCoord | None = Field(None, description="Continuous raster pixel coordinates")


class TerrainPatch(BaseModel):
    """Extracted local DEM terrain patch around a mission site."""
    model_config = ConfigDict(arbitrary_types_allowed=True, frozen=True)

    center_lat_deg: float = Field(..., ge=-90.0, le=-80.0, description="Site selenographic latitude")
    center_lon_deg: float = Field(..., ge=0.0, le=360.0, description="Site selenographic longitude")
    radius_km: float = Field(..., gt=0.0, description="Patch radius from site in km")
    window: SubRasterWindow = Field(..., description="Sub-raster bounding box coordinates")
    elevation_data_m: np.ndarray = Field(..., description="2D float array of relative elevations in meters")
    valid_mask: np.ndarray = Field(..., description="2D boolean array of valid non-null pixels")

    @property
    def min_elevation_m(self) -> float:
        valid_data = self.elevation_data_m[self.valid_mask]
        if valid_data.size == 0:
            return float("nan")
        return float(np.min(valid_data))

    @property
    def max_elevation_m(self) -> float:
        valid_data = self.elevation_data_m[self.valid_mask]
        if valid_data.size == 0:
            return float("nan")
        return float(np.max(valid_data))


class HorizonProfile(BaseModel):
    """Complete 360-degree local terrain horizon elevation profile for a lunar site."""
    model_config = ConfigDict(frozen=True)

    site_lat_deg: float = Field(..., description="Site selenographic latitude in degrees")
    site_lon_deg: float = Field(..., description="Site selenographic longitude in degrees")
    site_elevation_m: float = Field(default=0.0, description="Site observer elevation above reference sphere in meters")
    azimuths_deg: list[float] = Field(..., description="Array of azimuth samples in degrees [0, 360)")
    elevations_deg: list[float] = Field(..., description="Apparent horizon elevation angles relative to local horizontal in degrees")
    max_elevation_deg: float = Field(..., description="Maximum horizon elevation peak in degrees")
    min_elevation_deg: float = Field(..., description="Minimum horizon elevation dip in degrees")
    mean_elevation_deg: float = Field(..., description="Mean horizon elevation in degrees")
    is_fully_within_dem: bool = Field(default=True, description="Whether all evaluation rays remained within DEM coverage")
    has_missing_data: bool = Field(default=False, description="Whether missing data or voids were encountered")

    def get_elevation_at_azimuth(self, azimuth_deg: float) -> float:
        """Interpolate horizon elevation at any arbitrary topocentric azimuth in [0, 360) deg."""
        az = azimuth_deg % 360.0
        if not self.azimuths_deg or not self.elevations_deg:
            return 0.0
        if len(self.azimuths_deg) == 1:
            return self.elevations_deg[0]
        xp = np.array(self.azimuths_deg, dtype=float)
        yp = np.array(self.elevations_deg, dtype=float)
        sort_idx = np.argsort(xp)
        xp = xp[sort_idx]
        yp = yp[sort_idx]
        if xp[-1] < 360.0:
            xp = np.append(xp, 360.0)
            yp = np.append(yp, yp[0])
        return float(np.interp(az, xp, yp, period=360.0))


class RayObstructionResult(BaseModel):
    """Evaluation result for line-of-sight obstruction by terrain along a directional ray."""
    model_config = ConfigDict(frozen=True)

    azimuth_deg: float = Field(..., ge=0.0, lt=360.0, description="Ray topocentric azimuth in degrees")
    elevation_deg: float = Field(..., ge=-90.0, le=90.0, description="Ray topocentric elevation in degrees")
    is_obstructed: bool = Field(..., description="True if ray is blocked by lunar terrain")
    horizon_elevation_deg: float = Field(..., description="Local terrain horizon elevation at this azimuth in degrees")
    obstruction_distance_m: float | None = Field(default=None, description="Distance to blocking terrain in meters, if obstructed")
    obstruction_elevation_m: float | None = Field(default=None, description="Elevation of blocking terrain in meters, if obstructed")
    ray_altitude_at_obstruction_m: float | None = Field(default=None, description="Ray altitude at obstruction in meters, if obstructed")
    directional_status: DirectionalVisibilityStatus = Field(
        default=DirectionalVisibilityStatus.VISIBLE,
        description="Detailed directional visibility status"
    )
