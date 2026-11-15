"""High-precision South Polar Stereographic map projection engine for lunar terrain."""

from __future__ import annotations

import math
from typing import Final

from app.science.terrain.models import DEMPixelCoord, PolarStereoCoord

# Authoritative lunar reference sphere radius in meters (PDS / LOLA specification)
R_MOON_SPHERE_M: Final[float] = 1737400.0

# 80°S latitude boundary constants
LAT_BOUNDARY_DEG: Final[float] = -80.0
RHO_80S_M: Final[float] = 304005.6080198808  # 2 * R * tan(5 deg)
MAX_GRID_HALF_WIDTH_M: Final[float] = 304000.0  # 15200 pixels * 20 m/pixel
LAT_CARDINAL_EDGE_BOUNDARY_DEG: Final[float] = -80.0001835  # Latitude at edge midpoints (rho = 304000 m)
LAT_CARDINAL_PIXEL_CENTER_DEG: Final[float] = -80.0005108  # Latitude at outermost pixel centers (rho = 303990 m)
LAT_CORNER_BOUNDARY_DEG: Final[float] = -75.8938043  # Latitude at four raster corners (rho = 429920.9 m)


def is_within_raster_footprint(
    col_0: float,
    row_0: float,
    lines: int = 30400,
    samples: int = 30400,
) -> bool:
    """Check whether continuous coordinates fall within the physical outer footprint of the raster.

    A center-registered raster cell with index k spans [k - 0.5, k + 0.5].
    Therefore, a grid of dimension N covers continuous indices [-0.5, N - 0.5].
    """
    return (-0.5 <= col_0 <= (samples - 0.5)) and (-0.5 <= row_0 <= (lines - 0.5))


def is_within_pixel_center_hull(
    col_0: float,
    row_0: float,
    lines: int = 30400,
    samples: int = 30400,
) -> bool:
    """Check whether continuous coordinates fall within the convex hull of discrete pixel centers [0, N-1]."""
    return (0.0 <= col_0 <= (samples - 1.0)) and (0.0 <= row_0 <= (lines - 1.0))


def latlon_to_polar_stereo(
    lat_deg: float,
    lon_deg: float,
    r_body_m: float = R_MOON_SPHERE_M,
    validate_bounds: bool = True,
) -> PolarStereoCoord:
    """Project selenographic (lat, lon) to South Polar Stereographic (X, Y) in meters.

    Equations follow Snyder (1987) and PDS DSMAP_POLAR.CAT:
    - Projection center is the South Pole (lat = -90°).
    - Longitude 0° extends vertically upward (Earthward, positive Y).
    - Longitude 90° East extends horizontally to the right (positive X).
    - Half-colatitude chi = (90° - |lat|) / 2.
    - Radial projected distance rho = 2 * r_body_m * tan(chi).
    - X = rho * sin(lon).
    - Y = rho * cos(lon).

    Args:
        lat_deg: Selenographic latitude in degrees (valid range: -90.0 to -80.0).
        lon_deg: Selenographic longitude in degrees (0.0 to 360.0).
        r_body_m: Reference sphere radius in meters (default: 1,737,400.0 m).
        validate_bounds: If True, raises ValueError for latitudes north of -80.0°S.

    Returns:
        PolarStereoCoord containing X, Y, and rho in meters.
    """
    if not math.isfinite(lat_deg) or not math.isfinite(lon_deg):
        raise ValueError(f"Non-finite coordinates provided: lat={lat_deg}, lon={lon_deg}")

    if validate_bounds and lat_deg > LAT_BOUNDARY_DEG + 1e-9:
        raise ValueError(
            f"Latitude {lat_deg:.6f}° is outside the polar DEM domain (valid: -90.0° to -80.0°)."
        )

    # South Pole singularity
    if lat_deg <= -90.0:
        return PolarStereoCoord(x_m=0.0, y_m=0.0, rho_m=0.0)

    # Colatitude = 90 - |lat| = 90 + lat (since lat is negative)
    colat_deg = 90.0 + lat_deg
    half_colat_rad = math.radians(colat_deg / 2.0)
    rho_m = 2.0 * r_body_m * math.tan(half_colat_rad)

    lon_rad = math.radians(lon_deg)
    x_m = rho_m * math.sin(lon_rad)
    y_m = rho_m * math.cos(lon_rad)

    return PolarStereoCoord(x_m=x_m, y_m=y_m, rho_m=rho_m)


