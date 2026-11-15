"""Solar visibility, disk illumination, and operational window segmentation."""

from __future__ import annotations

import math
from datetime import datetime
from typing import List, Optional, Tuple

from app.schemas.mission import EphemerisSample, OperationalWindow, SolarElevationReference, WindowType

# Mean angular semi-diameter of the Sun as viewed from the Moon in degrees (~16 arcmin)
SOLAR_ANGULAR_RADIUS_DEG: float = 0.267


def compute_solar_disk_fraction(
    sun_center_elev_deg: float,
    horizon_elev_deg: float,
    solar_radius_deg: float = SOLAR_ANGULAR_RADIUS_DEG,
) -> float:
    """Calculate the geometric fraction of the solar disk area visible above the local horizon.

    Uses the circular segment area formula:
    fraction = 0.0 when upper limb is below horizon.
    fraction = 1.0 when lower limb is above horizon.
    In between, computes exact circular cap area:
    A(h) = r^2 * (arccos(-x) + x * sqrt(1 - x^2)) / (pi * r^2) where x = (elev - horizon) / r.

    Args:
        sun_center_elev_deg: Topocentric elevation of the Sun's center in degrees.
        horizon_elev_deg: Local horizon elevation angle at solar azimuth in degrees.
        solar_radius_deg: Angular radius of solar disk in degrees.

    Returns:
        Visible disk area fraction in range [0.0, 1.0].
    """
    diff = sun_center_elev_deg - horizon_elev_deg

    if diff <= -solar_radius_deg:
        return 0.0
    if diff >= solar_radius_deg:
        return 1.0

    # Normalized height of center above horizon in [-1, +1]
    x = max(-1.0, min(1.0, diff / solar_radius_deg))
    fraction = (math.acos(-x) + x * math.sqrt(1.0 - x * x)) / math.pi
    return max(0.0, min(1.0, fraction))


def evaluate_solar_visibility(
    sun_azimuth_deg: float,
    sun_center_elevation_deg: float,
    horizon_elevation_deg: float,
    min_solar_elevation_deg: float = 0.0,
    reference: SolarElevationReference = SolarElevationReference.CENTER_OF_DISK,
) -> Tuple[float, float, bool]:
    """Evaluate solar upper limb elevation, disk illumination fraction, and visibility boolean.

    Args:
        sun_azimuth_deg: Solar azimuth in degrees [0, 360).
        sun_center_elevation_deg: Solar center elevation relative to local horizontal in degrees.
        horizon_elevation_deg: Local horizon elevation at solar azimuth in degrees.
        min_solar_elevation_deg: Minimum elevation threshold required for illumination.
        reference: Reference point on solar disk (CENTER_OF_DISK or UPPER_LIMB).

    Returns:
        Tuple of (upper_limb_elevation_deg, illumination_fraction, is_sun_visible).
    """
    upper_limb_elev = sun_center_elevation_deg + SOLAR_ANGULAR_RADIUS_DEG
    fraction = compute_solar_disk_fraction(sun_center_elevation_deg, horizon_elevation_deg)

    effective_horizon = max(horizon_elevation_deg, min_solar_elevation_deg)

    if reference == SolarElevationReference.UPPER_LIMB:
        is_visible = upper_limb_elev >= effective_horizon
    else:  # CENTER_OF_DISK
        is_visible = sun_center_elevation_deg >= effective_horizon

    return upper_limb_elev, fraction, is_visible


def segment_solar_windows(
    samples: List[EphemerisSample],
) -> Tuple[List[OperationalWindow], dict]:
    """Segment a time series of ephemeris samples into contiguous SUNLIGHT and DARKNESS windows.

    Args:
        samples: Chronologically ordered list of EphemerisSample objects.

    Returns:
        Tuple of (list of OperationalWindow objects, summary metrics dict).
    """
    if not samples:
        return [], {
            "total_sunlight_hours": 0.0,
            "sunlight_percentage": 0.0,
            "longest_continuous_sunlight_hours": 0.0,
            "longest_continuous_darkness_hours": 0.0,
        }

    windows: List[OperationalWindow] = []
    current_type = WindowType.SUNLIGHT if samples[0].is_sun_visible else WindowType.DARKNESS
    window_start = samples[0].timestamp_utc
    elev_history: List[float] = [samples[0].sun_center_elevation_deg]

    total_sunlight_seconds = 0.0
    longest_sunlight_sec = 0.0
    longest_darkness_sec = 0.0

    for i in range(1, len(samples)):
        s_prev = samples[i - 1]
        s_curr = samples[i]
        sample_state = WindowType.SUNLIGHT if s_curr.is_sun_visible else WindowType.DARKNESS

        # Accumulate sunlight duration
        dt = (s_curr.timestamp_utc - s_prev.timestamp_utc).total_seconds()
        if s_prev.is_sun_visible:
            total_sunlight_seconds += dt

        if sample_state != current_type:
            # Close previous window
            window_end = s_curr.timestamp_utc
            dur_hours = (window_end - window_start).total_seconds() / 3600.0

            peak_elev = max(elev_history) if current_type == WindowType.SUNLIGHT else None
            mean_elev = (sum(elev_history) / len(elev_history)) if current_type == WindowType.SUNLIGHT else None

            windows.append(
                OperationalWindow(
                    window_type=current_type,
                    start_time_utc=window_start,
                    end_time_utc=window_end,
                    duration_hours=dur_hours,
                    peak_solar_elevation_deg=peak_elev,
                    mean_solar_elevation_deg=mean_elev,
                )
            )

            dur_sec = (window_end - window_start).total_seconds()
            if current_type == WindowType.SUNLIGHT:
                longest_sunlight_sec = max(longest_sunlight_sec, dur_sec)
            else:
                longest_darkness_sec = max(longest_darkness_sec, dur_sec)

            # Start new window
            current_type = sample_state
            window_start = s_curr.timestamp_utc
            elev_history = [s_curr.sun_center_elevation_deg]
        else:
            elev_history.append(s_curr.sun_center_elevation_deg)

    # Final trailing window
    window_end = samples[-1].timestamp_utc
    dur_hours = (window_end - window_start).total_seconds() / 3600.0
    peak_elev = max(elev_history) if current_type == WindowType.SUNLIGHT else None
    mean_elev = (sum(elev_history) / len(elev_history)) if current_type == WindowType.SUNLIGHT else None

    windows.append(
        OperationalWindow(
            window_type=current_type,
            start_time_utc=window_start,
            end_time_utc=window_end,
            duration_hours=dur_hours,
            peak_solar_elevation_deg=peak_elev,
            mean_solar_elevation_deg=mean_elev,
        )
    )

    dur_sec = (window_end - window_start).total_seconds()
    if current_type == WindowType.SUNLIGHT:
        longest_sunlight_sec = max(longest_sunlight_sec, dur_sec)
    else:
        longest_darkness_sec = max(longest_darkness_sec, dur_sec)

    total_duration_sec = (samples[-1].timestamp_utc - samples[0].timestamp_utc).total_seconds()
    sunlight_pct = (total_sunlight_seconds / total_duration_sec * 100.0) if total_duration_sec > 0 else 0.0

    metrics = {
        "total_sunlight_hours": total_sunlight_seconds / 3600.0,
        "sunlight_percentage": min(100.0, max(0.0, sunlight_pct)),
        "longest_continuous_sunlight_hours": longest_sunlight_sec / 3600.0,
        "longest_continuous_darkness_hours": longest_darkness_sec / 3600.0,
    }

    return windows, metrics
