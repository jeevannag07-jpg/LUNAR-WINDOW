"""Main entrypoint and application factory for the LUNAR WINDOW backend service."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import analysis_router, health_router
from app.core.config import Settings, get_settings
from app.services.spice_manager import SPICE_LOCK, SpiceManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycles safely under SPICE_LOCK.
    
    Startup:
    - Resolves the configured kernel directory from Settings.
    - Validates presence and SHA-256 integrity of required NAIF kernels.
    - Transactionally loads the DE440 lunar frame kernels into CSPICE.
    - Attaches the initialized SpiceManager to app.state.spice_manager.
    - Fails startup clearly if required scientific kernels are missing or corrupted.
    
    Shutdown:
    - Waits for in-flight requests to complete.
    - Unloads only the kernels owned by this manager in reverse order under SPICE_LOCK.
    """
    settings: Settings = getattr(app.state, "settings", None) or get_settings()
    app.state.settings = settings

    spice_mgr: SpiceManager = getattr(app.state, "spice_manager", None) or SpiceManager(
        kernel_dir=settings.spice_kernel_dir
    )
    app.state.spice_manager = spice_mgr

    # Load kernels unless skip_spice_init flag is explicitly injected by tests
    if not getattr(app.state, "skip_spice_init", False):
        spice_mgr.load_kernels(verify_checksums=True)

    yield

    # Safe shutdown under SPICE_LOCK: Unload only kernels owned by this manager
    if hasattr(app.state, "spice_manager") and app.state.spice_manager is not None:
        with SPICE_LOCK:
            app.state.spice_manager.unload_owned()


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure an instance of the FastAPI application.

    Args:
        settings: Optional pre-configured Settings instance (useful for testing overrides).

    Returns:
        Configured FastAPI application instance.
    """
    if settings is None:
        settings = get_settings()

    application = FastAPI(
        title=settings.app_name,
        description=settings.app_description,
        version=settings.api_version,
        debug=settings.debug,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    application.state.settings = settings

    # Configure Cross-Origin Resource Sharing (CORS) for Mede's React frontend
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register System, Health, and Analysis routes
    application.include_router(health_router)
    application.include_router(analysis_router)

    # Global Exception Handler (safeguards unexpected unhandled exceptions without swallowing HTTP errors)
    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle unhandled non-HTTP exceptions with consistent structured response."""
        if isinstance(exc, (StarletteHTTPException, RequestValidationError)):
            raise exc

        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "message": "An unexpected server error occurred while processing the request.",
                "path": str(request.url.path),
            },
        )

    return application


# Global application instance for ASGI servers (uvicorn app.main:app)
app = create_app()
