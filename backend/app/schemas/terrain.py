"""Data contracts for terrain profile analysis endpoints."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.coordinates import SelenographicCoordinates
from app.schemas.disclosure import ScientificDisclosure


class TerrainProfileRequest(BaseModel):
    """Request payload for local terrain horizon profile calculation."""

    site: SelenographicCoordinates = Field(
        ...,
        description="Target lunar surface site coordinates in MOON_ME frame",
    )
    azimuth_step_deg: float = Field(
        default=2.0,
        ge=0.5,
        le=10.0,
        description="Angular spacing between azimuth rays in degrees",
    )
    max_distance_km: float = Field(
        default=50.0,
        ge=5.0,
        le=150.0,
        description="Maximum radial distance to scan for terrain obstacles in km",
    )


class TerrainProfileResponse(BaseModel):
    """Response payload containing 360-degree local horizon profile and site topography."""

    site: SelenographicCoordinates = Field(..., description="Target site coordinates evaluated")
    elevation_m: float = Field(..., description="Topographic elevation above reference sphere in meters")
    azimuths_deg: List[float] = Field(..., description="Array of azimuth samples in degrees [0, 360)")
    elevations_deg: List[float] = Field(..., description="Topographic horizon elevation angles in degrees")
    max_elevation_deg: float = Field(..., description="Highest horizon obstruction peak in degrees")
    min_elevation_deg: float = Field(..., description="Lowest horizon elevation in degrees")
    mean_elevation_deg: float = Field(..., description="Mean horizon elevation angle in degrees")
    is_fully_within_dem: bool = Field(..., description="Whether all evaluation rays remained inside DEM coverage")
    dem_coverage_status: str = Field(..., description="DEM coverage description (e.g. LOLA_POLAR_ACTIVE, SPHERICAL_DATUM)")
    disclosure: ScientificDisclosure = Field(..., description="Scientific provenance and fidelity disclosure")
