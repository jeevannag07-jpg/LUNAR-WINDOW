"""Data contracts for lunar surface site evaluation and multi-site comparison."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.coordinates import SelenographicCoordinates
from app.schemas.disclosure import ScientificDisclosure


class RankingWeights(BaseModel):
    """Configurable weights for transparent candidate landing-site scoring."""

    sunlight_weight: float = Field(default=0.40, ge=0.0, le=1.0, description="Weight for sunlight visibility percentage")
    earth_los_weight: float = Field(default=0.35, ge=0.0, le=1.0, description="Weight for Earth direct line-of-sight percentage")
    combined_opportunity_weight: float = Field(default=0.25, ge=0.0, le=1.0, description="Weight for simultaneous Sun + Earth line-of-sight")
    terrain_slope_weight: float = Field(default=0.0, ge=0.0, le=1.0, description="Weight for slope suitability (0.0 when LOLA raster unavailable)")
    data_completeness_weight: float = Field(default=0.0, ge=0.0, le=1.0, description="Weight for data completeness verification")


class CandidateSiteInput(BaseModel):
    """Input specification for a candidate lunar mission site."""

    site_id: str = Field(..., description="Unique alphanumeric identifier for the site", examples=["SHACKLETON_RIM"])
    name: str = Field(..., description="Human-readable site name", examples=["Shackleton Crater Connecting Ridge"])
    coordinates: SelenographicCoordinates = Field(..., description="Target site coordinates in MOON_ME frame")
    assessment_radius_km: float = Field(default=10.0, ge=0.1, le=100.0, description="Circular assessment region radius in kilometers")
    description: Optional[str] = Field(default=None, description="Optional geological or mission description")


class SiteEvaluationMetric(BaseModel):
    """Evaluated operational and topographic metrics for a single lunar site."""

    site_id: str = Field(..., description="Unique site identifier")
    name: str = Field(..., description="Site display name")
    latitude_deg: float = Field(..., description="Selenographic latitude in degrees")
    longitude_deg: float = Field(..., description="Selenographic longitude in degrees")
    assessment_radius_km: float = Field(default=10.0, ge=0.1, le=100.0, description="Assessment region radius in kilometers")
    elevation_m: float = Field(..., description="Topographic elevation above reference sphere in meters")
    max_horizon_elevation_deg: float = Field(..., description="Maximum local horizon obstruction peak in degrees")
    mean_horizon_elevation_deg: float = Field(..., description="Mean horizon elevation angle in degrees")
    sunlight_percentage: float = Field(..., ge=0.0, le=100.0, description="Percentage of evaluation epoch in sunlight")
    longest_continuous_sunlight_hours: float = Field(..., ge=0.0, description="Longest continuous sunlight window in hours")
    longest_continuous_darkness_hours: float = Field(..., ge=0.0, description="Longest continuous darkness window in hours")
    earth_line_of_sight_percentage: float = Field(..., ge=0.0, le=100.0, description="Percentage of epoch with Earth geometric line-of-sight")
    combined_opportunity_percentage: float = Field(..., ge=0.0, le=100.0, description="Percentage of epoch with simultaneous Sun + Earth line-of-sight")
    dem_coverage_status: str = Field(..., description="DEM coverage classification status")
    terrain_hazard_status: str = Field(default="DATA_UNAVAILABLE - LDEM_80S_20M binary raster absent", description="Hazard status for slope/roughness")
    data_completeness_percentage: float = Field(default=57.1, ge=0.0, le=100.0, description="Percentage of required scientific criteria with verified data")
    evidence_status: str = Field(default="PRELIMINARY_SCREENING_ONLY - INCOMPLETE_EVIDENCE", description="Evidence completeness classification")
    composite_opportunity_score: float = Field(..., ge=0.0, le=100.0, description="Indicative geometric opportunity score [0, 100]")
    relative_rank: int = Field(..., ge=1, description="Relative ranking among evaluated sites (1 = highest opportunity)")
    criterion_contributions: dict[str, float] = Field(default_factory=dict, description="Numerical contribution of each criterion to composite score")
    score_explanation: list[str] = Field(default_factory=list, description="Transparent line-by-line explanation of score derivation")


class SiteComparisonRequest(BaseModel):
    """Request payload for multi-site operational opportunity comparison."""

    sites: List[CandidateSiteInput] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of candidate lunar sites to compare",
    )
    start_time_utc: datetime = Field(..., description="Start of evaluation window (ISO 8601 UTC)")
    end_time_utc: datetime = Field(..., description="End of evaluation window (ISO 8601 UTC)")
    sampling_interval_minutes: int = Field(
        default=60,
        ge=1,
        le=1440,
        description="Temporal sampling interval in minutes",
    )
    min_solar_elevation_deg: float = Field(default=0.0, ge=-10.0, le=45.0)
    min_earth_elevation_deg: float = Field(default=0.0, ge=-10.0, le=45.0)
    require_terrain_occlusion: bool = Field(default=True, description="Whether to evaluate LOLA topographic horizon")
    weights: Optional[RankingWeights] = Field(default=None, description="Optional custom evaluation weights")


class SiteComparisonResponse(BaseModel):
    """Response payload for multi-site operational opportunity comparison."""

    start_time_utc: datetime = Field(..., description="Evaluation window start epoch")
    end_time_utc: datetime = Field(..., description="Evaluation window end epoch")
    duration_hours: float = Field(..., ge=0.0, description="Total duration of evaluation epoch in hours")
    sites: List[SiteEvaluationMetric] = Field(..., description="Ranked list of evaluated candidate sites")
    highest_opportunity_site_id: str = Field(..., description="Site ID attaining highest composite opportunity score")
    comparison_notes: List[str] = Field(..., description="Operational insights and comparative observations")
    disclosure: ScientificDisclosure = Field(..., description="Mandatory scientific provenance and safety disclaimer")
