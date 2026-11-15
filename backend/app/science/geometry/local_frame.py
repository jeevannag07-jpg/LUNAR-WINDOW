"""Local East-North-Up (ENU) topocentric reference frame at a lunar surface site.

Defines a mathematically rigorous, right-handed orthonormal local horizon basis
projected from the Moon-centered body-fixed MOON_ME reference frame.

Basis Conventions:
- Up (u_hat): Surface normal unit vector pointing toward the local zenith.
      u_hat = (cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat))
- East (e_hat): Unit vector tangent to the sphere pointing in the direction of increasing longitude.
      e_hat = (-sin(lon), cos(lon), 0)
- North (n_hat): Unit vector tangent to the sphere pointing in the direction of increasing latitude.
      n_hat = u_hat x e_hat = (-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat))

Mathematical Invariants:
1. Unit Norms: ||e_hat|| == ||n_hat|| == ||u_hat|| == 1.0
2. Mutual Orthogonality: e_hat · n_hat == e_hat · u_hat == n_hat · u_hat == 0.0
3. Right-Handed System: e_hat x n_hat == u_hat, det([e_hat, n_hat, u_hat]) == +1.0

Coordinate Singularity at the Exact Poles (latitude = ±90.0°):
At the exact geographical poles, all meridians converge and East and North become geometrically
degenerate (gimbal lock). In this implementation, the coordinate singularity is handled
strictly and deterministically:
- If a longitude is provided for the polar site, East is oriented along the direction of increasing
  longitude (-sin(lon), cos(lon), 0), and North is formed by u_hat x e_hat, preserving a
  mathematically valid right-handed orthonormal basis (det = +1.0) without discontinuities.
- At the North Pole (lat = +90°): Up = (0, 0, 1), North points toward the anti-meridian (lon + 180°).
- At the South Pole (lat = -90°): Up = (0, 0, -1), North points toward the local meridian (lon).
"""

from dataclasses import dataclass
import math
from typing import Sequence, Tuple, Union
import numpy as np


@dataclass(frozen=True)
class ENUBasis:
    """Orthonormal local horizon basis vectors in MOON_ME Cartesian coordinates."""

    east: np.ndarray   # e_hat shape (3,)
    north: np.ndarray  # n_hat shape (3,)
    up: np.ndarray     # u_hat shape (3,)
    latitude_deg: float
    longitude_deg: float

    def as_rotation_matrix(self) -> np.ndarray:
        """Return the 3x3 transformation matrix from Moon-centered Cartesian to local ENU.

        Matrix formulation:
            M = [ e_hat^T ]
                [ n_hat^T ]
                [ u_hat^T ]

            v_ENU = M · v_Cartesian
        """
        return np.vstack([self.east, self.north, self.up])


