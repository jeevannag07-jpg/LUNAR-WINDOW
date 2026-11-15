"""Topocentric ray tracing and terrain line-of-sight obstruction evaluation.

Computes exact or high-fidelity sampled ray trajectories across lunar terrain,
determining whether directional rays are obstructed by topography and evaluating
local horizon elevation angles.
"""

from __future__ import annotations

import math
from typing import Optional, Tuple
import numpy as np

from app.science.geometry.topocentric import calculate_topocentric_geometry
from app.science.terrain.dem_raster import DEMRasterReader
from app.science.terrain.models import (
    DirectionalVisibilityStatus,
    RayObstructionResult,
)
from app.science.terrain.projection import R_MOON_SPHERE_M


def compute_topocentric_triad(
    lat_deg: float,
    lon_deg: float,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute local East-North-Up (ENU) orthonormal triad in MOON_ME coordinates.

    Args:
        lat_deg: Selenographic latitude in degrees.
        lon_deg: Selenographic longitude in degrees.

    Returns:
        Tuple of (u_east, u_north, u_up) unit vectors as numpy arrays.
    """
    phi = math.radians(lat_deg)
    lam = math.radians(lon_deg)

    u_east = np.array([-math.sin(lam), math.cos(lam), 0.0], dtype=float)
    u_north = np.array(
        [-math.sin(phi) * math.cos(lam), -math.sin(phi) * math.sin(lam), math.cos(phi)],
        dtype=float,
    )
    u_up = np.array(
        [math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)],
        dtype=float,
    )
    return u_east, u_north, u_up


def compute_ray_state(
    site_lat_deg: float,
    site_lon_deg: float,
    site_elevation_m: float,
    azimuth_deg: float,
    elevation_deg: float,
    t_m: float,
    r_body_m: float = R_MOON_SPHERE_M,
) -> Tuple[float, float, float, float]:
    """Compute subpoint coordinates and physical ray altitude at ray distance t.

    Args:
        site_lat_deg: Site selenographic latitude [-90, +90] deg.
        site_lon_deg: Site selenographic longitude [0, 360) deg.
        site_elevation_m: Site observer elevation above reference sphere in meters.
        azimuth_deg: Topocentric azimuth in degrees [0, 360) (0 = North, 90 = East).
        elevation_deg: Topocentric elevation in degrees [-90, +90].
        t_m: Distance along physical ray from observer in meters.
        r_body_m: Lunar reference sphere radius in meters.

    Returns:
        Tuple of (subpoint_lat_deg, subpoint_lon_deg, surface_arc_s_m, ray_altitude_m).
    """
    u_east, u_north, u_up = compute_topocentric_triad(site_lat_deg, site_lon_deg)

    az_rad = math.radians(azimuth_deg)
    el_rad = math.radians(elevation_deg)

    u_ray = (
        math.sin(az_rad) * math.cos(el_rad) * u_east
        + math.cos(az_rad) * math.cos(el_rad) * u_north
        + math.sin(el_rad) * u_up
    )

    r_obs = (r_body_m + site_elevation_m) * u_up
    r_t = r_obs + t_m * u_ray
    norm_r_t = float(np.linalg.norm(r_t))

    # Surface arc via central angle
    psi = math.atan2(t_m * math.cos(el_rad), (r_body_m + site_elevation_m) + t_m * math.sin(el_rad))
    surface_arc_m = r_body_m * psi

    # Subpoint selenographic coordinates
    u_sub = r_t / norm_r_t
    lat_sub = math.degrees(math.asin(max(-1.0, min(1.0, u_sub[2]))))
    lon_sub = math.degrees(math.atan2(u_sub[1], u_sub[0])) % 360.0

    ray_altitude_m = norm_r_t - r_body_m

    return lat_sub, lon_sub, surface_arc_m, ray_altitude_m


def evaluate_ray_obstruction(
    site_lat_deg: float,
    site_lon_deg: float,
    site_elevation_m: float,
    azimuth_deg: float,
    elevation_deg: float,
    dem_reader: Optional[DEMRasterReader] = None,
    max_distance_m: float = 60000.0,
    step_size_m: float = 40.0,
    r_body_m: float = R_MOON_SPHERE_M,
) -> RayObstructionResult:
    """Evaluate whether a directional topocentric ray is obstructed by lunar topography.

    If a DEMRasterReader is provided, samples terrain elevations along the ray
    subpoint path. If dem_reader is None, uses an ideal spherical datum with
    elevation 0.0 m.

    Args:
        site_lat_deg: Site selenographic latitude.
        site_lon_deg: Site selenographic longitude.
        site_elevation_m: Site observer elevation in meters.
        azimuth_deg: Ray azimuth in degrees [0, 360).
        elevation_deg: Ray elevation in degrees [-90, +90].
        dem_reader: Optional initialized DEMRasterReader instance.
        max_distance_m: Maximum evaluation distance in meters (default 60 km).
        step_size_m: Sampling step size along ray path in meters (default 40 m).
        r_body_m: Lunar reference sphere radius in meters.

    Returns:
        RayObstructionResult indicating whether ray is occulted and obstruction details.
    """
    # Downward rays below horizontal hitting the spherical surface immediately
    if elevation_deg <= -89.9:
        return RayObstructionResult(
            azimuth_deg=azimuth_deg,
            elevation_deg=elevation_deg,
            is_obstructed=True,
            horizon_elevation_deg=0.0,
            obstruction_distance_m=0.0,
            obstruction_elevation_m=site_elevation_m,
            ray_altitude_at_obstruction_m=site_elevation_m,
            directional_status=DirectionalVisibilityStatus.OCCULTED,
        )

    # Skyward rays with elevation >= 45 deg generally clear terrain beyond local slopes
    if elevation_deg >= 45.0:
        return RayObstructionResult(
            azimuth_deg=azimuth_deg,
            elevation_deg=elevation_deg,
            is_obstructed=False,
            horizon_elevation_deg=0.0,
            directional_status=DirectionalVisibilityStatus.VISIBLE,
        )

    num_steps = max(2, int(math.ceil(max_distance_m / step_size_m)))
    t_values = np.linspace(step_size_m, max_distance_m, num_steps)

    max_apparent_horizon_deg = -90.0
    u_east, u_north, u_up = compute_topocentric_triad(site_lat_deg, site_lon_deg)
    r_obs = (r_body_m + site_elevation_m) * u_up

    has_missing_data = False
    is_boundary_truncated = False

    for t in t_values:
        sub_lat, sub_lon, _, ray_alt = compute_ray_state(
            site_lat_deg=site_lat_deg,
            site_lon_deg=site_lon_deg,
            site_elevation_m=site_elevation_m,
            azimuth_deg=azimuth_deg,
            elevation_deg=elevation_deg,
            t_m=float(t),
            r_body_m=r_body_m,
        )

        terrain_elev = 0.0  # Spherical datum default
        if dem_reader is not None:
            sample = dem_reader.get_sample_at_latlon(sub_lat, sub_lon)
            if not sample.is_within_declared_coverage or not sample.is_within_dem:
                is_boundary_truncated = True
                break
            if not sample.is_valid or sample.relative_elevation_m is None:
                has_missing_data = True
                continue
            terrain_elev = sample.relative_elevation_m

        # Compute apparent elevation of this terrain point relative to observer
        phi_rad = math.radians(sub_lat)
        lam_rad = math.radians(sub_lon)
        u_terrain = np.array(
            [
                math.cos(phi_rad) * math.cos(lam_rad),
                math.cos(phi_rad) * math.sin(lam_rad),
                math.sin(phi_rad),
            ],
            dtype=float,
        )
        r_terrain = (r_body_m + terrain_elev) * u_terrain
        d_vec = r_terrain - r_obs
        d_norm = float(np.linalg.norm(d_vec))

        if d_norm > 1e-3:
            apparent_elev_deg = math.degrees(math.asin(max(-1.0, min(1.0, np.dot(d_vec, u_up) / d_norm))))
            if apparent_elev_deg > max_apparent_horizon_deg:
                max_apparent_horizon_deg = apparent_elev_deg

        # Test obstruction: ray altitude below or equal to local terrain elevation
        if ray_alt <= terrain_elev:
            return RayObstructionResult(
                azimuth_deg=azimuth_deg,
                elevation_deg=elevation_deg,
                is_obstructed=True,
                horizon_elevation_deg=max(0.0, max_apparent_horizon_deg),
                obstruction_distance_m=float(t),
                obstruction_elevation_m=terrain_elev,
                ray_altitude_at_obstruction_m=ray_alt,
                directional_status=DirectionalVisibilityStatus.OCCULTED,
            )

    horizon_elev = max(0.0, max_apparent_horizon_deg if max_apparent_horizon_deg > -90.0 else 0.0)

    # Determine status if ray exited boundary or encountered data voids
    status = DirectionalVisibilityStatus.VISIBLE
    if is_boundary_truncated:
        status = DirectionalVisibilityStatus.UNRESOLVED_BOUNDARY
    elif has_missing_data:
        status = DirectionalVisibilityStatus.UNRESOLVED_MISSING_DATA

    return RayObstructionResult(
        azimuth_deg=azimuth_deg,
        elevation_deg=elevation_deg,
        is_obstructed=False,
        horizon_elevation_deg=horizon_elev,
        directional_status=status,
    )
