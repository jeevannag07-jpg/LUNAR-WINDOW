"""NAIF SPICE lunar orientation and frame transformation service.

Transforms Moon-centered celestial inertial state vectors (ICRF / J2000) into the
body-fixed selenographic Mean Earth / Polar Axis (MOON_ME) frame at specified epochs.

Astrodynamic Specifications:
1. Source Frame: J2000 / ICRF (International Celestial Reference Frame).
   Moon-centered celestial inertial vectors from NASA JPL Horizons.
2. Target Frame: MOON_ME (Mean Earth / Polar Axis system, NAIF Frame ID 31001).
   Cartographic datum for lunar surface exploration (IAU standard, LOLA DEMs).
3. Physical Libration: High-precision numerical orientation evaluated strictly via
   NASA JPL DE440 binary PCK (moon_pa_de440_200625.bpc) and lunar frame kernel
   (moon_de440_250416.tf). Never uses guessed or hardcoded Euler angles.
4. SPICE Routines:
   - pxform: Position vector rotation (3x3 direction cosine matrix).
   - sxform: Full state vector transformation (6x6 matrix including Coriolis and rotational frame rates).
5. Conservation Invariant: Position vector magnitude is strictly invariant under pure rotation.
"""

from typing import List, Sequence, Tuple, Union
import numpy as np
import spiceypy as spice

from app.services.spice_manager import SPICE_LOCK, SpiceError, synchronized_spice


def normalize_frame_name(frame_name: str) -> str:
    """Normalize user/external frame names to official CSPICE recognized tokens.
    
    In CSPICE, the built-in fundamental inertial frame is 'J2000'. Vectors labeled
    as 'ICRF' by external services (e.g. JPL Horizons) are mapped to 'J2000', with
    which ICRF coincides within sub-milliarcsecond precision.
    
    Args:
        frame_name: Input frame string (case-insensitive).
        
    Returns:
        Standardized SPICE frame name.
    """
    clean = frame_name.strip().upper()
    if clean == "ICRF":
        return "J2000"
    return clean


@synchronized_spice
def get_rotation_matrix(
    et: float,
    from_frame: str = "J2000",
    to_frame: str = "MOON_ME",
) -> np.ndarray:
    """Compute the 3x3 orientation rotation matrix between two frames at epoch ET.
    
    Args:
        et: SPICE Ephemeris Time (seconds past J2000).
        from_frame: Source reference frame (default 'J2000' / 'ICRF').
        to_frame: Target reference frame (default 'MOON_ME').
        
    Returns:
        3x3 orthogonal numpy ndarray direction cosine matrix.
        
    Raises:
        SpiceError: If frame is unknown or SPICE kernels are not loaded.
    """
    src = normalize_frame_name(from_frame)
    dst = normalize_frame_name(to_frame)

    try:
        rot_mat = spice.pxform(src, dst, et)
        return np.asarray(rot_mat, dtype=np.float64)
    except Exception as exc:
        raise SpiceError(
            f"CSPICE pxform failed to compute rotation matrix from '{from_frame}' to '{to_frame}' at ET={et}: {str(exc)}. "
            f"Verify that DE440 lunar kernels are furnished via SpiceManager."
        ) from exc


@synchronized_spice
def get_state_transformation_matrix(
    et: float,
    from_frame: str = "J2000",
    to_frame: str = "MOON_ME",
) -> np.ndarray:
    """Compute the 6x6 state transformation matrix (position + velocity) at epoch ET.
    
    Args:
        et: SPICE Ephemeris Time (seconds past J2000).
        from_frame: Source reference frame.
        to_frame: Target reference frame.
        
    Returns:
        6x6 numpy ndarray state transformation matrix.
        
    Raises:
        SpiceError: If frame is unknown or SPICE kernels are not loaded.
    """
    src = normalize_frame_name(from_frame)
    dst = normalize_frame_name(to_frame)

    try:
        state_mat = spice.sxform(src, dst, et)
        return np.asarray(state_mat, dtype=np.float64)
    except Exception as exc:
        raise SpiceError(
            f"CSPICE sxform failed to compute state transformation from '{from_frame}' to '{to_frame}' at ET={et}: {str(exc)}"
        ) from exc


def transform_position(
    position_km: Union[np.ndarray, Sequence[float]],
    et: float,
    from_frame: str = "J2000",
    to_frame: str = "MOON_ME",
) -> np.ndarray:
    """Transform a 3D Cartesian position vector from inertial to body-fixed coordinates.
    
    Mathematical Formulation:
        r_target = R(t) · r_source
        where R(t) = pxform(from_frame, to_frame, et)
        
    Invariants:
        ||r_target|| == ||r_source|| (rotational length conservation)
    
    Args:
        position_km: 3-element vector [X, Y, Z] in kilometers.
        et: SPICE Ephemeris Time in seconds past J2000.
        from_frame: Origin frame (default 'J2000').
        to_frame: Destination frame (default 'MOON_ME').
        
    Returns:
        3-element numpy ndarray [X, Y, Z] in destination frame (kilometers).
        
    Raises:
        ValueError: If input vector is not 3D or contains NaN / Inf values.
        SpiceError: If SPICE transformation fails.
    """
    pos = np.asarray(position_km, dtype=np.float64)
    if pos.shape != (3,):
        raise ValueError(f"Position vector must have shape (3,), got {pos.shape}")
    if not np.all(np.isfinite(pos)):
        raise ValueError(f"Position vector contains non-finite values: {pos}")

    rot_mat = get_rotation_matrix(et=et, from_frame=from_frame, to_frame=to_frame)
    transformed_pos = rot_mat @ pos

    # Verify vector norm preservation within double-precision numerical tolerance (1e-10)
    norm_orig = np.linalg.norm(pos)
    norm_new = np.linalg.norm(transformed_pos)
    if norm_orig > 1e-12:
        rel_diff = abs(norm_new - norm_orig) / norm_orig
        if rel_diff > 1e-9:
            raise SpiceError(
                f"Vector norm preservation violated during pure rotation! Original: {norm_orig}, New: {norm_new}, Rel Diff: {rel_diff}"
            )

    return transformed_pos


def transform_state(
    state_vector: Union[np.ndarray, Sequence[float]],
    et: float,
    from_frame: str = "J2000",
    to_frame: str = "MOON_ME",
) -> np.ndarray:
    """Transform a 6D state vector [X, Y, Z, Vx, Vy, Vz] from inertial to rotating body-fixed frame.
    
    Accounts for rotational frame rates, Coriolis acceleration, and centrifugal frame motion
    using CSPICE sxform.
    
    Args:
        state_vector: 6-element vector [X, Y, Z, Vx, Vy, Vz] (km, km/s).
        et: SPICE Ephemeris Time in seconds past J2000.
        from_frame: Origin frame (default 'J2000').
        to_frame: Destination frame (default 'MOON_ME').
        
    Returns:
        6-element numpy ndarray [X, Y, Z, Vx, Vy, Vz] in destination frame.
        
    Raises:
        ValueError: If input vector is not 6D or contains NaN / Inf values.
        SpiceError: If SPICE transformation fails.
    """
    state = np.asarray(state_vector, dtype=np.float64)
    if state.shape != (6,):
        raise ValueError(f"State vector must have shape (6,), got {state.shape}")
    if not np.all(np.isfinite(state)):
        raise ValueError(f"State vector contains non-finite values: {state}")

    state_mat = get_state_transformation_matrix(et=et, from_frame=from_frame, to_frame=to_frame)
    transformed_state = state_mat @ state

    return transformed_state
