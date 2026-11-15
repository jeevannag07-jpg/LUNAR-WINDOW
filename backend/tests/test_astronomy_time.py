"""Unit tests for UTC-to-ET conversions, timezone normalization, and time-scale metadata."""

from datetime import datetime, timedelta, timezone
import pytest

from app.science.astronomy.time import (
    et_to_utc,
    get_epoch_metadata,
    utc_to_et,
    validate_and_normalize_utc,
)
from app.services.spice_manager import SpiceError, SpiceManager


@pytest.fixture(scope="module", autouse=True)
def load_lunar_spice_kernels():
    """Ensure kernels are loaded for time tests."""
    manager = SpiceManager(kernel_dir="data/kernels")
    manager.load_kernels()
    yield
    SpiceManager.unload_all()


def test_reject_naive_timestamp():
    """Verify that naive datetimes (missing timezone) are strictly rejected."""
    naive_dt = datetime(2027, 1, 1, 0, 0, 0)
    with pytest.raises(ValueError) as exc_info:
        validate_and_normalize_utc(naive_dt)
    assert "naive" in str(exc_info.value).lower()


def test_timezone_normalization_to_utc():
    """Verify that timezone-aware timestamps with non-UTC offsets normalize accurately."""
    # UTC+5:30 (e.g. IST)
    tz_ist = timezone(timedelta(hours=5, minutes=30))
    dt_ist = datetime(2027, 1, 1, 5, 30, 0, tzinfo=tz_ist)

    normalized = validate_and_normalize_utc(dt_ist)
    assert normalized.tzinfo == timezone.utc
    assert normalized.year == 2027
    assert normalized.month == 1
    assert normalized.day == 1
    assert normalized.hour == 0
    assert normalized.minute == 0
    assert normalized.second == 0


def test_utc_to_et_conversion_matches_published_naif_standard():
    """Verify UTC-to-ET conversion against published NAIF J2000 leap-second benchmark.
    
    Published NAIF benchmark:
    At 2000-01-01 12:00:00 UTC, TAI-UTC was 32s, and TDB = TAI + 32.184s.
    Therefore, ET = 64.183927284 seconds past J2000.
    """
    dt_j2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    et = utc_to_et(dt_j2000)

    # Within 1 millisecond of official NAIF reference
    assert pytest.approx(et, abs=1e-3) == 64.183927


def test_utc_et_roundtrip_precision():
    """Verify that converting UTC -> ET -> UTC roundtrips with sub-microsecond precision."""
    dt_orig = datetime(2027, 7, 20, 20, 17, 43, 123456, tzinfo=timezone.utc)
    et = utc_to_et(dt_orig)
    dt_roundtrip = et_to_utc(et, precision=6)

    assert dt_roundtrip == dt_orig


def test_get_epoch_metadata_completeness():
    """Verify that EpochMetadata captures UTC, ET, Julian Date and time scale."""
    dt = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    meta = get_epoch_metadata(dt)

    assert meta.timestamp_utc == dt
    assert meta.time_scale == "TDB"
    assert meta.et_seconds_past_j2000 > 8.5e8  # 2027 is ~8.5e8 s past J2000
    assert meta.julian_date_et > 2461406.0


def test_conversion_fails_cleanly_when_lsk_unloaded():
    """Verify that attempting conversion without a loaded LSK raises SpiceError."""
    SpiceManager.unload_all()
    dt = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    with pytest.raises(SpiceError) as exc_info:
        utc_to_et(dt)
    assert "leapseconds kernel" in str(exc_info.value).lower()
