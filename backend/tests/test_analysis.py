"""Tests for the scientific analysis API route controllers.

Verifies end-to-end functionality of:
- POST /api/v1/analysis/visibility
- POST /api/v1/analysis/terrain/profile
- POST /api/v1/analysis/compare
"""

from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app


def get_client() -> TestClient:
    """Create TestClient with test settings."""
    settings = Settings(app_name="LUNAR WINDOW", api_version="0.1.0", debug=True)
    return TestClient(create_app(settings=settings))


def test_visibility_endpoint_functional():
    """Verify that a valid visibility request returns HTTP 200 with full MissionVisibilityResponse."""
    client = get_client()
    payload = {
        "site": {
            "latitude_deg": -89.44,
            "longitude_deg": 138.0,
            "elevation_m": 1100.0,
            "frame": "MOON_ME",
        },
        "start_time_utc": "2027-01-01T00:00:00Z",
        "end_time_utc": "2027-01-02T00:00:00Z",  # 24 hours
        "sampling_interval_minutes": 60,
        "min_solar_elevation_deg": 0.0,
        "solar_elevation_reference": "CENTER_OF_DISK",
        "min_earth_elevation_deg": 0.0,
        "include_timeline": True,
        "require_terrain_occlusion": False,
    }

    response = client.post("/api/v1/analysis/visibility", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "site" in data
    assert data["site"]["latitude_deg"] == -89.44
    assert "summary" in data
    assert "total_duration_hours" in data["summary"]
    assert data["summary"]["total_duration_hours"] == 24.0
    assert "windows" in data
    assert isinstance(data["windows"], list)
    assert "timeline" in data
    assert len(data["timeline"]) == 25  # 24 hours at 60 min intervals = 25 samples
    assert "disclosure" in data
    assert data["disclosure"]["coordinate_frame"] == "MOON_ME (IAU Mean Earth / Polar Axis)"


def test_terrain_profile_endpoint():
    """Verify that /api/v1/analysis/terrain/profile returns 360-degree horizon profile."""
    client = get_client()
    payload = {
        "site": {
            "latitude_deg": -89.5,
            "longitude_deg": 0.0,
            "elevation_m": 500.0,
            "frame": "MOON_ME",
        },
        "azimuth_step_deg": 5.0,
        "max_distance_km": 30.0,
    }

    response = client.post("/api/v1/analysis/terrain/profile", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "azimuths_deg" in data
    assert len(data["azimuths_deg"]) == 72  # 360 / 5 = 72
    assert "elevations_deg" in data
    assert len(data["elevations_deg"]) == 72
    assert "max_elevation_deg" in data
    assert "disclosure" in data


def test_site_comparison_endpoint():
    """Verify that /api/v1/analysis/compare ranks multiple candidate lunar sites."""
    client = get_client()
    payload = {
        "sites": [
            {
                "site_id": "SITE_A",
                "name": "Site Alpha",
                "coordinates": {
                    "latitude_deg": -89.9,
                    "longitude_deg": 0.0,
                    "elevation_m": 0.0,
                },
            },
            {
                "site_id": "SITE_B",
                "name": "Site Beta",
                "coordinates": {
                    "latitude_deg": -85.0,
                    "longitude_deg": 90.0,
                    "elevation_m": 1200.0,
                },
            },
        ],
        "start_time_utc": "2027-01-01T00:00:00Z",
        "end_time_utc": "2027-01-02T00:00:00Z",
        "sampling_interval_minutes": 120,
        "require_terrain_occlusion": False,
    }

    response = client.post("/api/v1/analysis/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["sites"]) == 2
    assert data["highest_opportunity_site_id"] in ["SITE_A", "SITE_B"]
    assert "comparison_notes" in data
    assert len(data["comparison_notes"]) >= 2


def test_visibility_endpoint_invalid_coordinates_returns_422():
    """Verify that out-of-bounds coordinates are rejected with HTTP 422."""
    client = get_client()
    payload = {
        "site": {
            "latitude_deg": -95.0,  # Invalid (< -90)
            "longitude_deg": 0.0,
        },
        "start_time_utc": "2027-01-01T00:00:00Z",
        "end_time_utc": "2027-01-14T00:00:00Z",
    }

    response = client.post("/api/v1/analysis/visibility", json=payload)
    assert response.status_code == 422


def test_visibility_endpoint_naive_timestamp_returns_422():
    """Verify that naive timestamps without timezone offset are rejected with HTTP 422."""
    client = get_client()
    payload = {
        "site": {
            "latitude_deg": -85.0,
            "longitude_deg": 0.0,
        },
        "start_time_utc": "2027-01-01T00:00:00",  # Missing 'Z' / offset
        "end_time_utc": "2027-01-14T00:00:00Z",
    }

    response = client.post("/api/v1/analysis/visibility", json=payload)
    assert response.status_code == 422


def test_visibility_endpoint_span_exceeding_180_days_returns_422():
    """Verify that requests exceeding 180 days are rejected with HTTP 422."""
    client = get_client()
    payload = {
        "site": {
            "latitude_deg": -85.0,
            "longitude_deg": 0.0,
        },
        "start_time_utc": "2027-01-01T00:00:00Z",
        "end_time_utc": "2027-07-15T00:00:00Z",  # 195 days
    }

    response = client.post("/api/v1/analysis/visibility", json=payload)
    assert response.status_code == 422
