"""Pydantic schemas for root, health check, and system readiness endpoints."""

from typing import Dict
from pydantic import BaseModel, Field


class RootResponse(BaseModel):
    """Response model for root index endpoint."""

    project: str = Field(
        ...,
        description="Project name",
        examples=["LUNAR WINDOW"],
    )
    description: str = Field(
        ...,
        description="Project mission and purpose",
    )
    version: str = Field(
        ...,
        description="API semantic version",
        examples=["0.1.0"],
    )


class HealthResponse(BaseModel):
    """Response model for lightweight health probe."""

    status: str = Field(
        ...,
        description="Current health status",
        examples=["healthy"],
    )
    project: str = Field(
        ...,
        description="Project identifier",
        examples=["LUNAR WINDOW"],
    )


class ReadinessResponse(BaseModel):
    """Response model for orchestration readiness probe.
    
    Discloses current backend capability status without falsely claiming
    external astronomical or terrain services are active.
    """

    status: str = Field(
        ...,
        description="Overall service readiness status",
        examples=["ready"],
    )
    project: str = Field(
        ...,
        description="Project identifier",
        examples=["LUNAR WINDOW"],
    )
    version: str = Field(
        ...,
        description="API semantic version",
        examples=["0.1.0"],
    )
    services: Dict[str, str] = Field(
        ...,
        description=(
            "Operational status of internal subsystems and external data providers. "
            "Unimplemented scientific services are explicitly marked."
        ),
    )
