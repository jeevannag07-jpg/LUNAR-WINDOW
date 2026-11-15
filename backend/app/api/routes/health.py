"""System health, root info, and operational readiness endpoints."""

from fastapi import APIRouter, Depends
from app.core.config import Settings, get_settings
from app.schemas.health import HealthResponse, ReadinessResponse, RootResponse

router = APIRouter(tags=["System"])


@router.get(
    "/",
    response_model=RootResponse,
    summary="Project Information",
    description="Returns public project metadata, mission description, and active API version.",
)
async def get_root(settings: Settings = Depends(get_settings)) -> RootResponse:
    """Return project identity and version metadata."""
    return RootResponse(
        project=settings.app_name,
        description=settings.app_description,
        version=settings.api_version,
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Probe",
    description="Returns simple liveness check indicating the application server is responsive.",
)
async def get_health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Return lightweight health status."""
    return HealthResponse(
        status="healthy",
        project=settings.app_name,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness Probe",
    description=(
        "Returns readiness status of internal backend services. "
        "Strictly discloses that external scientific integrations are pending."
    ),
)
async def get_ready(settings: Settings = Depends(get_settings)) -> ReadinessResponse:
    """Return operational readiness of internal components."""
    # Disclose honest operational status of all backend subsystems:
    # We do NOT claim external scientific providers are available since their
    # client integrations are scheduled for future stages.
    service_status = {
        "configuration": "initialized",
        "api_layer": "ready",
        "nasa_jpl_horizons": "not_implemented (scheduled for Stage 3)",
        "lola_terrain_elevation": "not_implemented (scheduled for Stage 8)",
        "astronomical_calculations": "not_implemented (scheduled for Stage 4)",
    }

    return ReadinessResponse(
        status="ready",
        project=settings.app_name,
        version=settings.api_version,
        services=service_status,
    )
