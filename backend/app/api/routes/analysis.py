"""Analysis route controllers for scientific mission planning, terrain profiles, and site evaluation."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.decision.site_evaluation import SiteEvaluationEngine
from app.schemas.mission import (
    MissionVisibilityRequest,
    MissionVisibilityResponse,
)
from app.schemas.site import (
    SiteComparisonRequest,
    SiteComparisonResponse,
)
from app.schemas.terrain import (
    TerrainProfileRequest,
    TerrainProfileResponse,
)
from app.science.astronomy.engine import AstronomyEngine, AstronomyEngineError
from app.science.terrain.dem_service import DEMService
from app.services.mission_analysis import MissionAnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analysis", tags=["Scientific Analysis"])


def get_analysis_service(request: Request) -> MissionAnalysisService:
    """Dependency provider for MissionAnalysisService using application state."""
    spice_mgr = getattr(request.app.state, "spice_manager", None)
    settings = getattr(request.app.state, "settings", None)

    astronomy_engine = AstronomyEngine(spice_manager=spice_mgr)
    dem_service = DEMService(
        raster_path=settings.dem_raster_path if settings else None,
        label_path=settings.dem_label_path if settings else None,
    )
    return MissionAnalysisService(
        astronomy_engine=astronomy_engine,
        dem_service=dem_service,
    )


def get_site_evaluation_engine(
    analysis_service: MissionAnalysisService = Depends(get_analysis_service),
) -> SiteEvaluationEngine:
    """Dependency provider for SiteEvaluationEngine."""
    return SiteEvaluationEngine(analysis_service=analysis_service)


@router.post(
    "/visibility",
    response_model=MissionVisibilityResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate Lunar Mission Visibility",
    description=(
        "Executes high-precision topocentric astronomy and terrain visibility analysis "
        "for a lunar surface site across a mission observation window. "
        "Integrates NASA JPL Horizons DE440 state vectors, NAIF SPICE frame rotations, "
        "and LOLA polar topographic horizon occlusion."
    ),
)
async def evaluate_visibility(
    request_payload: MissionVisibilityRequest,
    analysis_service: MissionAnalysisService = Depends(get_analysis_service),
) -> MissionVisibilityResponse:
    """Execute end-to-end mission visibility analysis for a target site."""
    try:
        return await analysis_service.evaluate_visibility(request_payload)
    except AstronomyEngineError as exc:
        logger.error("Astronomical computation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "AstronomyEngineError", "message": str(exc)},
        ) from exc
    except ValueError as exc:
        logger.warning("Invalid request parameters: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "InvalidParameters", "message": str(exc)},
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in visibility evaluation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "AnalysisExecutionError", "message": str(exc)},
        ) from exc


@router.post(
    "/terrain/profile",
    response_model=TerrainProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Local Topographic Horizon Profile",
    description=(
        "Computes 360-degree topocentric horizon elevation profile around a target site "
        "accounting for lunar curvature and LOLA digital elevation model topography."
    ),
)
async def get_terrain_profile(
    request_payload: TerrainProfileRequest,
    analysis_service: MissionAnalysisService = Depends(get_analysis_service),
) -> TerrainProfileResponse:
    """Generate 360-degree local terrain horizon elevation profile."""
    try:
        return analysis_service.evaluate_terrain_profile(request_payload)
    except Exception as exc:
        logger.exception("Error generating terrain profile: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "TerrainProfileError", "message": str(exc)},
        ) from exc


@router.post(
    "/compare",
    response_model=SiteComparisonResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare Candidate Lunar Exploration Sites",
    description=(
        "Evaluates and ranks multiple candidate lunar surface exploration sites "
        "across a common mission epoch based on sunlight availability, Earth line-of-sight, "
        "simultaneous operational windows, and terrain obstruction."
    ),
)
async def compare_sites(
    request_payload: SiteComparisonRequest,
    evaluation_engine: SiteEvaluationEngine = Depends(get_site_evaluation_engine),
) -> SiteComparisonResponse:
    """Evaluate and rank candidate lunar landing sites."""
    try:
        return await evaluation_engine.compare_sites(request_payload)
    except Exception as exc:
        logger.exception("Error evaluating site comparison: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "SiteComparisonError", "message": str(exc)},
        ) from exc
