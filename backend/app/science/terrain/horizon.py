"""Local topographic horizon profile generation for lunar mission sites.

Evaluates the apparent horizon elevation mask around a 360-degree azimuth sweep,
accounting for lunar curvature and LOLA digital elevation model topography.
"""

from __future__ import annotations

import math
from typing import Optional
import numpy as np

from app.science.terrain.dem_raster import DEMRasterReader
from app.science.terrain.models import (
    HorizonProfile,
)
from app.science.terrain.ray_traversal import (
    compute_ray_state,
    compute_topocentric_triad,
)
from app.science.terrain.projection import R_MOON_SPHERE_M


def generate_horizon_profile(
    site_lat_deg: float,
    site_lon_deg: float,
    site_elevation_m: float = 0.0,
    dem_reader: Optional[DEMRasterReader] = None,
    azimuth_step_deg: float = 1.0,
    max_distance_m: float = 60000.0,
    step_size_m: float = 100.0,
    r_body_m: float = R_MOON_SPHERE_M,
) -> HorizonProfile:
    """Generate a complete 360-degree topocentric horizon elevation profile.

    Scans azimuth rays around the observer, computing the maximum apparent
    elevation angle subtended by surrounding topography.

    Args:
        site_lat_deg: Site selenographic latitude in degrees.
        site_lon_deg: Site selenographic longitude in degrees.
        site_elevation_m: Observer height above reference sphere in meters.
        dem_reader: Optional DEMRasterReader providing high-resolution topography.
            If None, evaluates the spherical datum geometric horizon.
        azimuth_step_deg: Angular spacing between azimuth rays (default 1.0 deg).
        max_distance_m: Maximum radial search distance in meters (default 60 km).
        step_size_m: Radial step size along each azimuth ray in meters (default 100 m).
        r_body_m: Reference sphere radius in meters.

    Returns:
        HorizonProfile model containing azimuth array and interpolated horizon angles.
    """
    azimuths = np.arange(0.0, 360.0, azimuth_step_deg, dtype=float)
    elevations = []

    # If no DEM reader is supplied, return the spherical geometric horizon
    if dem_reader is None:
        # Geometric spherical horizon dip angle: dip = acos(R0 / (R0 + h))
        if site_elevation_m > 0.0:
            cos_dip = r_body_m / (r_body_m + site_elevation_m)
            spherical_horizon_deg = -math.degrees(math.acos(max(0.0, min(1.0, cos_dip))))
        else:
            spherical_horizon_deg = 0.0

        elev_list = [spherical_horizon_deg] * len(azimuths)
        return HorizonProfile(
            site_lat_deg=site_lat_deg,
            site_lon_deg=site_lon_deg,
            site_elevation_m=site_elevation_m,
            azimuths_deg=azimuths.tolist(),
            elevations_deg=elev_list,
            max_elevation_deg=spherical_horizon_deg,
            min_elevation_deg=spherical_horizon_deg,
            mean_elevation_deg=spherical_horizon_deg,
            is_fully_within_dem=False,
            has_missing_data=False,
        )

    u_east, u_north, u_up = compute_topocentric_triad(site_lat_deg, site_lon_deg)
    r_obs = (r_body_m + site_elevation_m) * u_up

    # Radial distance samples
    num_steps = max(2, int(math.ceil(max_distance_m / step_size_m)))
    t_samples = np.linspace(step_size_m, max_distance_m, num_steps)

    is_fully_within = True
    has_missing = False

    for az in azimuths:
        max_elev_for_az = -90.0

        for t in t_samples:
            sub_lat, sub_lon, _, _ = compute_ray_state(
                site_lat_deg=site_lat_deg,
                site_lon_deg=site_lon_deg,
                site_elevation_m=site_elevation_m,
                azimuth_deg=float(az),
                elevation_deg=0.0,  # Horizontal ray direction
                t_m=float(t),
                r_body_m=r_body_m,
            )

            sample = dem_reader.get_sample_at_latlon(sub_lat, sub_lon)
            if not sample.is_within_declared_coverage or not sample.is_within_dem:
                is_fully_within = False
                break
            if not sample.is_valid or sample.relative_elevation_m is None:
                has_missing = True
                continue

            terrain_elev = sample.relative_elevation_m

            # Position of terrain point in 3D frame
            phi_rad = math.radians(sub_lat)
            lam_rad = math.radians(sub_lon)
            u_pt = np.array(
                [
                    math.cos(phi_rad) * math.cos(lam_rad),
                    math.cos(phi_rad) * math.sin(lam_rad),
                    math.sin(phi_rad),
                ],
                dtype=float,
            )
            r_pt = (r_body_m + terrain_elev) * u_pt
            d_vec = r_pt - r_obs
            d_norm = float(np.linalg.norm(d_vec))

            if d_norm > 1e-3:
                apparent_elev_deg = math.degrees(
                    math.asin(max(-1.0, min(1.0, np.dot(d_vec, u_up) / d_norm)))
                )
                if apparent_elev_deg > max_elev_for_az:
                    max_elev_for_az = apparent_elev_deg

        final_elev = max(0.0, max_elev_for_az if max_elev_for_az > -90.0 else 0.0)
        elevations.append(final_elev)

    elev_arr = np.array(elevations, dtype=float)
    return HorizonProfile(
        site_lat_deg=site_lat_deg,
        site_lon_deg=site_lon_deg,
        site_elevation_m=site_elevation_m,
        azimuths_deg=azimuths.tolist(),
        elevations_deg=elevations,
        max_elevation_deg=float(np.max(elev_arr)),
        min_elevation_deg=float(np.min(elev_arr)),
        mean_elevation_deg=float(np.mean(elev_arr)),
        is_fully_within_dem=is_fully_within,
        has_missing_data=has_missing,
    )
