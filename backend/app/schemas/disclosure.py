"""Scientific disclosure, data provenance, and transparency contracts.

Enforces strict compliance with scientific integrity rules:
1. Clearly distinguish real NASA data, analytical approximations, benchmark data, and synthetic test fixtures.
2. Disclose all computational assumptions and mathematical limitations.
3. Explicitly declare coordinate frame and terrain modeling fidelity.
4. Provide operational disclaimers preventing misuse in flight navigation.
"""

from enum import Enum
from typing import List
from pydantic import BaseModel, Field, field_validator


class DataProvenance(str, Enum):
    """Origin and authenticity classification of astronomical and ephemeris data."""

    REAL_NASA_JPL_HORIZONS = "REAL_NASA_JPL_HORIZONS"
    ANALYTICAL_APPROXIMATION = "ANALYTICAL_APPROXIMATION"
    HISTORICAL_BENCHMARK = "HISTORICAL_BENCHMARK"
    SYNTHETIC_TEST_FIXTURE = "SYNTHETIC_TEST_FIXTURE"


class DataQualityStatus(str, Enum):
    """Quality and verification state of scientific output data."""

    VERIFIED = "VERIFIED"
    PRELIMINARY = "PRELIMINARY"
    UNVALIDATED = "UNVALIDATED"
    NOT_COMPUTED = "NOT_COMPUTED"


class TerrainFidelity(str, Enum):
    """Level of lunar surface topography and obstruction modeling."""

    SPHERICAL_DATUM_ONLY = "SPHERICAL_DATUM_ONLY"          # Ideal spherical Moon (R = 1737.4 km)
    LOLA_TOPOGRAPHIC_HORIZON = "LOLA_TOPOGRAPHIC_HORIZON"  # Horizon profile from LOLA DEM
    NONE = "NONE"


class ScientificDisclosure(BaseModel):
    """Mandatory transparency metadata accompanying every scientific result."""

    provenance: DataProvenance = Field(
        ...,
        description="Authentic origin tier of the ephemeris and astronomical data.",
    )
    ephemeris_source: str = Field(
        ...,
        description="Specific source or service used (e.g. NASA JPL Horizons API DE440, Analytical Model).",
        examples=["NASA JPL Horizons API (DE440 / Body 301)"],
    )
    coordinate_frame: str = Field(
        default="MOON_ME (IAU Mean Earth / Polar Axis)",
        description="Selenographic reference frame used for surface and vector computations.",
    )
    terrain_fidelity: TerrainFidelity = Field(
        default=TerrainFidelity.SPHERICAL_DATUM_ONLY,
        description="Topographic occlusion fidelity applied to the evaluation.",
    )
    data_quality_status: DataQualityStatus = Field(
        default=DataQualityStatus.PRELIMINARY,
        description="Validation status of the output dataset.",
    )
    assumptions: List[str] = Field(
        ...,
        description="Explicit enumeration of mathematical, physical, or geometric assumptions.",
    )
    limitations: List[str] = Field(
        ...,
        description="Known operational limitations and edge-case boundaries of this analysis.",
    )
    disclaimer: str = Field(
        default=(
            "LUNAR WINDOW is a mission planning and decision-support prototype. "
            "Outputs are not certified for real-time spacecraft descent, navigation, or landing safety."
        ),
        description="Mandatory operational safety disclaimer.",
    )

    @field_validator("assumptions")
    @classmethod
    def validate_assumptions(cls, v: List[str]) -> List[str]:
        """Ensure that assumptions are explicitly disclosed and not empty."""
        if not v or len(v) == 0:
            raise ValueError("Scientific disclosure requires at least one explicit assumption statement.")
        return v

    @field_validator("limitations")
    @classmethod
    def validate_limitations(cls, v: List[str]) -> List[str]:
        """Ensure that limitations are explicitly disclosed and not empty."""
        if not v or len(v) == 0:
            raise ValueError("Scientific disclosure requires at least one explicit limitation statement.")
        return v