def polar_stereo_to_latlon(
    x_m: float,
    y_m: float,
    r_body_m: float = R_MOON_SPHERE_M,
) -> tuple[float, float]:
    """Inverse project South Polar Stereographic (X, Y) in meters to selenographic (lat, lon).

    Args:
        x_m: Projected Eastward coordinate in meters.
        y_m: Projected Earthward coordinate in meters.
        r_body_m: Reference sphere radius in meters (default: 1,737,400.0 m).

    Returns:
        Tuple of (latitude_deg, longitude_deg) where lat in [-90, 0] and lon in [0, 360).
    """
    if not math.isfinite(x_m) or not math.isfinite(y_m):
        raise ValueError(f"Non-finite projection coordinates provided: x={x_m}, y={y_m}")

    rho_m = math.sqrt(x_m * x_m + y_m * y_m)

    if rho_m == 0.0:
        return -90.0, 0.0

    # Half-colatitude = atan(rho / (2 * R))
    half_colat_rad = math.atan(rho_m / (2.0 * r_body_m))
    colat_deg = math.degrees(2.0 * half_colat_rad)
    lat_deg = -(90.0 - colat_deg)

    # Longitude: atan2(X, Y) where Y is directed Earthward (lon 0)
    lon_deg = math.degrees(math.atan2(x_m, y_m)) % 360.0

    return lat_deg, lon_deg


def polar_stereo_to_pixel(
    x_m: float,
    y_m: float,
    map_scale_m: float = 20.0,
    offset_0_based: float = 15199.5,
) -> DEMPixelCoord:
    """Convert projected metric coordinates to continuous DEM pixel coordinates.

    Uses the authoritative 0-based offset 15199.5 from the PDS label:
    - col_0 = offset_0_based + (X / map_scale_m)
    - row_0 = offset_0_based - (Y / map_scale_m)
    - sample_1 = col_0 + 1.0 (PDS 1-based Fortran sample coordinate)
    - line_1 = row_0 + 1.0 (PDS 1-based Fortran line coordinate)
    """
    col_0 = offset_0_based + (x_m / map_scale_m)
    row_0 = offset_0_based - (y_m / map_scale_m)
    sample_1 = col_0 + 1.0
    line_1 = row_0 + 1.0

    return DEMPixelCoord(
        sample_1=sample_1,
        line_1=line_1,
        col_0=col_0,
        row_0=row_0,
    )


def pixel_to_polar_stereo(
    col_0: float,
    row_0: float,
    map_scale_m: float = 20.0,
    offset_0_based: float = 15199.5,
) -> PolarStereoCoord:
    """Convert 0-based DEM pixel coordinates to projected metric coordinates."""
    x_m = (col_0 - offset_0_based) * map_scale_m
    y_m = (offset_0_based - row_0) * map_scale_m
    rho_m = math.sqrt(x_m * x_m + y_m * y_m)

    return PolarStereoCoord(x_m=x_m, y_m=y_m, rho_m=rho_m)


def latlon_to_pixel(
    lat_deg: float,
    lon_deg: float,
    map_scale_m: float = 20.0,
    offset_0_based: float = 15199.5,
    r_body_m: float = R_MOON_SPHERE_M,
    validate_bounds: bool = True,
) -> DEMPixelCoord:
    """High-level transformation from selenographic (lat, lon) directly to continuous pixel coordinates."""
    stereo = latlon_to_polar_stereo(
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        r_body_m=r_body_m,
        validate_bounds=validate_bounds,
    )
    return polar_stereo_to_pixel(
        x_m=stereo.x_m,
        y_m=stereo.y_m,
        map_scale_m=map_scale_m,
        offset_0_based=offset_0_based,
    )


def pixel_to_latlon(
    col_0: float,
    row_0: float,
    map_scale_m: float = 20.0,
    offset_0_based: float = 15199.5,
    r_body_m: float = R_MOON_SPHERE_M,
) -> tuple[float, float]:
    """High-level inverse transformation from continuous pixel coordinates directly to selenographic (lat, lon)."""
    stereo = pixel_to_polar_stereo(
        col_0=col_0,
        row_0=row_0,
        map_scale_m=map_scale_m,
        offset_0_based=offset_0_based,
    )
    return polar_stereo_to_latlon(
        x_m=stereo.x_m,
        y_m=stereo.y_m,
        r_body_m=r_body_m,
    )
