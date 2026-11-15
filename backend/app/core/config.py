"""Application configuration management using pydantic-settings.

Provides typed environment variable parsing and configuration injection
for the LUNAR WINDOW backend service.
"""

from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings for LUNAR WINDOW backend service."""

    # Application Metadata
    app_name: str = Field(
        default="LUNAR WINDOW",
        description="Public-facing project name",
    )
    app_description: str = Field(
        default=(
            "Lunar Mission Planning and Site Evaluation Platform — "
            "Transforming complex lunar terrain and astronomical data into "
            "clear, time-aware operational insights."
        ),
        description="Public-facing project mission description",
    )
    api_version: str = Field(
        default="0.1.0",
        description="Semantic version of the backend API",
    )
    debug: bool = Field(
        default=False,
        description="Enable debug mode for verbose error logging",
    )

    # Cross-Origin Resource Sharing (CORS)
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:5173",  # Mede's Vite + React local frontend
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        description="List of allowed origins for CORS requests",
    )

    # NASA JPL Horizons Service Configuration
    horizons_base_url: str = Field(
        default="https://ssd.jpl.nasa.gov/api/horizons.api",
        description="Base URL for NASA JPL Horizons REST API",
    )
    external_request_timeout: float = Field(
        default=30.0,
        description="Timeout in seconds for external scientific data service requests",
    )
    cache_dir: str = Field(
        default=".cache/horizons",
        description="Local directory for deterministic ephemeris query caching",
    )

    # NAIF SPICE Kernel Configuration
    spice_kernel_dir: str = Field(
        default="data/kernels",
        description="Directory path containing required NAIF SPICE kernels",
    )

    # LOLA Polar DEM Dataset Configuration
    dem_raster_path: str = Field(
        default="data/dem/LDEM_80S_20M.IMG",
        description="Path to 16-bit binary LOLA polar DEM raster file",
    )
    dem_label_path: str = Field(
        default="data/dem/LDEM_80S_20M.LBL",
        description="Path to PDS3 label file for LOLA polar DEM",
    )

    # Pydantic Settings Configuration
    model_config = SettingsConfigDict(
        env_prefix="LUNAR_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return a cached instance of the application settings."""
    return Settings()
