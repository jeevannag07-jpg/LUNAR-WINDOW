"""Selenographic and Moon-centered Cartesian coordinate conversions.

Converts surface locations between selenographic coordinates (latitude, longitude, elevation)
and Moon-centered body-fixed Cartesian coordinates in the MOON_ME reference frame.

Physical Model & Limitations:
- Reference Datum: Prototype spherical lunar datum with mean radius R_moon = 1737.4 km
  per IAU Working Group on Cartographic Coordinates and Rotational Elements (WGCCRE).
- Elevation Baseline: Radial displacement h (km) above the mean spherical radius:
      r = R_moon + h
- Scope Limitation: This is a prototype spherical approximation, not a high-precision lunar
  geodetic solution. Coordinates computed with this model are NOT terrain-accurate.
  Topographic crater elevations, mascon geoid undulations, and DEM-derived surface heights
  will be integrated in Stage 8.
"""

from dataclasses import dataclass
import math
from typing import Sequence, Tuple, Union
import numpy as np

# Standard IAU mean lunar radius in kilometers
LUNAR_MEAN_RADIUS_KM: float = 1737.4


@dataclass(frozen=True)
class LunarCartesianPosition:
    """Moon-centered Cartesian coordinates with explicit frame, units, and datum metadata."""

    x_km: float
    y_km: float
    z_km: float
    radius_km: float
    frame: str = "MOON_ME"
    units: str = "km"
    datum: str = "SPHERICAL_MEAN_RADIUS"
    model_note: str = (
        "Prototype spherical lunar datum (R=1737.4 km). Not terrain-accurate."
    )

    def as_array(self) -> np.ndarray:
        """Return coordinates as a 3-element numpy array [X, Y, Z]."""
        return np.array([self.x_km, self.y_km, self.z_km], dtype=np.float64)


def selenographic_to_cartesian(
    latitude_deg: float,
    longitude_deg: float,
    elevation_km: float = 0.0,
    radius_km: float = LUNAR_MEAN_RADIUS_KM,
    frame: str = "MOON_ME",
) -> LunarCartesianPosition:
    """Convert selenographic coordinates to Moon-centered Cartesian coordinates.

    Mathematical Formulation:
        r = radius_km + elevation_km
        X = r * cos(latitude) * cos(longitude)
        Y = r * cos(latitude) * sin(longitude)
        Z = r * sin(latitude)

    Args:
        latitude_deg: Selenographic latitude in decimal degrees [-90.0, +90.0].
                      Negative indicates Southern Hemisphere.
        longitude_deg: Selenographic East-positive longitude in decimal degrees [-180.0, +180.0].
        elevation_km: Radial elevation in kilometers above reference lunar sphere (h).
        radius_km: Lunar reference datum radius (default 1737.4 km).
        frame: Reference frame of output coordinates (default 'MOON_ME').

    Returns:
        LunarCartesianPosition with X, Y, Z, frame, units, and datum metadata.

    Raises:
        ValueError: If coordinates are out of bounds or non-finite.
    """
    if not (math.isfinite(latitude_deg) and math.isfinite(longitude_deg) and math.isfinite(elevation_km)):
        raise ValueError("Latitude, longitude, and elevation must be finite numbers.")
    if not -90.0 <= latitude_deg <= 90.0:
        raise ValueError(
            f"Latitude must be between -90.0 and +90.0 degrees, got {latitude_deg}"
        )
    if not -180.0 <= longitude_deg <= 180.0:
        raise ValueError(
            f"Longitude must be between -180.0 and +180.0 degrees, got {longitude_deg}"
        )
    if not math.isfinite(radius_km) or radius_km <= 0.0:
        raise ValueError(f"Reference radius must be positive and finite, got {radius_km}")

    r_km = radius_km + float(elevation_km)
    if r_km <= 0.0:
        raise ValueError(f"Radial distance (radius + elevation) must be strictly positive, got {r_km}")

    lat_rad = math.radians(latitude_deg)
    lon_rad = math.radians(longitude_deg)

    x = r_km * math.cos(lat_rad) * math.cos(lon_rad)
    y = r_km * math.cos(lat_rad) * math.sin(lon_rad)
    z = r_km * math.sin(lat_rad)

    return LunarCartesianPosition(
        x_km=float(x),
        y_km=float(y),
        z_km=float(z),
        radius_km=float(r_km),
        frame=frame,
        units="km",
        datum="SPHERICAL_MEAN_RADIUS",
    )


def cartesian_to_selenographic(
    position_km: Union[np.ndarray, Sequence[float]],
    radius_km: float = LUNAR_MEAN_RADIUS_KM,
) -> Tuple[float, float, float]:
    """Convert Moon-centered Cartesian coordinates back to selenographic coordinates.

    Mathematical Formulation:
        r = sqrt(X^2 + Y^2 + Z^2)
        latitude = arcsin(Z / r)
        longitude = atan2(Y, X)
        elevation_km = r - radius_km

    Args:
        position_km: 3-element vector [X, Y, Z] in kilometers.
        radius_km: Lunar reference datum radius (default 1737.4 km).

    Returns:
        Tuple of (latitude_deg, longitude_deg, elevation_km).

    Raises:
        ValueError: If position is non-finite, invalid dimension, or zero magnitude.
    """
    pos = np.asarray(position_km, dtype=np.float64)
    if pos.shape != (3,):
        raise ValueError(f"Position vector must have shape (3,), got {pos.shape}")
    if not np.all(np.isfinite(pos)):
        raise ValueError(f"Position vector contains non-finite values: {pos}")

    x, y, z = float(pos[0]), float(pos[1]), float(pos[2])
    r_km = math.sqrt(x * x + y * y + z * z)
    if r_km < 1e-9:
        raise ValueError("Position vector magnitude is near zero (at lunar center of mass).")

    lat_rad = math.asin(np.clip(z / r_km, -1.0, 1.0))
    lon_rad = math.atan2(y, x)

    lat_deg = math.degrees(lat_rad)
    lon_deg = math.degrees(lon_rad)
    elevation_km = r_km - radius_km

    return lat_deg, lon_deg, elevation_km
