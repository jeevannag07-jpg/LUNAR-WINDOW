"""Mission visibility request and response data contracts.

Enforces strict input validation (timezone awareness, duration limits, sampling bounds)
and structured response schemas for ephemeris samples, terrain-aware visibility,
operational windows, and scientific disclosure.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.coordinates import SelenographicCoordinates
from app.schemas.disclosure import ScientificDisclosure


class SolarElevationReference(str, Enum):
    """Solar limb reference for geometric visibility evaluation."""

    CENTER_OF_DISK = "CENTER_OF_DISK"
    UPPER_LIMB = "UPPER_LIMB"


class WindowType(str, Enum):
    """Classification of contiguous operational intervals."""

    SUNLIGHT = "SUNLIGHT"
    DARKNESS = "DARKNESS"
    EARTH_LINE_OF_SIGHT = "EARTH_LINE_OF_SIGHT"
    EARTH_OCCULTED = "EARTH_OCCULTED"
    COMBINED_OPPORTUNITY = "COMBINED_OPPORTUNITY"  # Simultaneous Sunlight + Earth Line-of-Sight


class MissionVisibilityRequest(BaseModel):
    """Request payload for lunar surface mission visibility analysis."""

    site: SelenographicCoordinates = Field(
        ...,
        description="Target lunar surface site coordinates in the MOON_ME frame.",
    )
    start_time_utc: datetime = Field(
        ...,
        description="Start epoch (must be timezone-aware; non-UTC offsets are normalized to UTC).",
        examples=["2027-01-01T00:00:00Z"],
    )
    end_time_utc: datetime = Field(
        ...,
        description="End epoch (must be timezone-aware; non-UTC offsets are normalized to UTC).",
        examples=["2027-01-14T00:00:00Z"],
    )
    sampling_interval_minutes: int = Field(
        default=60,
        ge=1,
        le=1440,
        description="Sampling interval in minutes [1, 1440] (1 min to 24 hours).",
    )
    min_solar_elevation_deg: float = Field(
        default=0.0,
        ge=-10.0,
        le=45.0,
        description="Minimum solar elevation angle required above horizon for illumination [deg].",
    )
    solar_elevation_reference: SolarElevationReference = Field(
        default=SolarElevationReference.CENTER_OF_DISK,
        description="Reference point on solar disk (Center or Upper Limb) used for visibility cutoff.",
    )
    min_earth_elevation_deg: float = Field(
        default=0.0,
        ge=-10.0,
        le=45.0,
        description="Minimum Earth center elevation required above local horizon for geometric line-of-sight [deg].",
    )
    include_timeline: bool = Field(
        default=False,
        description="Whether to include discrete per-step ephemeris samples in the response.",
    )
    require_terrain_occlusion: bool = Field(
        default=False,
        description="Require LOLA terrain horizon mask evaluation (when available in Stage 8).",
    )

    @field_validator("start_time_utc", "end_time_utc")
    @classmethod
    def validate_and_normalize_datetime(cls, v: datetime) -> datetime:
        """Reject naive datetimes and normalize timezone-aware datetimes to UTC."""
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            raise ValueError(
                "Timestamp must be timezone-aware (e.g. ISO 8601 with trailing 'Z' or '+00:00'). "
                "Naive timestamps are strictly rejected."
            )
        return v.astimezone(timezone.utc)

    @model_validator(mode="after")
    def validate_time_window(self) -> "MissionVisibilityRequest":
        """Validate chronological ordering and maximum duration constraints."""
        if self.end_time_utc <= self.start_time_utc:
            raise ValueError("end_time_utc must be strictly later than start_time_utc.")

        total_seconds = (self.end_time_utc - self.start_time_utc).total_seconds()
        max_seconds = 180 * 86400  # Exact 180 days limit

        if total_seconds > max_seconds:
            days = total_seconds / 86400.0
            raise ValueError(
                f"Evaluation time span cannot exceed 180 days (requested span: {days:.2f} days)."
            )
        return self


class EphemerisSample(BaseModel):
    """Discrete temporal epoch containing Sun and Earth topocentric positions and visibility."""

    timestamp_utc: datetime = Field(
        ...,
        description="Epoch in ISO 8601 UTC.",
    )
    # Solar geometry
    sun_azimuth_deg: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Topocentric solar azimuth [0, 360) deg (0 = North, 90 = East).",
    )
    sun_center_elevation_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Geometric center elevation of the Sun relative to local horizon [-90, +90] deg.",
    )
    sun_upper_limb_elevation_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Upper limb elevation of the solar disk (center elevation + solar radius ~0.267 deg).",
    )
    solar_disk_illumination_fraction: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Fraction of the solar disk area visible above the local horizon [0.0 to 1.0].",
    )
    is_sun_visible: bool = Field(
        ...,
        description="True if solar elevation meets or exceeds the requested cutoff threshold.",
    )
    # Earth geometry
    earth_azimuth_deg: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Topocentric Earth center azimuth [0, 360) deg.",
    )
    earth_center_elevation_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Earth center elevation relative to local horizon [-90, +90] deg.",
    )
    is_earth_line_of_sight: bool = Field(
        ...,
        description=(
            "True if Earth center clears the elevation threshold. "
            "Notice: Geometric line-of-sight does NOT equate to a guaranteed communication link."
        ),
    )
    # Terrain context
    terrain_horizon_elevation_deg: Optional[float] = Field(
        default=None,
        description="Local topographic horizon elevation at solar azimuth (when LOLA active).",
    )


class OperationalWindow(BaseModel):
    """Contiguous interval of uniform operational conditions."""

    window_type: WindowType = Field(
        ...,
        description="Type of operational state during this window.",
    )
    start_time_utc: datetime = Field(
        ...,
        description="Start epoch of the contiguous window (ISO 8601 UTC).",
    )
    end_time_utc: datetime = Field(
        ...,
        description="End epoch of the contiguous window (ISO 8601 UTC).",
    )
    duration_hours: float = Field(
        ...,
        ge=0.0,
        description="Duration of the window in decimal hours.",
    )
    peak_solar_elevation_deg: Optional[float] = Field(
        default=None,
        description="Maximum solar elevation angle attained during sunlight window.",
    )
    mean_solar_elevation_deg: Optional[float] = Field(
        default=None,
        description="Mean solar elevation angle across the sunlight window.",
    )
    min_earth_elevation_deg: Optional[float] = Field(
        default=None,
        description="Minimum Earth elevation angle encountered during line-of-sight window.",
    )


class MissionSummary(BaseModel):
    """Cumulative operational metrics across the evaluated mission epoch."""

    total_duration_hours: float = Field(..., ge=0.0)
    total_sunlight_hours: float = Field(..., ge=0.0)
    sunlight_percentage: float = Field(..., ge=0.0, le=100.0)
    total_earth_line_of_sight_hours: float = Field(..., ge=0.0)
    earth_line_of_sight_percentage: float = Field(..., ge=0.0, le=100.0)
    combined_opportunity_hours: float = Field(
        ...,
        ge=0.0,
        description="Simultaneous sunlight and Earth line-of-sight hours.",
    )
    combined_opportunity_percentage: float = Field(..., ge=0.0, le=100.0)
    longest_continuous_sunlight_hours: float = Field(..., ge=0.0)
    longest_continuous_darkness_hours: float = Field(..., ge=0.0)


class MissionVisibilityResponse(BaseModel):
    """Complete mission visibility analysis and operational decision payload."""

    site: SelenographicCoordinates = Field(
        ...,
        description="Evaluated lunar surface site coordinates.",
    )
    start_time_utc: datetime = Field(..., description="Start epoch evaluated.")
    end_time_utc: datetime = Field(..., description="End epoch evaluated.")
    sampling_interval_minutes: int = Field(..., description="Sampling interval in minutes.")
    summary: MissionSummary = Field(..., description="Cumulative mission operational metrics.")
    windows: List[OperationalWindow] = Field(
        ...,
        description="List of segmented contiguous operational windows.",
    )
    timeline: Optional[List[EphemerisSample]] = Field(
        default=None,
        description="Time series of discrete ephemeris samples (included if requested).",
    )
    disclosure: ScientificDisclosure = Field(
        ...,
        description="Mandatory scientific provenance, assumptions, and limitations metadata.",
    )
