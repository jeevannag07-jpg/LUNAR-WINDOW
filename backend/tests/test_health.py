"""Tests for root, health, readiness, and system endpoints.

All tests are designed to run fully offline without any external network access.
"""

from fastapi.testclient import TestClient
from app.main import create_app
from app.core.config import Settings


def get_test_client() -> TestClient:
    """Create a TestClient instance with default settings for testing."""
    test_settings = Settings(
        app_name="LUNAR WINDOW",
        api_version="0.1.0",
        debug=True,
    )
    application = create_app(settings=test_settings)
    return TestClient(application)


def test_get_root():
    """Verify GET / returns project metadata, mission description, and version."""
    client = get_test_client()
    response = client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "LUNAR WINDOW"
    assert "lunar terrain and astronomical data" in data["description"].lower()
    assert data["version"] == "0.1.0"


def test_get_health():
    """Verify GET /health returns the exact required health payload."""
    client = get_test_client()
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "project": "LUNAR WINDOW",
    }


def test_get_ready():
    """Verify GET /ready returns operational readiness without claiming external services."""
    client = get_test_client()
    response = client.get("/ready")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["project"] == "LUNAR WINDOW"
    assert data["version"] == "0.1.0"
    assert "services" in data

    services = data["services"]
    assert services["configuration"] == "initialized"
    assert services["api_layer"] == "ready"

    # Scientific integrity check:
    # Verify that external services are NOT falsely marked as ready
    assert "not_implemented" in services["nasa_jpl_horizons"]
    assert "not_implemented" in services["lola_terrain_elevation"]
    assert "not_implemented" in services["astronomical_calculations"]


def test_cors_preflight_for_frontend():
    """Verify that OPTIONS / with Mede's frontend origin returns correct CORS headers."""
    client = get_test_client()
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/health", headers=headers)

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
