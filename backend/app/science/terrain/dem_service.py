"""DEM service manager for accessing polar elevation data and generating horizon profiles."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from app.science.terrain.dem_raster import DEMRasterReader
from app.science.terrain.horizon import generate_horizon_profile
from app.science.terrain.models import (
    HorizonProfile,
    RayObstructionResult,
    TerrainSampleResult,
)
from app.science.terrain.pds_label_parser import PDSLabelParser
from app.science.terrain.ray_traversal import evaluate_ray_obstruction

logger = logging.getLogger(__name__)


class DEMService:
    """Manages LOLA DEM raster lifecycle, elevation sampling, and horizon profile calculations."""

    def __init__(
        self,
        raster_path: Optional[Path | str] = None,
        label_path: Optional[Path | str] = None,
    ) -> None:
        """Initialize DEMService.

        If raster_path and label_path point to existing files, initializes DEMRasterReader.
        Otherwise operates in fallback mode (spherical datum).
        """
        self.raster_path = Path(raster_path) if raster_path else None
        self.label_path = Path(label_path) if label_path else None
        self.reader: Optional[DEMRasterReader] = None
        self._initialize_reader()

    def _initialize_reader(self) -> None:
        """Attempt to load DEM raster using PDS label metadata."""
        if not self.raster_path or not self.label_path:
            logger.info("DEM raster or label path not configured; operating in SPHERICAL_DATUM mode.")
            return

        if not self.raster_path.is_file() or not self.label_path.is_file():
            logger.info(
                "DEM files not present at configured paths (%s, %s); operating in SPHERICAL_DATUM mode.",
                self.raster_path,
                self.label_path,
            )
            return

        try:
            metadata = PDSLabelParser.parse_file(self.label_path)
            self.reader = DEMRasterReader(self.raster_path, metadata)
            logger.info("Successfully initialized LOLA DEMRasterReader from %s", self.raster_path)
        except Exception as e:
            logger.warning("Failed to initialize DEMRasterReader: %s. Using SPHERICAL_DATUM mode.", e)
            self.reader = None

    @property
    def is_available(self) -> bool:
        """Whether active DEM raster data is available."""
        return self.reader is not None

    def close(self) -> None:
        """Close reader memory map if open."""
        if self.reader is not None:
            self.reader.close()
            self.reader = None

    def sample_elevation(
        self,
        lat_deg: float,
        lon_deg: float,
    ) -> Optional[TerrainSampleResult]:
        """Sample terrain elevation at selenographic coordinates.

        Returns None if DEM is unavailable.
        """
        if self.reader is None:
            return None
        return self.reader.get_sample_at_latlon(lat_deg, lon_deg)

    def get_horizon_profile(
        self,
        site_lat_deg: float,
        site_lon_deg: float,
        site_elevation_m: float = 0.0,
        azimuth_step_deg: float = 2.0,
        max_distance_m: float = 50000.0,
    ) -> HorizonProfile:
        """Generate 360-degree topocentric horizon profile around a site."""
        return generate_horizon_profile(
            site_lat_deg=site_lat_deg,
            site_lon_deg=site_lon_deg,
            site_elevation_m=site_elevation_m,
            dem_reader=self.reader,
            azimuth_step_deg=azimuth_step_deg,
            max_distance_m=max_distance_m,
        )

    def evaluate_ray(
        self,
        site_lat_deg: float,
        site_lon_deg: float,
        site_elevation_m: float,
        azimuth_deg: float,
        elevation_deg: float,
        max_distance_m: float = 50000.0,
    ) -> RayObstructionResult:
        """Evaluate line-of-sight obstruction along a directional ray."""
        return evaluate_ray_obstruction(
            site_lat_deg=site_lat_deg,
            site_lon_deg=site_lon_deg,
            site_elevation_m=site_elevation_m,
            azimuth_deg=azimuth_deg,
            elevation_deg=elevation_deg,
            dem_reader=self.reader,
            max_distance_m=max_distance_m,
        )
