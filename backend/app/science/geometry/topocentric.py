"""Site-relative topocentric geometry and line-of-sight calculations.

Computes topocentric displacement vectors, local East-North-Up (ENU) coordinates,
and horizon angles (azimuth and elevation) from a lunar surface site to any celestial body.

Scientific Invariants & Frame Integrity:
1. Strict Frame Match: The celestial body position and lunar surface site position must
   both be expressed in the exact same Moon-fixed reference frame (typically MOON_ME) at
   the exact same epoch. Frame mixing (e.g. ICRF with MOON_ME or MOON_PA with MOON_ME) is
   strictly rejected.
2. Slant Range: Distance is the Euclidean norm of the topocentric displacement vector.
3. Zero-Length Handling: If the body position coincides with the site (relative distance ≈ 0),
   azimuth and elevation are geometrically undefined; a ValueError is raised rather than
   fabricating artificial angles.
4. Zenith Singularity: When the body is directly at zenith (elevation ≈ +90°) or nadir (elevation ≈ -90°),
   horizontal distance is zero and azimuth is mathematically indeterminate. In this singularity,
   azimuth defaults to 0.0° and `is_near_zenith` is flagged.
"""

from dataclasses import dataclass
import math
from typing import Optional, Sequence, Union
import numpy as np

from app.science.astronomy.time import EpochMetadata
from app.science.geometry.local_frame import cartesian_to_enu


@dataclass(frozen=True)
class TopocentricGeometryResult:
    """Complete site-relative topocentric geometry result."""

    relative_cartesian_km: np.ndarray  # [rho_X, rho_Y, rho_Z] in body frame
    enu_vector_km: np.ndarray          # [East, North, Up] in local horizon frame
    azimuth_deg: float                 # [0.0, 360.0) degrees clockwise from True North
    elevation_deg: float               # [-90.0, +90.0] degrees relative to local tangent plane
    distance_km: float                 # Slant range in kilometers
    frame: str                         # Coordinate reference frame (e.g. 'MOON_ME')
    units: str = "km"                  # Measurement units
    epoch: Optional[EpochMetadata] = None  # Observation epoch metadata
    is_near_zenith: bool = False       # True if horizontal distance is near zero (singularity)


def calculate_topocentric_geometry(
    body_position_km: Union[np.ndarray, Sequence[float]],
    site_position_km: Union[np.ndarray, Sequence[float]],
    site_latitude_deg: float,
    site_longitude_deg: float,
    body_frame: str = "MOON_ME",
    site_frame: str = "MOON_ME",
    epoch_metadata: Optional[EpochMetadata] = None,
) -> TopocentricGeometryResult:
    """Calculate site-relative topocentric vector, local ENU coordinates, azimuth, and elevation.

    Mathematical Formulation:
        1. Relative displacement in body-fixed frame:
           rho = r_body - r_site
        2. Local ENU projection:
           rho_E = rho · e_hat
           rho_N = rho · n_hat
           rho_U = rho · u_hat
        3. Angular coordinates:
           distance = sqrt(rho_E^2 + rho_N^2 + rho_U^2)
           elevation = atan2(rho_U, sqrt(rho_E^2 + rho_N^2))
           azimuth = atan2(rho_E, rho_N) mod 360.0

    Args:
        body_position_km: Moon-centered Cartesian coordinates of target body [X, Y, Z] (km).
        site_position_km: Moon-centered Cartesian coordinates of surface site [X, Y, Z] (km).
        site_latitude_deg: Selenographic latitude of surface site [-90.0, +90.0] degrees.
        site_longitude_deg: Selenographic East-positive longitude of surface site [-180.0, +180.0] degrees.
        body_frame: Reference frame of body position (default 'MOON_ME').
        site_frame: Reference frame of site position (default 'MOON_ME').
        epoch_metadata: Optional epoch timing and scale metadata.

    Returns:
        TopocentricGeometryResult with relative vectors, azimuth, elevation, and distance.

    Raises:
        ValueError: If frames mismatch, vectors are non-finite or invalid shape, or relative
                    vector has zero length (coincident points).
    """
    # 1. Enforce strict reference frame consistency
    clean_body_frame = body_frame.strip().upper()
    clean_site_frame = site_frame.strip().upper()
    if clean_body_frame != clean_site_frame:
        raise ValueError(
            f"Reference frame mismatch: body position is in '{body_frame}', but site position is in '{site_frame}'. "
            f"All vectors must be transformed into the exact same Moon-fixed reference frame before topocentric calculation."
        )

    # 2. Validate input vector shapes and finite values
    body_pos = np.asarray(body_position_km, dtype=np.float64)
    site_pos = np.asarray(site_position_km, dtype=np.float64)

    if body_pos.shape != (3,):
        raise ValueError(f"Body position vector must have shape (3,), got {body_pos.shape}")
    if site_pos.shape != (3,):
        raise ValueError(f"Site position vector must have shape (3,), got {site_pos.shape}")

    if not np.all(np.isfinite(body_pos)):
        raise ValueError(f"Body position vector contains non-finite values: {body_pos}")
    if not np.all(np.isfinite(site_pos)):
        raise ValueError(f"Site position vector contains non-finite values: {site_pos}")

    # 3. Calculate relative displacement vector in body frame: rho = r_body - r_site
    rho_cartesian = body_pos - site_pos

    # 4. Check for zero-length relative vector (observer coincides with target)
    distance_km = float(np.linalg.norm(rho_cartesian))
    if distance_km < 1e-6:  # Less than 1 millimeter
        raise ValueError(
            "Zero-length relative vector: target body position coincides with the observer surface site. "
            "Topocentric azimuth and elevation are geometrically undefined."
        )

    # 5. Project relative vector into local East-North-Up (ENU) coordinates
    rho_enu = cartesian_to_enu(
        vector_km=rho_cartesian,
        latitude_deg=site_latitude_deg,
        longitude_deg=site_longitude_deg,
    )

    rho_e = float(rho_enu[0])
    rho_n = float(rho_enu[1])
    rho_u = float(rho_enu[2])

    horizontal_dist = math.sqrt(rho_e * rho_e + rho_n * rho_n)

    # 6. Calculate elevation angle: atan2(Up, Horizontal)
    elevation_rad = math.atan2(rho_u, horizontal_dist)
    elevation_deg = math.degrees(elevation_rad)

    # 7. Calculate azimuth angle: atan2(East, North) normalized to [0, 360)
    # Check for near-zenith / near-nadir coordinate singularity
    is_near_zenith = False
    if horizontal_dist < 1e-9:  # Horizontal distance < 1 micrometer
        is_near_zenith = True
        azimuth_deg = 0.0  # Geometrically indeterminate; default to 0.0 with flag
    else:
        azimuth_rad = math.atan2(rho_e, rho_n)
        azimuth_deg = math.degrees(azimuth_rad) % 360.0

    return TopocentricGeometryResult(
        relative_cartesian_km=rho_cartesian,
        enu_vector_km=rho_enu,
        azimuth_deg=float(azimuth_deg),
        elevation_deg=float(elevation_deg),
        distance_km=float(distance_km),
        frame=clean_site_frame,
        units="km",
        epoch=epoch_metadata,
        is_near_zenith=is_near_zenith,
    )
