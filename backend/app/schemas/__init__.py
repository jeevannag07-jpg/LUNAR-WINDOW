"""Central schema registry for the LUNAR WINDOW backend."""

from app.schemas.coordinates import (
    CoordinateFrame,
    SelenographicCoordinates,
)
from app.schemas.disclosure import (
    DataProvenance,
    DataQualityStatus,
    ScientificDisclosure,
    TerrainFidelity,
)
from app.schemas.health import (
    HealthResponse,
    ReadinessResponse,
    RootResponse,
)
from app.schemas.mission import (
    EphemerisSample,
    MissionSummary,
    MissionVisibilityRequest,
    MissionVisibilityResponse,
    OperationalWindow,
    SolarElevationReference,
    WindowType,
)
from app.schemas.site import (
    CandidateSiteInput,
    SiteComparisonRequest,
    SiteComparisonResponse,
    SiteEvaluationMetric,
)
from app.schemas.terrain import (
    TerrainProfileRequest,
    TerrainProfileResponse,
)

__all__ = [
    "CandidateSiteInput",
    "CoordinateFrame",
    "DataProvenance",
    "DataQualityStatus",
    "EphemerisSample",
    "HealthResponse",
    "MissionSummary",
    "MissionVisibilityRequest",
    "MissionVisibilityResponse",
    "OperationalWindow",
    "ReadinessResponse",
    "RootResponse",
    "ScientificDisclosure",
    "SelenographicCoordinates",
    "SiteComparisonRequest",
    "SiteComparisonResponse",
    "SiteEvaluationMetric",
    "SolarElevationReference",
    "TerrainFidelity",
    "TerrainProfileRequest",
    "TerrainProfileResponse",
    "WindowType",
]
