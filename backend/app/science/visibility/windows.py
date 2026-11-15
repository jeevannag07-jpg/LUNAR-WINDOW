"""Operational window segmentation and mission summary compilation."""

from __future__ import annotations

from typing import List, Tuple

from app.schemas.mission import EphemerisSample, MissionSummary, OperationalWindow, WindowType


def segment_combined_opportunity_windows(
    samples: List[EphemerisSample],
) -> Tuple[List[OperationalWindow], dict]:
    """Segment an ephemeris time series into contiguous COMBINED_OPPORTUNITY windows.

    A combined opportunity occurs when both sunlight illumination (is_sun_visible)
    and Earth line-of-sight (is_earth_line_of_sight) are simultaneously active.

    Args:
        samples: Chronologically ordered list of EphemerisSample objects.

    Returns:
        Tuple of (list of OperationalWindow objects, summary metrics dict).
    """
    if not samples:
        return [], {
            "combined_opportunity_hours": 0.0,
            "combined_opportunity_percentage": 0.0,
        }

    windows: List[OperationalWindow] = []
    in_combined = samples[0].is_sun_visible and samples[0].is_earth_line_of_sight
    window_start = samples[0].timestamp_utc if in_combined else None

    total_combined_sec = 0.0

    for i in range(1, len(samples)):
        s_prev = samples[i - 1]
        s_curr = samples[i]
        curr_state = s_curr.is_sun_visible and s_curr.is_earth_line_of_sight
        prev_state = s_prev.is_sun_visible and s_prev.is_earth_line_of_sight

        dt = (s_curr.timestamp_utc - s_prev.timestamp_utc).total_seconds()
        if prev_state:
            total_combined_sec += dt

        if curr_state and not in_combined:
            # Entering combined window
            in_combined = True
            window_start = s_curr.timestamp_utc
        elif not curr_state and in_combined:
            # Exiting combined window
            in_combined = False
            window_end = s_curr.timestamp_utc
            if window_start is not None:
                dur_hours = (window_end - window_start).total_seconds() / 3600.0
                windows.append(
                    OperationalWindow(
                        window_type=WindowType.COMBINED_OPPORTUNITY,
                        start_time_utc=window_start,
                        end_time_utc=window_end,
                        duration_hours=dur_hours,
                    )
                )
                window_start = None

    # Handle trailing combined window
    if in_combined and window_start is not None:
        window_end = samples[-1].timestamp_utc
        dur_hours = (window_end - window_start).total_seconds() / 3600.0
        windows.append(
            OperationalWindow(
                window_type=WindowType.COMBINED_OPPORTUNITY,
                start_time_utc=window_start,
                end_time_utc=window_end,
                duration_hours=dur_hours,
            )
        )

    total_duration_sec = (samples[-1].timestamp_utc - samples[0].timestamp_utc).total_seconds()
    comb_pct = (total_combined_sec / total_duration_sec * 100.0) if total_duration_sec > 0 else 0.0

    metrics = {
        "combined_opportunity_hours": total_combined_sec / 3600.0,
        "combined_opportunity_percentage": min(100.0, max(0.0, comb_pct)),
    }

    return windows, metrics


def build_mission_summary(
    samples: List[EphemerisSample],
    solar_metrics: dict,
    earth_metrics: dict,
    combined_metrics: dict,
) -> MissionSummary:
    """Compile cumulative operational metrics across the evaluated mission epoch."""
    if not samples:
        return MissionSummary(
            total_duration_hours=0.0,
            total_sunlight_hours=0.0,
            sunlight_percentage=0.0,
            total_earth_line_of_sight_hours=0.0,
            earth_line_of_sight_percentage=0.0,
            combined_opportunity_hours=0.0,
            combined_opportunity_percentage=0.0,
            longest_continuous_sunlight_hours=0.0,
            longest_continuous_darkness_hours=0.0,
        )

    total_duration_hours = (samples[-1].timestamp_utc - samples[0].timestamp_utc).total_seconds() / 3600.0

    return MissionSummary(
        total_duration_hours=total_duration_hours,
        total_sunlight_hours=solar_metrics.get("total_sunlight_hours", 0.0),
        sunlight_percentage=solar_metrics.get("sunlight_percentage", 0.0),
        total_earth_line_of_sight_hours=earth_metrics.get("total_earth_line_of_sight_hours", 0.0),
        earth_line_of_sight_percentage=earth_metrics.get("earth_line_of_sight_percentage", 0.0),
        combined_opportunity_hours=combined_metrics.get("combined_opportunity_hours", 0.0),
        combined_opportunity_percentage=combined_metrics.get("combined_opportunity_percentage", 0.0),
        longest_continuous_sunlight_hours=solar_metrics.get("longest_continuous_sunlight_hours", 0.0),
        longest_continuous_darkness_hours=solar_metrics.get("longest_continuous_darkness_hours", 0.0),
    )
