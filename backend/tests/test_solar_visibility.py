"""Unit tests for solar visibility, disk illumination, and window segmentation."""

from datetime import datetime, timedelta, timezone
import math
import pytest

from app.schemas.mission import EphemerisSample, SolarElevationReference, WindowType
from app.science.visibility.solar import (
    compute_solar_disk_fraction,
    evaluate_solar_visibility,
    segment_solar_windows,
)


def test_solar_disk_fraction_geometric_bounds():
    """Verify illumination fraction boundaries and symmetry."""
    # 1. Sun well below horizon
    assert compute_solar_disk_fraction(sun_center_elev_deg=-1.0, horizon_elev_deg=0.0) == 0.0

    # 2. Sun well above horizon
    assert compute_solar_disk_fraction(sun_center_elev_deg=1.0, horizon_elev_deg=0.0) == 1.0

    # 3. Sun center exactly at horizon -> exact 50% area
    frac_center = compute_solar_disk_fraction(sun_center_elev_deg=0.0, horizon_elev_deg=0.0)
    assert math.isclose(frac_center, 0.5, abs_tol=1e-5)

    # 4. Sun center at upper limb boundary (center = -0.267 deg) -> 0.0
    assert math.isclose(
        compute_solar_disk_fraction(sun_center_elev_deg=-0.267, horizon_elev_deg=0.0),
        0.0,
        abs_tol=1e-5,
    )

    # 5. Sun center at lower limb boundary (center = +0.267 deg) -> 1.0
    assert math.isclose(
        compute_solar_disk_fraction(sun_center_elev_deg=0.267, horizon_elev_deg=0.0),
        1.0,
        abs_tol=1e-5,
    )


def test_solar_visibility_reference_modes():
    """Verify differences between CENTER_OF_DISK and UPPER_LIMB reference modes."""
    # Sun center at -0.1 deg (upper limb at +0.167 deg)
    _, _, vis_center = evaluate_solar_visibility(
        sun_azimuth_deg=90.0,
        sun_center_elevation_deg=-0.1,
        horizon_elevation_deg=0.0,
        reference=SolarElevationReference.CENTER_OF_DISK,
    )
    assert vis_center is False

    _, _, vis_upper = evaluate_solar_visibility(
        sun_azimuth_deg=90.0,
        sun_center_elevation_deg=-0.1,
        horizon_elevation_deg=0.0,
        reference=SolarElevationReference.UPPER_LIMB,
    )
    assert vis_upper is True


def test_segment_solar_windows_alternating():
    """Verify segmentation of alternating sunlight and darkness periods."""
    t0 = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
    samples = []

    # 10 hours of sunlight (elev = +2.0 deg)
    for i in range(10):
        t = t0 + timedelta(hours=i)
        samples.append(
            EphemerisSample(
                timestamp_utc=t,
                sun_azimuth_deg=float(i * 10),
                sun_center_elevation_deg=2.0,
                sun_upper_limb_elevation_deg=2.267,
                solar_disk_illumination_fraction=1.0,
                is_sun_visible=True,
                earth_azimuth_deg=180.0,
                earth_center_elevation_deg=5.0,
                is_earth_line_of_sight=True,
            )
        )

    # 10 hours of darkness (elev = -2.0 deg)
    for i in range(10, 20):
        t = t0 + timedelta(hours=i)
        samples.append(
            EphemerisSample(
                timestamp_utc=t,
                sun_azimuth_deg=float(i * 10),
                sun_center_elevation_deg=-2.0,
                sun_upper_limb_elevation_deg=-1.733,
                solar_disk_illumination_fraction=0.0,
                is_sun_visible=False,
                earth_azimuth_deg=180.0,
                earth_center_elevation_deg=5.0,
                is_earth_line_of_sight=True,
            )
        )

    windows, metrics = segment_solar_windows(samples)

    assert len(windows) == 2
    assert windows[0].window_type == WindowType.SUNLIGHT
    assert windows[0].duration_hours == 10.0
    assert windows[0].peak_solar_elevation_deg == 2.0

    assert windows[1].window_type == WindowType.DARKNESS
    assert windows[1].duration_hours == 9.0

    assert metrics["longest_continuous_sunlight_hours"] == 10.0
    assert metrics["longest_continuous_darkness_hours"] == 9.0
