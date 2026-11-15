"""Unit tests for Earth line-of-sight and combined opportunity segmentation."""

from datetime import datetime, timedelta, timezone
import pytest

from app.schemas.mission import EphemerisSample, WindowType
from app.science.visibility.earth import evaluate_earth_visibility, segment_earth_windows
from app.science.visibility.windows import segment_combined_opportunity_windows


def test_earth_visibility_thresholds():
    """Verify Earth visibility against terrain horizon and elevation thresholds."""
    # Earth above horizon and cutoff
    assert evaluate_earth_visibility(
        earth_azimuth_deg=0.0,
        earth_center_elevation_deg=5.0,
        horizon_elevation_deg=1.0,
        min_earth_elevation_deg=2.0,
    ) is True

    # Earth below topographic horizon
    assert evaluate_earth_visibility(
        earth_azimuth_deg=0.0,
        earth_center_elevation_deg=2.0,
        horizon_elevation_deg=3.0,
        min_earth_elevation_deg=0.0,
    ) is False

    # Earth below user cutoff threshold
    assert evaluate_earth_visibility(
        earth_azimuth_deg=0.0,
        earth_center_elevation_deg=4.0,
        horizon_elevation_deg=1.0,
        min_earth_elevation_deg=5.0,
    ) is False


def test_combined_opportunity_window_segmentation():
    """Verify segmentation of simultaneous sunlight and Earth line-of-sight windows."""
    t0 = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
    samples = []

    # 4 hours of: Sun visible, Earth visible -> Combined
    for i in range(4):
        samples.append(
            EphemerisSample(
                timestamp_utc=t0 + timedelta(hours=i),
                sun_azimuth_deg=0.0,
                sun_center_elevation_deg=2.0,
                sun_upper_limb_elevation_deg=2.267,
                solar_disk_illumination_fraction=1.0,
                is_sun_visible=True,
                earth_azimuth_deg=180.0,
                earth_center_elevation_deg=5.0,
                is_earth_line_of_sight=True,
            )
        )

    # 4 hours of: Sun visible, Earth OCCULTED -> Not combined
    for i in range(4, 8):
        samples.append(
            EphemerisSample(
                timestamp_utc=t0 + timedelta(hours=i),
                sun_azimuth_deg=0.0,
                sun_center_elevation_deg=2.0,
                sun_upper_limb_elevation_deg=2.267,
                solar_disk_illumination_fraction=1.0,
                is_sun_visible=True,
                earth_azimuth_deg=180.0,
                earth_center_elevation_deg=-5.0,
                is_earth_line_of_sight=False,
            )
        )

    comb_windows, metrics = segment_combined_opportunity_windows(samples)

    assert len(comb_windows) == 1
    assert comb_windows[0].window_type == WindowType.COMBINED_OPPORTUNITY
    assert comb_windows[0].duration_hours == 4.0
    assert metrics["combined_opportunity_hours"] == 4.0
