"""Astronomical computing submodule.

Provides time scale conversion, NAIF SPICE lunar orientation transformations
(ICRF/J2000 to MOON_ME), and the high-level AstronomyEngine for lunar surface
topocentric observation time series of the Sun and Earth.
"""

from app.science.astronomy.engine import (
    AstronomyEngine,
    AstronomyEngineError,
    LUNAR_CENTER_HORIZONS,
    NAIF_ID_EARTH,
    NAIF_ID_SUN,
)
from app.science.astronomy.models import (
    AstronomyEpochRecord,
    AstronomyProvenanceMetadata,
    AstronomySiteMetadata,
    AstronomyTimeSeriesResult,
    BodyTopocentricSample,
)
from app.science.astronomy.orientation import (
    get_rotation_matrix,
    get_state_transformation_matrix,
    normalize_frame_name,
    transform_position,
    transform_state,
)
from app.science.astronomy.time import (
    EpochMetadata,
    et_to_utc,
    get_epoch_metadata,
    utc_to_et,
    validate_and_normalize_utc,
)

__all__ = [
    "AstronomyEngine",
    "AstronomyEngineError",
    "AstronomyEpochRecord",
    "AstronomyProvenanceMetadata",
    "AstronomySiteMetadata",
    "AstronomyTimeSeriesResult",
    "BodyTopocentricSample",
    "EpochMetadata",
    "LUNAR_CENTER_HORIZONS",
    "NAIF_ID_EARTH",
    "NAIF_ID_SUN",
    "et_to_utc",
    "get_epoch_metadata",
    "get_rotation_matrix",
    "get_state_transformation_matrix",
    "normalize_frame_name",
    "transform_position",
    "transform_state",
    "utc_to_et",
    "validate_and_normalize_utc",
]
