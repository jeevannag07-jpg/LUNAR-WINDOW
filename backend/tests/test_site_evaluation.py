"""Unit tests for multi-site operational opportunity comparison engine."""

from datetime import datetime, timezone
import pytest

from app.decision.site_evaluation import SiteEvaluationEngine
from app.schemas.coordinates import CoordinateFrame, SelenographicCoordinates
from app.schemas.site import CandidateSiteInput, SiteComparisonRequest
from app.services.mission_analysis import MissionAnalysisService


@pytest.mark.anyio
async def test_compare_two_candidate_sites():
    """Verify evaluation and ranking of two candidate sites across a mission window."""
    service = MissionAnalysisService()
    engine = SiteEvaluationEngine(analysis_service=service)

    site1 = CandidateSiteInput(
        site_id="SHACKLETON_RIDGE",
        name="Shackleton Connecting Ridge",
        coordinates=SelenographicCoordinates(
            latitude_deg=-89.44,
            longitude_deg=138.0,
            elevation_m=1100.0,
            frame=CoordinateFrame.MOON_ME,
        ),
    )

    site2 = CandidateSiteInput(
        site_id="SOUTH_POLE_POINT",
        name="Exact South Pole",
        coordinates=SelenographicCoordinates(
            latitude_deg=-90.0,
            longitude_deg=0.0,
            elevation_m=0.0,
            frame=CoordinateFrame.MOON_ME,
        ),
    )

    request = SiteComparisonRequest(
        sites=[site1, site2],
        start_time_utc=datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc),
        end_time_utc=datetime(2027, 1, 3, 0, 0, tzinfo=timezone.utc),  # 48 hours
        sampling_interval_minutes=120,
        require_terrain_occlusion=False,
    )

    response = await engine.compare_sites(request)

    assert response.duration_hours == 48.0
    assert len(response.sites) == 2
    assert response.sites[0].relative_rank == 1
    assert response.sites[1].relative_rank == 2
    assert response.highest_opportunity_site_id in ["SHACKLETON_RIDGE", "SOUTH_POLE_POINT"]
    assert len(response.comparison_notes) >= 3
    assert response.disclosure.disclaimer is not None
    assert response.disclosure.terrain_fidelity.value == "SPHERICAL_DATUM_ONLY"
    assert "Spherical Lunar Datum" in response.disclosure.ephemeris_source


@pytest.mark.anyio
async def test_compare_deterministic_tie_breaking():
    """Verify deterministic tie-breaking rules when candidate sites produce identical scores."""
    service = MissionAnalysisService()
    engine = SiteEvaluationEngine(analysis_service=service)

    # Identical coordinates producing identical scores
    site_b = CandidateSiteInput(
        site_id="SITE_B",
        name="Candidate Site B",
        coordinates=SelenographicCoordinates(
            latitude_deg=-89.0,
            longitude_deg=0.0,
            elevation_m=500.0,
            frame=CoordinateFrame.MOON_ME,
        ),
    )
    site_a = CandidateSiteInput(
        site_id="SITE_A",
        name="Candidate Site A",
        coordinates=SelenographicCoordinates(
            latitude_deg=-89.0,
            longitude_deg=0.0,
            elevation_m=500.0,
            frame=CoordinateFrame.MOON_ME,
        ),
    )

    # Pass in [SITE_B, SITE_A]
    request = SiteComparisonRequest(
        sites=[site_b, site_a],
        start_time_utc=datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc),
        end_time_utc=datetime(2027, 1, 2, 0, 0, tzinfo=timezone.utc),
        sampling_interval_minutes=120,
        require_terrain_occlusion=False,
    )

    response = await engine.compare_sites(request)

    assert len(response.sites) == 2
    # Equal score must break tie deterministically via site_id (SITE_A before SITE_B)
    assert response.sites[0].site_id == "SITE_A"
    assert response.sites[0].relative_rank == 1
    assert response.sites[1].site_id == "SITE_B"
    assert response.sites[1].relative_rank == 2
    # Verify tie disclosure in notes
    assert any("tie-breaking" in n.lower() for n in response.comparison_notes)


@pytest.mark.anyio
async def test_compare_configurable_weights_and_explanations():
    """Verify configurable weights, criterion contribution breakdown, and missing data disclosure."""
    service = MissionAnalysisService()
    engine = SiteEvaluationEngine(analysis_service=service)

    site = CandidateSiteInput(
        site_id="SHACKLETON_RIDGE",
        name="Shackleton Connecting Ridge",
        coordinates=SelenographicCoordinates(
            latitude_deg=-89.44,
            longitude_deg=138.0,
            elevation_m=1100.0,
            frame=CoordinateFrame.MOON_ME,
        ),
        assessment_radius_km=15.0,
    )

    from app.schemas.site import RankingWeights

    # Custom weights focusing 60% on Earth visibility and 40% on sunlight
    weights = RankingWeights(
        sunlight_weight=0.40,
        earth_los_weight=0.60,
        combined_opportunity_weight=0.0,
        terrain_slope_weight=0.0,
        data_completeness_weight=0.0,
    )

    request = SiteComparisonRequest(
        sites=[site],
        start_time_utc=datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc),
        end_time_utc=datetime(2027, 1, 2, 0, 0, tzinfo=timezone.utc),
        sampling_interval_minutes=120,
        require_terrain_occlusion=False,
        weights=weights,
    )

    response = await engine.compare_sites(request)
    m = response.sites[0]

    assert m.assessment_radius_km == 15.0
    assert "DATA_UNAVAILABLE" in m.terrain_hazard_status
    assert m.data_completeness_percentage < 100.0
    assert "PRELIMINARY_SCREENING_ONLY" in m.evidence_status
    assert "sunlight_visibility" in m.criterion_contributions
    assert "earth_line_of_sight" in m.criterion_contributions
    assert m.criterion_contributions["terrain_slope_suitability"] == 0.0
    assert len(m.score_explanation) >= 5
    assert any("DATA_UNAVAILABLE" in exp for exp in m.score_explanation)