def compute_enu_basis(
    latitude_deg: float,
    longitude_deg: float,
) -> ENUBasis:
    """Compute the local orthonormal East-North-Up basis vectors at a lunar surface site.

    Args:
        latitude_deg: Selenographic latitude in degrees [-90.0, +90.0].
        longitude_deg: Selenographic East-positive longitude in degrees [-180.0, +180.0].

    Returns:
        ENUBasis containing east, north, and up unit vectors in MOON_ME coordinates.

    Raises:
        ValueError: If coordinates are out of physical bounds or non-finite.
    """
    if not (math.isfinite(latitude_deg) and math.isfinite(longitude_deg)):
        raise ValueError("Latitude and longitude must be finite numbers.")
    if not -90.0 <= latitude_deg <= 90.0:
        raise ValueError(
            f"Latitude must be between -90.0 and +90.0 degrees, got {latitude_deg}"
        )
    if not -180.0 <= longitude_deg <= 180.0:
        raise ValueError(
            f"Longitude must be between -180.0 and +180.0 degrees, got {longitude_deg}"
        )

    lat_rad = math.radians(latitude_deg)
    lon_rad = math.radians(longitude_deg)

    # Handle exact polar singularities explicitly and smoothly
    if abs(latitude_deg) >= 89.9999999999:
        if latitude_deg > 0:
            # North Pole (+90°): Up points along +Z axis
            u_hat = np.array([0.0, 0.0, 1.0], dtype=np.float64)
            e_hat = np.array([-math.sin(lon_rad), math.cos(lon_rad), 0.0], dtype=np.float64)
            n_hat = np.cross(u_hat, e_hat)  # (-cos(lon), -sin(lon), 0)
        else:
            # South Pole (-90°): Up points along -Z axis
            u_hat = np.array([0.0, 0.0, -1.0], dtype=np.float64)
            e_hat = np.array([-math.sin(lon_rad), math.cos(lon_rad), 0.0], dtype=np.float64)
            n_hat = np.cross(u_hat, e_hat)  # (cos(lon), sin(lon), 0)

        # Normalize to ensure exact unit length
        e_hat = e_hat / np.linalg.norm(e_hat)
        n_hat = n_hat / np.linalg.norm(n_hat)

        return ENUBasis(
            east=e_hat,
            north=n_hat,
            up=u_hat,
            latitude_deg=float(latitude_deg),
            longitude_deg=float(longitude_deg),
        )

    cos_lat = math.cos(lat_rad)
    sin_lat = math.sin(lat_rad)
    cos_lon = math.cos(lon_rad)
    sin_lon = math.sin(lon_rad)

    # Up: outward normal to lunar sphere
    u_hat = np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat], dtype=np.float64)

    # East: unit vector in direction of increasing longitude (-sin(lon), cos(lon), 0)
    e_hat = np.array([-sin_lon, cos_lon, 0.0], dtype=np.float64)

    # North: u_hat x e_hat = (-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat))
    n_hat = np.cross(u_hat, e_hat)

    # Normalize vectors
    u_hat = u_hat / np.linalg.norm(u_hat)
    e_hat = e_hat / np.linalg.norm(e_hat)
    n_hat = n_hat / np.linalg.norm(n_hat)

    return ENUBasis(
        east=e_hat,
        north=n_hat,
        up=u_hat,
        latitude_deg=float(latitude_deg),
        longitude_deg=float(longitude_deg),
    )


def get_cartesian_to_enu_matrix(
    latitude_deg: float,
    longitude_deg: float,
) -> np.ndarray:
    """Compute the 3x3 orthogonal transformation matrix from MOON_ME Cartesian to local ENU.

    Args:
        latitude_deg: Selenographic latitude in degrees.
        longitude_deg: Selenographic longitude in degrees.

    Returns:
        3x3 numpy ndarray matrix M where v_ENU = M · v_Cartesian.
    """
    basis = compute_enu_basis(latitude_deg, longitude_deg)
    return basis.as_rotation_matrix()


def cartesian_to_enu(
    vector_km: Union[np.ndarray, Sequence[float]],
    latitude_deg: float,
    longitude_deg: float,
) -> np.ndarray:
    """Transform a 3D Cartesian vector in MOON_ME into local East-North-Up coordinates.

    Args:
        vector_km: 3-element vector [X, Y, Z] in kilometers.
        latitude_deg: Observer site selenographic latitude in degrees.
        longitude_deg: Observer site selenographic longitude in degrees.

    Returns:
        3-element numpy ndarray [East, North, Up] in kilometers.

    Raises:
        ValueError: If vector has invalid shape or contains non-finite values.
    """
    vec = np.asarray(vector_km, dtype=np.float64)
    if vec.shape != (3,):
        raise ValueError(f"Input vector must have shape (3,), got {vec.shape}")
    if not np.all(np.isfinite(vec)):
        raise ValueError(f"Input vector contains non-finite values: {vec}")

    rot_matrix = get_cartesian_to_enu_matrix(latitude_deg, longitude_deg)
    enu_vec = rot_matrix @ vec
    return enu_vec
