"""Data contracts and schemas for the Astronomy Engine time series.

Defines Pydantic v2 models representing topocentric observations of the Sun and Earth
from a lunar surface site, incorporating full scientific provenance and limitations.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class BodyTopocentricSample(BaseModel):
    """Topocentric horizontal coordinates and state of a celestial body as seen from a lunar site."""

    body_name: str = Field(..., description="Target body common name ('Sun' or 'Earth').")
    naif_id: int = Field(..., description="NAIF SPICE integer identifier (10 for Sun, 399 for Earth).")
    azimuth_deg: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Topocentric azimuth angle in degrees [0.0, 360.0), measured clockwise from True North.",
    )
    elevation_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Topocentric elevation angle in degrees [-90.0, +90.0] above local spherical horizon plane.",
    )
    distance_km: float = Field(
        ...,
        gt=0.0,
        description="Topocentric slant range in kilometers from observer site to body center of mass.",
    )
    enu_vector_km: List[float] = Field(
        ...,
        description="Topocentric relative position vector in local East-North-Up coordinates [East, North, Up] in km.",
    )
    cartesian_moon_me_km: List[float] = Field(
        ...,
        description="Moon-centered Cartesian position vector in the MOON_ME reference frame [X, Y, Z] in km.",
    )
    is_near_zenith: bool = Field(
        default=False,
        description="Flag indicating elevation is within 1e-6 rad of zenith/nadir where azimuth has a singularity.",
    )


class AstronomyEpochRecord(BaseModel):
    """Instantaneous topocentric astronomy observation record for a single epoch."""

    timestamp_utc: datetime = Field(
        ...,
        description="Observation epoch in ISO 8601 UTC.",
    )
    epoch_et_seconds: float = Field(
        ...,
        description="SPICE Ephemeris Time (ET/TDB) in seconds past J2000 epoch.",
    )
    julian_date: float = Field(
        ...,
        description="Julian Date on the TDB/ET scale.",
    )
    sun: BodyTopocentricSample = Field(
        ...,
        description="Topocentric observation parameters for the Sun.",
    )
    earth: BodyTopocentricSample = Field(
        ...,
        description="Topocentric observation parameters for the Earth.",
    )


class AstronomySiteMetadata(BaseModel):
    """Lunar surface observer site metadata."""

    latitude_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Selenographic latitude in decimal degrees [-90.0, +90.0]. South is negative.",
    )
    longitude_deg: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Selenographic longitude in decimal degrees [-180.0, +180.0]. East is positive.",
    )
    elevation_km: float = Field(
        default=0.0,
        description="Radial height in kilometers above reference lunar datum sphere (1737.4 km).",
    )
    cartesian_moon_me_km: List[float] = Field(
        ...,
        description="Observer site Moon-centered Cartesian coordinates in MOON_ME frame [X, Y, Z] in km.",
    )
    datum: str = Field(
        default="SPHERICAL_MEAN_RADIUS",
        description="Lunar geodetic reference datum.",
    )
    datum_radius_km: float = Field(
        default=1737.4,
        description="IAU standard mean lunar radius in kilometers.",
    )
    frame: str = Field(
        default="MOON_ME",
        description="Coordinate reference frame (Mean Earth / Polar Axis).",
    )


class AstronomyProvenanceMetadata(BaseModel):
    """Full scientific provenance, frame relationships, assumptions, and operational disclaimer."""

    horizons_source: str = Field(
        default="NASA JPL Horizons API (VECTORS ephemeris)",
        description="Source of inertial planetary state vectors.",
    )
    horizons_endpoint: str = Field(
        default="https://ssd.jpl.nasa.gov/api/horizons.api",
        description="Horizons API query endpoint.",
    )
    observer_center: str = Field(
        default="500@301 (Moon Center of Mass)",
        description="Horizons origin center code.",
    )
    reference_frame: str = Field(
        default="MOON_ME",
        description="Primary body-fixed rotating coordinate frame for lunar surface geometry.",
    )
    inertial_frame_source: str = Field(
        default="ICRF / J2000",
        description="Horizons inertial frame (ICRF aligned with J2000 to within < 0.05 arcsec per IERS conventions).",
    )
    vector_correction: str = Field(
        default="NONE (Geometric state vectors)",
        description="Horizons vector correction convention without light-time or stellar aberration.",
    )
    spice_kernels: List[str] = Field(
        default_factory=lambda: [
            "naif0012.tls (Leapseconds Kernel)",
            "moon_de440_250416.tf (Lunar Frame Kernel)",
            "moon_pa_de440_200625.bpc (Binary Lunar PCK)",
        ],
        description="Authoritative NAIF SPICE kernels used for time and orientation transformations.",
    )
    angular_units: str = Field(default="deg", description="Angular measurement unit.")
    distance_units: str = Field(default="km", description="Distance measurement unit.")
    time_scale: str = Field(
        default="UTC (ephemeris evaluated in TDB via SPICE dynamic leap-second modeling)",
        description="Time scale specification.",
    )
    assumptions: List[str] = Field(
        default_factory=lambda: [
            "Spherical lunar surface datum with uniform mean radius R_moon = 1737.4 km.",
            "Rigid body rotation and physical libration evaluated via DE440 binary PCK.",
            "ICRF and J2000 frame alignment treated as coincident within sub-milliarcsecond precision.",
            "Geometric line-of-sight evaluated from body center to site position without atmospheric/plasma refraction.",
        ],
        description="Explicit mathematical and physical assumptions underlying calculations.",
    )
    limitations: List[str] = Field(
        default_factory=lambda: [
            "Prototype spherical model does not include local topographic relief, crater rims, or DEM elevation.",
            "Positive elevation indicates body center is above the local spherical horizontal tangent plane only.",
            "Does NOT guarantee solar illumination over terrain or line-of-sight RF communications.",
            "Does NOT calculate solar disk partial eclipse or penumbral limb fractions.",
        ],
        description="Known physical and operational limitations.",
    )
    disclaimer: str = Field(
        default=(
            "LUNAR WINDOW is a mission-planning and site-evaluation decision-support tool. "
            "It is not certified for real-time autonomous flight, tactical landing hazard avoidance, "
            "or safety-critical operations."
        ),
        description="Legal and operational disclaimer.",
    )


class AstronomyTimeSeriesResult(BaseModel):
    """Complete, validated astronomy time-series result for a mission interval."""

    site: AstronomySiteMetadata = Field(
        ...,
        description="Observer lunar surface site parameters.",
    )
    provenance: AstronomyProvenanceMetadata = Field(
        default_factory=AstronomyProvenanceMetadata,
        description="Comprehensive scientific provenance, kernel identity, and disclosures.",
    )
    start_time_utc: datetime = Field(
        ...,
        description="Start epoch of the analysis interval in UTC.",
    )
    end_time_utc: datetime = Field(
        ...,
        description="End epoch of the analysis interval in UTC.",
    )
    sampling_interval_minutes: int = Field(
        ...,
        description="Sampling time step in minutes.",
    )
    sample_count: int = Field(
        ...,
        description="Total number of evaluated astronomical epoch samples.",
    )
    records: List[AstronomyEpochRecord] = Field(
        ...,
        description="Chronologically sorted list of topocentric astronomical records.",
    )
