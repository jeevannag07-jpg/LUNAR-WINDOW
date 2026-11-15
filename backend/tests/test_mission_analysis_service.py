"""Unit tests for the MissionAnalysisService orchestration layer."""

from datetime import datetime, timezone
import pytest

from app.schemas.coordinates import CoordinateFrame, SelenographicCoordinates
from app.schemas.disclosure import TerrainFidelity
from app.schemas.mission import MissionVisibilityRequest, SolarElevationReference
from app.schemas.terrain import TerrainProfileRequest
from app.services.mission_analysis import MissionAnalysisService


@pytest.mark.anyio
async def test_mission_analysis_service_spherical_evaluation():
    """Verify MissionAnalysisService executes end-to-end visibility analysis on spherical Moon."""
    service = MissionAnalysisService()

    site = SelenographicCoordinates(
        latitude_deg=-89.0,
        longitude_deg=0.0,
        elevation_m=0.0,
        frame=CoordinateFrame.MOON_ME,
    )

    req = MissionVisibilityRequest(
        site=site,
        start_time_utc=datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc),
        end_time_utc=datetime(2027, 1, 2, 0, 0, tzinfo=timezone.utc),  # 24 hours
        sampling_interval_minutes=60,
        min_solar_elevation_deg=0.0,
        solar_elevation_reference=SolarElevationReference.CENTER_OF_DISK,
        min_earth_elevation_deg=0.0,
        include_timeline=True,
        require_terrain_occlusion=False,
    )

    resp = await service.evaluate_visibility(req)

    assert resp.site.latitude_deg == -89.0
    assert resp.summary.total_duration_hours == 24.0
    assert resp.summary.sunlight_percentage >= 0.0
    assert resp.summary.earth_line_of_sight_percentage >= 0.0
    assert resp.timeline is not None
    assert len(resp.timeline) == 25
    assert resp.disclosure.terrain_fidelity == TerrainFidelity.SPHERICAL_DATUM_ONLY


def test_mission_analysis_service_terrain_profile_generation():
    """Verify terrain profile generation via MissionAnalysisService."""
    service = MissionAnalysisService()

    site = SelenographicCoordinates(
        latitude_deg=-85.0,
        longitude_deg=45.0,
        elevation_m=200.0,
        frame=CoordinateFrame.MOON_ME,
    )

    req = TerrainProfileRequest(
        site=site,
        azimuth_step_deg=10.0,
        max_distance_km=25.0,
    )

    resp = service.evaluate_terrain_profile(req)

    assert resp.site.latitude_deg == -85.0
    assert len(resp.azimuths_deg) == 36
    assert len(resp.elevations_deg) == 36
    assert resp.max_elevation_deg is not None
    assert resp.min_elevation_deg is not None
    assert resp.mean_elevation_deg is not None
