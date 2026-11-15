"""Lunar surface geometry engine package.

Provides lunar surface location conversion to Moon-centered Cartesian coordinates,
local East-North-Up (ENU) topocentric reference frame projections, and site-relative
body geometry (azimuth, elevation, distance).
"""

from app.science.geometry.local_frame import (
    ENUBasis,
    cartesian_to_enu,
    compute_enu_basis,
    get_cartesian_to_enu_matrix,
)
from app.science.geometry.lunar_coordinates import (
    LUNAR_MEAN_RADIUS_KM,
    LunarCartesianPosition,
    cartesian_to_selenographic,
    selenographic_to_cartesian,
)
from app.science.geometry.topocentric import (
    TopocentricGeometryResult,
    calculate_topocentric_geometry,
)

__all__ = [
    "ENUBasis",
    "LUNAR_MEAN_RADIUS_KM",
    "LunarCartesianPosition",
    "TopocentricGeometryResult",
    "calculate_topocentric_geometry",
    "cartesian_to_enu",
    "cartesian_to_selenographic",
    "compute_enu_basis",
    "get_cartesian_to_enu_matrix",
    "selenographic_to_cartesian",
]
