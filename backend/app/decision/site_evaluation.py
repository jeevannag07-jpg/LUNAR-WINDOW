"""Multi-site operational opportunity evaluation and decision support engine."""

from __future__ import annotations

import logging
from typing import List, Optional

from app.schemas.disclosure import (
    DataProvenance,
    DataQualityStatus,
    ScientificDisclosure,
    TerrainFidelity,
)
from app.schemas.mission import MissionVisibilityRequest, SolarElevationReference
from app.schemas.site import (
    CandidateSiteInput,
    SiteComparisonRequest,
    SiteComparisonResponse,
    SiteEvaluationMetric,
)
from app.services.mission_analysis import MissionAnalysisService

logger = logging.getLogger(__name__)


class SiteEvaluationEngine:
    """Evaluates and compares candidate lunar surface landing and exploration sites."""

    def __init__(
        self,
        analysis_service: Optional[MissionAnalysisService] = None,
    ) -> None:
        """Initialize SiteEvaluationEngine with MissionAnalysisService."""
        self.analysis_service = analysis_service or MissionAnalysisService()

    async def compare_sites(
        self,
        request: SiteComparisonRequest,
    ) -> SiteComparisonResponse:
        """Evaluate and rank candidate lunar sites across a mission evaluation epoch.

        Args:
            request: Validated SiteComparisonRequest payload.

        Returns:
            Ranked SiteComparisonResponse payload with operational metrics and disclosure.
        """
        metrics_list: List[SiteEvaluationMetric] = []

        total_duration_hours = (request.end_time_utc - request.start_time_utc).total_seconds() / 3600.0

        weights = request.weights
        w_sun = weights.sunlight_weight if weights else 0.40
        w_earth = weights.earth_los_weight if weights else 0.35
        w_comb = weights.combined_opportunity_weight if weights else 0.25
        w_slope = weights.terrain_slope_weight if weights else 0.0

        for site_input in request.sites:
            # 1. Run visibility analysis for this candidate site
            vis_req = MissionVisibilityRequest(
                site=site_input.coordinates,
                start_time_utc=request.start_time_utc,
                end_time_utc=request.end_time_utc,
                sampling_interval_minutes=request.sampling_interval_minutes,
                min_solar_elevation_deg=request.min_solar_elevation_deg,
                solar_elevation_reference=SolarElevationReference.CENTER_OF_DISK,
                min_earth_elevation_deg=request.min_earth_elevation_deg,
                include_timeline=False,
                require_terrain_occlusion=request.require_terrain_occlusion,
            )

            vis_resp = await self.analysis_service.evaluate_visibility(vis_req)
            summary = vis_resp.summary

            # 2. Query terrain horizon stats
            is_polar = site_input.coordinates.latitude_deg <= -80.0
            dem_status = "LOLA_POLAR_ACTIVE" if (is_polar and self.analysis_service.dem_service.is_available) else "SPHERICAL_DATUM"

            horizon = self.analysis_service.dem_service.get_horizon_profile(
                site_lat_deg=site_input.coordinates.latitude_deg,
                site_lon_deg=site_input.coordinates.longitude_deg,
                site_elevation_m=vis_resp.site.elevation_m or 0.0,
            )

            # 3. Compute geometric opportunity indicator
            sun_contrib = round(w_sun * summary.sunlight_percentage, 2)
            earth_contrib = round(w_earth * summary.earth_line_of_sight_percentage, 2)
            comb_contrib = round(w_comb * summary.combined_opportunity_percentage, 2)
            obstruction_penalty = round(min(15.0, max(0.0, horizon.mean_elevation_deg * 2.0)), 2)

            raw_score = sun_contrib + earth_contrib + comb_contrib - obstruction_penalty
            score = round(max(0.0, min(100.0, raw_score)), 2)

            criterion_contribs = {
                "sunlight_visibility": sun_contrib,
                "earth_line_of_sight": earth_contrib,
                "combined_sun_earth_opportunity": comb_contrib,
                "terrain_obstruction_penalty": -obstruction_penalty,
                "terrain_slope_suitability": 0.0,  # Missing LOLA raster: never grant artificial favorable points
                "surface_roughness": 0.0,  # Missing micro-roughness raster: unmodeled
                "boulder_hazard": 0.0,  # Missing NAC hazard maps: unmodeled
            }

            explanation = [
                f"Sunlight contribution: +{sun_contrib:.1f} pts ({summary.sunlight_percentage:.1f}% illumination * {w_sun:.2f} weight)",
                f"Earth LoS contribution: +{earth_contrib:.1f} pts ({summary.earth_line_of_sight_percentage:.1f}% line-of-sight * {w_earth:.2f} weight)",
                f"Combined opportunity contribution: +{comb_contrib:.1f} pts ({summary.combined_opportunity_percentage:.1f}% simultaneous window * {w_comb:.2f} weight)",
                f"Horizon obstruction adjustment: -{obstruction_penalty:.1f} pts (mean horizon {horizon.mean_elevation_deg:.2f}°)",
                "Slope & roughness criteria: 0.0 pts (DATA_UNAVAILABLE - LDEM_80S_20M binary raster absent)",
                "Preliminary screening index only: Does NOT indicate spacecraft landing safety or landing success probability",
            ]

            metrics_list.append(
                SiteEvaluationMetric(
                    site_id=site_input.site_id,
                    name=site_input.name,
                    latitude_deg=site_input.coordinates.latitude_deg,
                    longitude_deg=site_input.coordinates.longitude_deg,
                    assessment_radius_km=site_input.assessment_radius_km,
                    elevation_m=vis_resp.site.elevation_m or 0.0,
                    max_horizon_elevation_deg=round(horizon.max_elevation_deg, 2),
                    mean_horizon_elevation_deg=round(horizon.mean_elevation_deg, 2),
                    sunlight_percentage=round(summary.sunlight_percentage, 2),
                    longest_continuous_sunlight_hours=round(summary.longest_continuous_sunlight_hours, 2),
                    longest_continuous_darkness_hours=round(summary.longest_continuous_darkness_hours, 2),
                    earth_line_of_sight_percentage=round(summary.earth_line_of_sight_percentage, 2),
                    combined_opportunity_percentage=round(summary.combined_opportunity_percentage, 2),
                    dem_coverage_status=dem_status,
                    terrain_hazard_status="DATA_UNAVAILABLE (LDEM_80S_20M binary raster absent - spherical fallback active)",
                    data_completeness_percentage=57.1,  # 4/7 modeled criteria
                    evidence_status="PRELIMINARY_SCREENING_ONLY - INCOMPLETE_EVIDENCE",
                    composite_opportunity_score=score,
                    relative_rank=1,  # Populated after sorting
                    criterion_contributions=criterion_contribs,
                    score_explanation=explanation,
                )
            )

        # Deterministic multi-tier ranking:
        # 1. Composite opportunity score (descending)
        # 2. Combined opportunity percentage (descending)
        # 3. Sunlight percentage (descending)
        # 4. Mean horizon elevation (ascending - lower obstruction preferred)
        # 5. Site ID (ascending lexicographical order for strict determinism)
        metrics_list.sort(
            key=lambda m: (
                -m.composite_opportunity_score,
                -m.combined_opportunity_percentage,
                -m.sunlight_percentage,
                m.mean_horizon_elevation_deg,
                m.site_id,
            )
        )

        tied_scores: dict[float, int] = {}
        for m in metrics_list:
            tied_scores[m.composite_opportunity_score] = tied_scores.get(m.composite_opportunity_score, 0) + 1

        for rank, m in enumerate(metrics_list, start=1):
            m.relative_rank = rank

        highest_site_id = metrics_list[0].site_id if metrics_list else "NONE"

        notes = [
            f"Evaluated {len(metrics_list)} candidate sites across {total_duration_hours:.1f} hours.",
            f"Top-ranked site: '{metrics_list[0].name}' (Score: {metrics_list[0].composite_opportunity_score}/100).",
            "Composite opportunity score combines sunlight opportunity (40%), Earth visibility (35%), and simultaneous opportunity (25%), with terrain obstruction adjustment.",
            "Notice: Scores represent geometric opportunity only; local terrain slope hazards, surface trafficability, and landing safety are unmodeled.",
        ]

        if any(count > 1 for count in tied_scores.values()):
            notes.append(
                "Deterministic tie-breaking applied for equal composite opportunity scores: "
                "ranked by (1) combined opportunity %, (2) sunlight %, (3) lowest horizon obstruction, and (4) site ID."
            )

        is_dem_active = bool(request.require_terrain_occlusion and self.analysis_service.dem_service.is_available)

        disclosure = ScientificDisclosure(
            provenance=DataProvenance.REAL_NASA_JPL_HORIZONS,
            ephemeris_source=(
                "NASA JPL Horizons DE440 + LOLA Polar Topography (LDEM_80S_20M)"
                if is_dem_active
                else "NASA JPL Horizons DE440 + Spherical Lunar Datum (R0 = 1,737,400.0 m)"
            ),
            coordinate_frame="MOON_ME (IAU Mean Earth / Polar Axis)",
            terrain_fidelity=(
                TerrainFidelity.LOLA_TOPOGRAPHIC_HORIZON
                if is_dem_active
                else TerrainFidelity.SPHERICAL_DATUM_ONLY
            ),
            data_quality_status=DataQualityStatus.VERIFIED,
            assumptions=[
                "Topocentric astronomy evaluated via DE440 ephemeris and local ENU frames.",
                (
                    "Sunlight and Earth line-of-sight evaluated against LOLA 20m/px topographic horizon mask."
                    if is_dem_active
                    else "Topographic horizon evaluated against spherical lunar datum (R0 = 1,737,400.0 m) due to absent binary LOLA DEM raster file."
                ),
            ],
            limitations=[
                "Site comparison does not assess spacecraft descent safety, touchdown hazards, or geotechnical surface properties.",
                "Evaluations apply strictly to the requested mission epoch.",
            ],
        )

        return SiteComparisonResponse(
            start_time_utc=request.start_time_utc,
            end_time_utc=request.end_time_utc,
            duration_hours=total_duration_hours,
            sites=metrics_list,
            highest_opportunity_site_id=highest_site_id,
            comparison_notes=notes,
            disclosure=disclosure,
        )
