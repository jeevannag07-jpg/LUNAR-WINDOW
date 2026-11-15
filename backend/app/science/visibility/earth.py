"""Earth topocentric line-of-sight evaluation and operational window segmentation."""

from __future__ import annotations

from datetime import datetime
from typing import List, Tuple

from app.schemas.mission import EphemerisSample, OperationalWindow, WindowType


def evaluate_earth_visibility(
    earth_azimuth_deg: float,
    earth_center_elevation_deg: float,
    horizon_elevation_deg: float,
    min_earth_elevation_deg: float = 0.0,
) -> bool:
    """Evaluate whether the Earth center has direct geometric line-of-sight clearing local topography.

    Notice: Geometric line-of-sight does NOT equate to a certified RF communication link.
    Antenna gains, occultation margins, and transmitter link budgets must be independently validated.

    Args:
        earth_azimuth_deg: Earth topocentric azimuth in degrees [0, 360).
        earth_center_elevation_deg: Earth center elevation relative to local horizontal in degrees.
        horizon_elevation_deg: Local terrain horizon elevation angle at Earth azimuth in degrees.
        min_earth_elevation_deg: Minimum elevation cutoff threshold for communication line-of-sight.

    Returns:
        True if Earth center meets or exceeds both the topographic horizon and user cutoff.
    """
    effective_horizon = max(horizon_elevation_deg, min_earth_elevation_deg)
    return earth_center_elevation_deg >= effective_horizon


def segment_earth_windows(
    samples: List[EphemerisSample],
) -> Tuple[List[OperationalWindow], dict]:
    """Segment an ephemeris time series into contiguous EARTH_LINE_OF_SIGHT and EARTH_OCCULTED windows.

    Args:
        samples: Chronologically ordered list of EphemerisSample objects.

    Returns:
        Tuple of (list of OperationalWindow objects, summary metrics dict).
    """
    if not samples:
        return [], {
            "total_earth_line_of_sight_hours": 0.0,
            "earth_line_of_sight_percentage": 0.0,
        }

    windows: List[OperationalWindow] = []
    current_type = (
        WindowType.EARTH_LINE_OF_SIGHT if samples[0].is_earth_line_of_sight else WindowType.EARTH_OCCULTED
    )
    window_start = samples[0].timestamp_utc
    elev_history: List[float] = [samples[0].earth_center_elevation_deg]

    total_los_seconds = 0.0

    for i in range(1, len(samples)):
        s_prev = samples[i - 1]
        s_curr = samples[i]
        sample_state = (
            WindowType.EARTH_LINE_OF_SIGHT if s_curr.is_earth_line_of_sight else WindowType.EARTH_OCCULTED
        )

        dt = (s_curr.timestamp_utc - s_prev.timestamp_utc).total_seconds()
        if s_prev.is_earth_line_of_sight:
            total_los_seconds += dt

        if sample_state != current_type:
            window_end = s_curr.timestamp_utc
            dur_hours = (window_end - window_start).total_seconds() / 3600.0
            min_elev = (
                min(elev_history) if current_type == WindowType.EARTH_LINE_OF_SIGHT else None
            )

            windows.append(
                OperationalWindow(
                    window_type=current_type,
                    start_time_utc=window_start,
                    end_time_utc=window_end,
                    duration_hours=dur_hours,
                    min_earth_elevation_deg=min_elev,
                )
            )

            current_type = sample_state
            window_start = s_curr.timestamp_utc
            elev_history = [s_curr.earth_center_elevation_deg]
        else:
            elev_history.append(s_curr.earth_center_elevation_deg)

    # Final trailing window
    window_end = samples[-1].timestamp_utc
    dur_hours = (window_end - window_start).total_seconds() / 3600.0
    min_elev = min(elev_history) if current_type == WindowType.EARTH_LINE_OF_SIGHT else None

    windows.append(
        OperationalWindow(
            window_type=current_type,
            start_time_utc=window_start,
            end_time_utc=window_end,
            duration_hours=dur_hours,
            min_earth_elevation_deg=min_elev,
        )
    )

    total_duration_sec = (samples[-1].timestamp_utc - samples[0].timestamp_utc).total_seconds()
    los_pct = (total_los_seconds / total_duration_sec * 100.0) if total_duration_sec > 0 else 0.0

    metrics = {
        "total_earth_line_of_sight_hours": total_los_seconds / 3600.0,
        "earth_line_of_sight_percentage": min(100.0, max(0.0, los_pct)),
    }

    return windows, metrics
