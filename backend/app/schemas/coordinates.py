"""Selenographic coordinate models and candidate lunar landing sites.

Provides physical coordinate validation for lunar surface positions within the
Mean Earth / Polar Axis (MOON_ME) reference frame.

Notice: External NASA JPL Horizons frame compatibility (e.g. MOON_PA vs MOON_ME)
is subject to explicit verification during Stage 3 integration. This schema
strictly operates within the internal MOON_ME datum standard.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class CoordinateFrame(str, Enum):
    """Supported internal coordinate reference frames for lunar surface sites.
    
    MOON_ME: Mean Earth / Polar Axis system (IAU standard).
             Origin at lunar center of mass, Z-axis along mean rotational axis,
             X-axis directed toward mean sub-Earth point at the lunar equator.
    """
    MOON_ME = "MOON_ME"


class SelenographicCoordinates(BaseModel):
    """Geodetically validated lunar surface coordinates.
    
    Attributes:
        latitude_deg: Selenographic latitude [-90.0, +90.0]. Negative indicates Southern Hemisphere.
        longitude_deg: Selenographic longitude [-180.0, +180.0]. East-positive convention.
        elevation_m: Height in meters above reference lunar datum sphere (mean radius 1737.4 km).
        frame: Reference frame standard (strictly internal MOON_ME).
    """

    latitude_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Selenographic latitude in decimal degrees [-90.0, +90.0]. South is negative.",
        examples=[-89.44],
    )
    longitude_deg: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Selenographic longitude in decimal degrees [-180.0, +180.0]. East is positive.",
        examples=[138.0],
    )
    elevation_m: float = Field(
        default=0.0,
        description="Elevation in meters relative to mean lunar radius (1737.4 km).",
        examples=[1100.0],
    )
    frame: CoordinateFrame = Field(
        default=CoordinateFrame.MOON_ME,
        description="Internal coordinate frame. External Horizons frame translation requires Stage 3 verification.",
    )

    @field_validator("latitude_deg")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        """Enforce physical latitude boundaries [-90, +90]."""
        if not -90.0 <= v <= 90.0:
            raise ValueError(f"Latitude must be between -90.0 and +90.0 degrees, got {v}")
        return round(float(v), 6)

    @field_validator("longitude_deg")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        """Enforce physical longitude boundaries [-180, +180]."""
        if not -180.0 <= v <= 180.0:
            raise ValueError(f"Longitude must be between -180.0 and +180.0 degrees, got {v}")
        return round(float(v), 6)


class LunarSite(BaseModel):
    """Pre-curated lunar surface site profile."""

    site_id: str = Field(..., description="Unique alphanumeric identifier")
    name: str = Field(..., description="Common or scientific feature name")
    coordinates: SelenographicCoordinates = Field(..., description="Surface coordinates")
    description: str = Field(..., description="Topographic and mission operational context")
    region: str = Field(..., description="Lunar regional sector (e.g. South Pole, Equatorial)")


# Reference Candidate Sites with published literature selenographic coordinates
CANDIDATE_LUNAR_SITES: List[LunarSite] = [
    LunarSite(
        site_id="shackleton_connecting_ridge",
        name="Shackleton Connecting Ridge",
        coordinates=SelenographicCoordinates(
            latitude_deg=-89.44,
            longitude_deg=138.0,
            elevation_m=1100.0,
            frame=CoordinateFrame.MOON_ME,
        ),
        description="High-elevation ridge connecting Shackleton and de Gerlache craters. Candidate for quasi-continuous illumination.",
        region="South Pole",
    ),
    LunarSite(
        site_id="malapert_mountain",
        name="Malapert Mountain (Peak M5)",
        coordinates=SelenographicCoordinates(
            latitude_deg=-85.99,
            longitude_deg=2.93,
            elevation_m=5000.0,
            frame=CoordinateFrame.MOON_ME,
        ),
        description="Prominent south-polar massif offering extended line-of-sight visibility toward Earth and prolonged sunlight.",
        region="South Pole",
    ),
    LunarSite(
        site_id="de_gerlache_rim_1",
        name="de Gerlache Rim 1",
        coordinates=SelenographicCoordinates(
            latitude_deg=-88.71,
            longitude_deg=-68.7,
            elevation_m=850.0,
            frame=CoordinateFrame.MOON_ME,
        ),
        description="Artemis candidate landing region featuring moderate slopes and adjacent permanently shadowed regions (PSRs).",
        region="South Pole",
    ),
    LunarSite(
        site_id="apollo_11_tranquility",
        name="Apollo 11 Tranquility Base",
        coordinates=SelenographicCoordinates(
            latitude_deg=0.67408,
            longitude_deg=23.47297,
            elevation_m=-2574.0,
            frame=CoordinateFrame.MOON_ME,
        ),
        description="Historical Apollo 11 equatorial landing site in Mare Tranquillitatis. Canonical benchmark for equatorial ephemerides.",
        region="Equatorial Mare",
    ),
]
