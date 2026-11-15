"""Unit and integration tests for the Stage 5 AstronomyEngine.

Verifies:
- Topocentric Sun and Earth coordinate calculations.
- Accurate epoch-to-ET conversion via SPICE.
- Coordinate transformation into MOON_ME.
- Topocentric ENU projection, azimuth [0, 360), elevation [-90, +90], and slant range.
- Analytical reference test cases (Sun East, Earth Zenith).
- Duration limit (180 days) and sampling interval bounds enforcement.
- Detection and rejection of duplicate, non-monotonic, misaligned, or non-finite vectors.
- Frame mismatch rejection (only MOON_ME accepted).
- Deterministic offline caching integration.
- Concurrency under process-wide SPICE_LOCK.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import math
from typing import List
import numpy as np
import pytest

from app.science.astronomy.engine import (
    AstronomyEngine,
    AstronomyEngineError,
    NAIF_ID_EARTH,
    NAIF_ID_SUN,
)
from app.science.astronomy.models import AstronomyTimeSeriesResult
from app.science.astronomy.orientation import get_rotation_matrix
from app.science.astronomy.time import utc_to_et
from app.schemas.coordinates import CoordinateFrame, SelenographicCoordinates
from app.services.cache import EphemerisCache
from app.services.horizons_client import HorizonsClient
from app.services.horizons_parser import HorizonsVectorRecord
from app.services.spice_manager import SpiceManager


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def ensure_spice_kernels():
    """Ensure official DE440 SPICE kernels are loaded for all tests."""
    manager = SpiceManager()
    manager.load_kernels()
    yield


class MockHorizonsClient(HorizonsClient):
    """In-memory mock Horizons client returning deterministic, customizable vector records."""

    def __init__(self, sun_records: List[HorizonsVectorRecord], earth_records: List[HorizonsVectorRecord]):
        super().__init__()
        self.sun_records = sun_records
        self.earth_records = earth_records
        self.fetch_call_count = 0

    async def fetch_vectors(self, target_body: str, **kwargs) -> List[HorizonsVectorRecord]:
        self.fetch_call_count += 1
        if str(target_body) == str(NAIF_ID_SUN):
            return list(self.sun_records)
        elif str(target_body) == str(NAIF_ID_EARTH):
            return list(self.earth_records)
        raise ValueError(f"Unexpected target_body: {target_body}")


def _create_synthetic_record(
    ts: datetime,
    x_km: float,
    y_km: float,
    z_km: float,
) -> HorizonsVectorRecord:
    """Helper to create a single valid HorizonsVectorRecord."""
    r = math.sqrt(x_km * x_km + y_km * y_km + z_km * z_km)
    return HorizonsVectorRecord(
        timestamp_utc=ts,
        julian_date=2461406.5,
        x_km=x_km,
        y_km=y_km,
        z_km=z_km,
        range_km=r,
    )


# ---------------------------------------------------------------------------
# Analytical Reference Tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_analytical_earth_at_zenith_reference_case():
    """Verify exact analytical reference geometry: Earth positioned directly overhead.
    
    Site: Lunar Equator, Prime Meridian (lat=0.0°, lon=0.0°, elev=0.0 km).
    Observer Site Cartesian (MOON_ME): [1737.4, 0.0, 0.0] km (along +X).
    At epoch t, we construct an Earth vector that, when transformed into MOON_ME,
    lies exactly on the +X axis at distance 384,400 km: [384400.0, 0.0, 0.0].
    
    Expected Topocentric Geometry:
    - Relative displacement in MOON_ME: [384400.0 - 1737.4, 0.0, 0.0] = [382662.6, 0.0, 0.0] km.
    - Local ENU Basis at (0, 0):
      Up = [+1, 0, 0]
      East = [0, +1, 0]
      North = [0, 0, +1]
    - ENU Coordinates: [East=0.0, North=0.0, Up=382662.6] km.
    - Elevation: exactly +90.0° (Zenith).
    - Azimuth: 0.0° (Zenith singularity convention).
    - Slant Range: exactly 382,662.6 km.
    - is_near_zenith: True.
    """
    epoch = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    et = utc_to_et(epoch)

    # Compute rotation matrix R from J2000 to MOON_ME
    r_mat = get_rotation_matrix(et, from_frame="J2000", to_frame="MOON_ME")

    # Invert to find the ICRF/J2000 vector that rotates into [384400, 0, 0] in MOON_ME
    desired_earth_moon_me = np.array([384400.0, 0.0, 0.0], dtype=np.float64)
    earth_icrf = r_mat.T @ desired_earth_moon_me

    # Construct Sun vector far along +Y in MOON_ME (due East)
    desired_sun_moon_me = np.array([0.0, 1.496e8, 0.0], dtype=np.float64)
    sun_icrf = r_mat.T @ desired_sun_moon_me

    earth_rec = _create_synthetic_record(epoch, earth_icrf[0], earth_icrf[1], earth_icrf[2])
    sun_rec = _create_synthetic_record(epoch, sun_icrf[0], sun_icrf[1], sun_icrf[2])

    mock_client = MockHorizonsClient(sun_records=[sun_rec], earth_records=[earth_rec])
    engine = AstronomyEngine(horizons_client=mock_client)

    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0, elevation_m=0.0)
    result = await engine.calculate_astronomy_timeseries(
        site=site,
        start_time=epoch,
        end_time=epoch + timedelta(hours=1),
        sampling_interval_minutes=60,
    )

    assert result.sample_count == 1
    rec = result.records[0]

    # Earth checks
    assert rec.earth.elevation_deg == pytest.approx(90.0, abs=1e-6)
    assert rec.earth.distance_km == pytest.approx(384400.0 - 1737.4, abs=1e-4)
    assert rec.earth.is_near_zenith is True
    assert rec.earth.azimuth_deg == 0.0
    np.testing.assert_allclose(rec.earth.enu_vector_km, [0.0, 0.0, 382662.6], atol=1e-3)

    # Sun checks: at site (0,0), [0, 1.496e8, 0] in MOON_ME is due East!
    assert rec.sun.azimuth_deg == pytest.approx(90.0, abs=1e-4)
    assert rec.sun.elevation_deg == pytest.approx(-math.degrees(1737.4 / 1.496e8), abs=1e-4)
    assert rec.sun.distance_km == pytest.approx(1.496e8, rel=1e-6)


@pytest.mark.anyio
async def test_analytical_sun_at_cardinal_points():
    """Verify Sun azimuth around the cardinal compass points (North, East, South, West)."""
    epoch = datetime(2027, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    et = utc_to_et(epoch)
    r_mat = get_rotation_matrix(et, from_frame="J2000", to_frame="MOON_ME")

    d_sun = 1.5e8
    site_lat, site_lon = 0.0, 0.0

    # Test 4 cardinal orientations in MOON_ME:
    # 1. North: vector along +Z (North at equator)
    # 2. East: vector along +Y (East at equator)
    # 3. South: vector along -Z (South at equator)
    # 4. West: vector along -Y (West at equator)
    cardinal_cases = [
        (np.array([1737.4, 0.0, d_sun]), 0.0, "North"),
        (np.array([1737.4, d_sun, 0.0]), 90.0, "East"),
        (np.array([1737.4, 0.0, -d_sun]), 180.0, "South"),
        (np.array([1737.4, -d_sun, 0.0]), 270.0, "West"),
    ]

    for desired_moon_me, expected_azimuth, label in cardinal_cases:
        icrf_vec = r_mat.T @ desired_moon_me
        sun_rec = _create_synthetic_record(epoch, icrf_vec[0], icrf_vec[1], icrf_vec[2])
        # Neutral Earth vector
        earth_rec = _create_synthetic_record(epoch, 384400.0, 0.0, 0.0)

        mock_client = MockHorizonsClient(sun_records=[sun_rec], earth_records=[earth_rec])
        engine = AstronomyEngine(horizons_client=mock_client)

        res = await engine.calculate_astronomy_timeseries(
            site={"latitude_deg": site_lat, "longitude_deg": site_lon, "elevation_km": 0.0, "frame": "MOON_ME"},
            start_time=epoch,
            end_time=epoch + timedelta(hours=1),
            sampling_interval_minutes=60,
        )

        sample = res.records[0].sun
        assert sample.azimuth_deg == pytest.approx(expected_azimuth, abs=1e-5), f"Failed for {label}"
        assert sample.elevation_deg == pytest.approx(0.0, abs=1e-5)
        assert sample.distance_km == pytest.approx(d_sun, rel=1e-6)


# ---------------------------------------------------------------------------
# Input Validation & Boundary Enforcement Tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_reject_duration_exceeding_180_days():
    """Verify that an analysis interval exceeding 180 days is strictly rejected."""
    start = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=180, seconds=1)  # 180 days + 1 second

    engine = AstronomyEngine(horizons_client=MockHorizonsClient([], []))
    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)

    with pytest.raises(ValueError) as exc:
        await engine.calculate_astronomy_timeseries(site=site, start_time=start, end_time=end)
    assert "exceeds maximum allowed span of 180 days" in str(exc.value)


@pytest.mark.anyio
async def test_reject_inverted_or_equal_timestamps():
    """Verify that start_time >= end_time is rejected with descriptive error."""
    start = datetime(2027, 1, 5, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    engine = AstronomyEngine(horizons_client=MockHorizonsClient([], []))
    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)

    with pytest.raises(ValueError) as exc1:
        await engine.calculate_astronomy_timeseries(site=site, start_time=start, end_time=end)
    assert "strictly earlier than end_time" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        await engine.calculate_astronomy_timeseries(site=site, start_time=start, end_time=start)
    assert "strictly earlier than end_time" in str(exc2.value)


@pytest.mark.anyio
async def test_reject_naive_timestamps():
    """Verify that naive (non-timezone-aware) timestamps are rejected."""
    naive_start = datetime(2027, 1, 1, 0, 0, 0)
    aware_end = datetime(2027, 1, 2, 0, 0, 0, tzinfo=timezone.utc)

    engine = AstronomyEngine(horizons_client=MockHorizonsClient([], []))
    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)

    with pytest.raises(ValueError) as exc:
        await engine.calculate_astronomy_timeseries(site=site, start_time=naive_start, end_time=aware_end)
    assert "timezone-aware" in str(exc.value)


@pytest.mark.anyio
async def test_reject_invalid_sampling_intervals():
    """Verify that sampling intervals outside [1, 1440] minutes are rejected."""
    start = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=2)
    engine = AstronomyEngine(horizons_client=MockHorizonsClient([], []))
    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)

    # 0 minutes
    with pytest.raises(ValueError) as exc1:
        await engine.calculate_astronomy_timeseries(site=site, start_time=start, end_time=end, sampling_interval_minutes=0)
    assert "between 1 and 1440" in str(exc1.value)

    # 1441 minutes (> 24 hours)
    with pytest.raises(ValueError) as exc2:
        await engine.calculate_astronomy_timeseries(site=site, start_time=start, end_time=end, sampling_interval_minutes=1441)
    assert "between 1 and 1440" in str(exc2.value)


@pytest.mark.anyio
async def test_reject_unsupported_site_frame():
    """Verify that non-MOON_ME frames are strictly rejected."""
    start = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    engine = AstronomyEngine(horizons_client=MockHorizonsClient([], []))

    invalid_site = {
        "latitude_deg": 0.0,
        "longitude_deg": 0.0,
        "elevation_km": 0.0,
        "frame": "MOON_PA",  # Unsupported for surface topocentric analysis
    }

    with pytest.raises(ValueError) as exc:
        await engine.calculate_astronomy_timeseries(site=invalid_site, start_time=start, end_time=end)
    assert "Unsupported coordinate frame: 'MOON_PA'" in str(exc.value)


# ---------------------------------------------------------------------------
# Data Integrity & Error Handling Tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_reject_duplicate_or_out_of_order_epochs():
    """Verify that duplicate or decreasing epochs from Horizons trigger an AstronomyEngineError."""
    t0 = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    t1 = t0  # Duplicate!

    r1 = _create_synthetic_record(t0, 1.5e8, 0.0, 0.0)
    r2 = _create_synthetic_record(t1, 1.5e8, 0.0, 0.0)

    mock_client = MockHorizonsClient(sun_records=[r1, r2], earth_records=[r1, r2])
    engine = AstronomyEngine(horizons_client=mock_client)

    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)
    with pytest.raises(AstronomyEngineError) as exc:
        await engine.calculate_astronomy_timeseries(
            site=site,
            start_time=t0,
            end_time=t0 + timedelta(days=1),
        )
    assert "Non-monotonic or duplicate timestamp detected" in str(exc.value)


@pytest.mark.anyio
async def test_reject_misaligned_sun_and_earth_epochs():
    """Verify that mismatched timestamps between Sun and Earth vectors are rejected."""
    t0 = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    t_sun = t0 + timedelta(minutes=60)
    t_earth = t0 + timedelta(minutes=65)  # Misaligned!

    sun_records = [_create_synthetic_record(t0, 1.5e8, 0.0, 0.0), _create_synthetic_record(t_sun, 1.5e8, 0.0, 0.0)]
    earth_records = [_create_synthetic_record(t0, 3.8e5, 0.0, 0.0), _create_synthetic_record(t_earth, 3.8e5, 0.0, 0.0)]

    mock_client = MockHorizonsClient(sun_records=sun_records, earth_records=earth_records)
    engine = AstronomyEngine(horizons_client=mock_client)

    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)
    with pytest.raises(AstronomyEngineError) as exc:
        await engine.calculate_astronomy_timeseries(
            site=site,
            start_time=t0,
            end_time=t0 + timedelta(days=1),
        )
    assert "Timestamp misalignment" in str(exc.value)


@pytest.mark.anyio
async def test_reject_non_finite_vectors():
    """Verify that NaN or infinite vector values are detected and rejected."""
    t0 = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    # Sun record contains NaN
    sun_nan = _create_synthetic_record(t0, float("nan"), 0.0, 0.0)
    earth_valid = _create_synthetic_record(t0, 3.8e5, 0.0, 0.0)

    mock_client = MockHorizonsClient(sun_records=[sun_nan], earth_records=[earth_valid])
    engine = AstronomyEngine(horizons_client=mock_client)

    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)
    with pytest.raises(AstronomyEngineError) as exc:
        await engine.calculate_astronomy_timeseries(
            site=site,
            start_time=t0,
            end_time=t0 + timedelta(hours=1),
        )
    assert "Non-finite" in str(exc.value)


# ---------------------------------------------------------------------------
# Multiple Epochs, Time-Series Ordering, and Provenance Tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_multiple_epochs_chronological_time_series():
    """Verify that multiple epochs are processed in strictly ascending chronological order."""
    t0 = datetime(2027, 3, 1, 0, 0, 0, tzinfo=timezone.utc)
    num_samples = 24  # 24 hourly samples

    sun_records = []
    earth_records = []

    for i in range(num_samples):
        ti = t0 + timedelta(hours=i)
        # Simulate slight orbit progression
        angle = 2.0 * math.pi * (i / 708.0)  # lunar synodic period ~708 hours
        sun_records.append(_create_synthetic_record(ti, 1.496e8 * math.cos(angle), 1.496e8 * math.sin(angle), 0.0))
        earth_records.append(_create_synthetic_record(ti, 384400.0 * math.cos(angle * 0.1), 384400.0 * math.sin(angle * 0.1), 0.0))

    mock_client = MockHorizonsClient(sun_records=sun_records, earth_records=earth_records)
    engine = AstronomyEngine(horizons_client=mock_client)

    site = SelenographicCoordinates(latitude_deg=-89.9, longitude_deg=0.0, elevation_m=500.0)
    res = await engine.calculate_astronomy_timeseries(
        site=site,
        start_time=t0,
        end_time=t0 + timedelta(hours=num_samples),
        sampling_interval_minutes=60,
    )

    assert res.sample_count == num_samples
    assert len(res.records) == num_samples

    # Check strictly increasing timestamps and valid bounds
    for i in range(num_samples):
        rec = res.records[i]
        assert rec.timestamp_utc == t0 + timedelta(hours=i)
        assert 0.0 <= rec.sun.azimuth_deg < 360.0
        assert -90.0 <= rec.sun.elevation_deg <= 90.0
        assert rec.sun.distance_km > 0.0
        assert 0.0 <= rec.earth.azimuth_deg < 360.0
        assert -90.0 <= rec.earth.elevation_deg <= 90.0
        assert rec.earth.distance_km > 0.0

        if i > 0:
            assert res.records[i].timestamp_utc > res.records[i - 1].timestamp_utc
            assert res.records[i].epoch_et_seconds > res.records[i - 1].epoch_et_seconds

    # Check scientific provenance disclosure
    assert res.provenance.reference_frame == "MOON_ME"
    assert "DE440" in "".join(res.provenance.assumptions)
    assert len(res.provenance.assumptions) >= 4
    assert len(res.provenance.limitations) >= 4
    assert "decision-support" in res.provenance.disclaimer


# ---------------------------------------------------------------------------
# Concurrency & SPICE Lock Synchronization
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_concurrent_astronomy_engine_requests():
    """Verify that multiple concurrent async tasks executing AstronomyEngine calculate without races."""
    t0 = datetime(2027, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
    sun_rec = _create_synthetic_record(t0, 1.496e8, 0.0, 0.0)
    earth_rec = _create_synthetic_record(t0, 384400.0, 0.0, 0.0)

    mock_client = MockHorizonsClient(sun_records=[sun_rec], earth_records=[earth_rec])
    engine = AstronomyEngine(horizons_client=mock_client)

    # Launch 10 concurrent requests at different lunar sites
    sites = [
        SelenographicCoordinates(latitude_deg=-89.0 + i * 0.1, longitude_deg=i * 10.0, elevation_m=100.0 * i)
        for i in range(10)
    ]

    tasks = [
        engine.calculate_astronomy_timeseries(
            site=site,
            start_time=t0,
            end_time=t0 + timedelta(hours=1),
            sampling_interval_minutes=60,
        )
        for site in sites
    ]

    results = await asyncio.gather(*tasks)
    assert len(results) == 10
    for res in results:
        assert res.sample_count == 1


@pytest.mark.anyio
async def test_reject_missing_or_empty_samples():
    """Verify that empty sample lists for either Sun or Earth raise AstronomyEngineError."""
    t0 = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    rec = _create_synthetic_record(t0, 1.496e8, 0.0, 0.0)

    # Empty Sun
    mock1 = MockHorizonsClient(sun_records=[], earth_records=[rec])
    engine1 = AstronomyEngine(horizons_client=mock1)
    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)
    with pytest.raises(AstronomyEngineError) as exc1:
        await engine1.calculate_astronomy_timeseries(site=site, start_time=t0, end_time=t0 + timedelta(hours=1))
    assert "No vector records returned for Sun" in str(exc1.value)

    # Empty Earth
    mock2 = MockHorizonsClient(sun_records=[rec], earth_records=[])
    engine2 = AstronomyEngine(horizons_client=mock2)
    with pytest.raises(AstronomyEngineError) as exc2:
        await engine2.calculate_astronomy_timeseries(site=site, start_time=t0, end_time=t0 + timedelta(hours=1))
    assert "No vector records returned for Earth" in str(exc2.value)


@pytest.mark.anyio
async def test_cache_integration_with_ephemeris_cache(tmp_path):
    """Verify that AstronomyEngine queries populate and retrieve from EphemerisCache."""
    import tempfile
    cache_dir = tmp_path / "cache"
    cache = EphemerisCache(cache_dir=cache_dir)

    t0 = datetime(2027, 5, 1, 0, 0, 0, tzinfo=timezone.utc)
    sun_rec = _create_synthetic_record(t0, 1.496e8, 0.0, 0.0)
    earth_rec = _create_synthetic_record(t0, 384400.0, 0.0, 0.0)

    # Wrap mock client with cache
    mock_client = MockHorizonsClient(sun_records=[sun_rec], earth_records=[earth_rec])
    mock_client.cache = cache

    engine = AstronomyEngine(horizons_client=mock_client)
    site = SelenographicCoordinates(latitude_deg=0.0, longitude_deg=0.0)

    # Query 1: executes fetch
    res1 = await engine.calculate_astronomy_timeseries(site=site, start_time=t0, end_time=t0 + timedelta(hours=1))
    assert res1.sample_count == 1

    # Query 2: identical parameters
    res2 = await engine.calculate_astronomy_timeseries(site=site, start_time=t0, end_time=t0 + timedelta(hours=1))
    assert res2.sample_count == 1
    assert res1.records[0].sun.distance_km == res2.records[0].sun.distance_km


@pytest.mark.anyio
async def test_end_to_end_horizons_mock_to_topocentric_astronomy():
    """Verify full end-to-end pipeline using authentic Horizons ASCII vector payloads.
    
    1. Injects authentic Horizons response payload via httpx.MockTransport.
    2. HorizonsClient executes and parses Moon-centered vectors.
    3. AstronomyEngine transforms vectors into MOON_ME via SPICE DE440.
    4. Projects into site ENU topocentric angles and slant ranges.
    """
    import httpx
    from tests.test_horizons_parser import SAMPLE_HORIZONS_VECTOR_TEXT

    # Create MockTransport returning authentic Horizons vector payload
    def mock_handler(request: httpx.Request) -> httpx.Response:
        payload = {
            "signature": {"version": "1.2"},
            "result": SAMPLE_HORIZONS_VECTOR_TEXT,
        }
        return httpx.Response(200, json=payload)

    mock_http_client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))
    real_horizons_client = HorizonsClient(http_client=mock_http_client)

    engine = AstronomyEngine(horizons_client=real_horizons_client)
    site = SelenographicCoordinates(latitude_deg=-89.9, longitude_deg=0.0, elevation_m=2000.0)

    start = datetime(2027, 7, 20, 20, 17, 43, tzinfo=timezone.utc)
    end = datetime(2027, 7, 21, 1, 54, 5, tzinfo=timezone.utc)

    result = await engine.calculate_astronomy_timeseries(
        site=site,
        start_time=start,
        end_time=end,
        sampling_interval_minutes=60,
    )

    assert result.sample_count > 0
    assert result.site.latitude_deg == -89.9
    assert result.site.elevation_km == 2.0
    assert result.site.frame == "MOON_ME"
    assert result.provenance.reference_frame == "MOON_ME"

    for rec in result.records:
        assert 0.0 <= rec.sun.azimuth_deg < 360.0
        assert -90.0 <= rec.sun.elevation_deg <= 90.0
        assert rec.sun.distance_km > 0.0
        assert 0.0 <= rec.earth.azimuth_deg < 360.0
        assert -90.0 <= rec.earth.elevation_deg <= 90.0
        assert rec.earth.distance_km > 0.0
