"""Unit tests for HorizonsClient with mocked HTTP transport and deterministic caching."""

from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import httpx
import pytest

from app.services.cache import EphemerisCache
from app.services.horizons_client import HorizonsClient, HorizonsNetworkError
from tests.test_horizons_parser import SAMPLE_HORIZONS_VECTOR_TEXT


@pytest.fixture
def temp_cache_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def test_build_vector_query():
    """Verify construction of Horizons query parameters according to official NASA JPL specification."""
    start = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2027, 1, 14, 0, 0, 0, tzinfo=timezone.utc)

    params = HorizonsClient.build_vector_query(
        target_body="10",
        center="500@301",
        start_time=start,
        end_time=end,
        step_minutes=60,
        vec_table="3",
        vec_corr="NONE",
        time_type="UT",
    )

    assert params["format"] == "json"
    assert params["COMMAND"] == "'10'"
    assert params["CENTER"] == "'500@301'"
    assert params["EPHEM_TYPE"] == "VECTORS"
    assert params["REF_PLANE"] == "'FRAME'"
    assert params["REF_SYSTEM"] == "'ICRF'"
    assert params["START_TIME"] == "'2027-01-01 00:00:00'"
    assert params["STOP_TIME"] == "'2027-01-14 00:00:00'"
    assert params["STEP_SIZE"] == "'60m'"
    assert params["VEC_TABLE"] == "3"
    assert params["VEC_CORR"] == "'NONE'"
    assert params["TIME_TYPE"] == "'UT'"
    assert params["TIME_DIGITS"] == "'SECONDS'"
    assert params["OUT_UNITS"] == "'KM-S'"
    assert params["CSV_FORMAT"] == "'NO'"


def test_seconds_precision_preserved_in_query_and_parser():
    """Verify that second-level precision in UTC mission timestamps is preserved in queries and parsed output."""
    from app.services.horizons_parser import HorizonsParser
    
    # Verify request query construction preserves seconds
    start = datetime(2027, 7, 20, 20, 17, 43, tzinfo=timezone.utc)
    end = datetime(2027, 7, 21, 1, 54, 5, tzinfo=timezone.utc)
    params = HorizonsClient.build_vector_query(
        target_body="10",
        center="500@301",
        start_time=start,
        end_time=end,
        step_minutes=15,
        time_digits="SECONDS",
    )
    assert params["START_TIME"] == "'2027-07-20 20:17:43'"
    assert params["STOP_TIME"] == "'2027-07-21 01:54:05'"
    assert params["TIME_DIGITS"] == "'SECONDS'"

    # Verify parser extracts exact second and microsecond without truncation
    sample_text = """$$SOE
2461607.345636574 = A.D. 2027-Jul-20 20:17:43.0000 UT
 X = 1.500000000000000E+08 Y = 2.000000000000000E+07 Z = 8.000000000000000E+06
 VX=-4.000000000000000E+00 VY= 2.500000000000000E+01 VZ= 1.000000000000000E+01
 LT= 5.000000000000000E+02 RG= 1.510000000000000E+08 RR=-3.000000000000000E-01
$$EOE"""
    records = HorizonsParser.parse_vector_text(sample_text)
    assert len(records) == 1
    assert records[0].timestamp_utc == datetime(2027, 7, 20, 20, 17, 43, tzinfo=timezone.utc)


@pytest.mark.anyio
async def test_fetch_vectors_cache_miss_queries_api_and_caches(temp_cache_dir):
    """Verify that a cache miss executes HTTP GET and populates the local disk cache."""
    cache = EphemerisCache(cache_dir=temp_cache_dir)

    def mock_handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        assert "COMMAND=%2710%27" in url_str or "COMMAND='10'" in url_str
        assert "VEC_TABLE=3" in url_str
        assert "TIME_TYPE=%27UT%27" in url_str or "TIME_TYPE='UT'" in url_str
        payload = {
            "signature": {"version": "1.2"},
            "result": SAMPLE_HORIZONS_VECTOR_TEXT,
        }
        return httpx.Response(200, json=payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = HorizonsClient(cache=cache, http_client=mock_http)
        start = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
        end = datetime(2027, 1, 1, 1, 0, tzinfo=timezone.utc)

        records = await client.fetch_vectors(
            target_body="10",
            center="500@301",
            start_time=start,
            end_time=end,
            step_minutes=60,
        )

        assert len(records) == 2
        assert records[0].x_km == pytest.approx(1.488342416040854e8)

        # Verify key was written to cache with time_type='UT'
        cache_key = cache.generate_key(
            target_body="10",
            center="500@301",
            start_time_iso=start.isoformat(),
            end_time_iso=end.isoformat(),
            step_minutes=60,
            vec_table="3",
            vec_corr="NONE",
            time_type="UT",
        )
        assert cache.has(cache_key)


@pytest.mark.anyio
async def test_fetch_vectors_cache_hit_bypasses_network(temp_cache_dir):
    """Verify that a cache hit returns parsed records without contacting the network."""
    cache = EphemerisCache(cache_dir=temp_cache_dir)
    start = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
    end = datetime(2027, 1, 1, 1, 0, tzinfo=timezone.utc)

    # Pre-populate cache directly with time_type='UT'
    cache_key = cache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso=start.isoformat(),
        end_time_iso=end.isoformat(),
        step_minutes=60,
        vec_table="3",
        vec_corr="NONE",
        time_type="UT",
    )
    cached_record = {
        "timestamp_utc": start.isoformat(),
        "julian_date": 2461407.5,
        "x_km": 100000.0,
        "y_km": 200000.0,
        "z_km": 300000.0,
        "range_km": 374165.7,
    }
    cache.set(cache_key, {"records": [cached_record]})

    # Transport that fails if called
    def failing_handler(request: httpx.Request) -> httpx.Response:
        pytest.fail("Network was contacted on a cache hit!")

    transport = httpx.MockTransport(failing_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = HorizonsClient(cache=cache, http_client=mock_http)

        records = await client.fetch_vectors(
            target_body="10",
            center="500@301",
            start_time=start,
            end_time=end,
            step_minutes=60,
        )

        assert len(records) == 1
        assert records[0].x_km == 100000.0


@pytest.mark.anyio
async def test_fetch_vectors_rate_limit_429_raises_network_error():
    """Verify that HTTP 429 returns a descriptive HorizonsNetworkError."""
    def rate_limit_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "Too Many Requests"})

    transport = httpx.MockTransport(rate_limit_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = HorizonsClient(http_client=mock_http)
        start = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
        end = datetime(2027, 1, 1, 1, 0, tzinfo=timezone.utc)

        with pytest.raises(HorizonsNetworkError) as exc_info:
            await client.fetch_vectors(
                target_body="10",
                start_time=start,
                end_time=end,
            )
        assert "rate limit exceeded" in str(exc_info.value)


@pytest.mark.anyio
async def test_fetch_vectors_server_error_503_raises_network_error():
    """Verify that HTTP 503 returns a descriptive HorizonsNetworkError."""
    def error_503_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "Service Unavailable"})

    transport = httpx.MockTransport(error_503_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = HorizonsClient(http_client=mock_http)
        start = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
        end = datetime(2027, 1, 1, 1, 0, tzinfo=timezone.utc)

        with pytest.raises(HorizonsNetworkError) as exc_info:
            await client.fetch_vectors(
                target_body="10",
                start_time=start,
                end_time=end,
            )
        assert "server error (HTTP 503)" in str(exc_info.value)


@pytest.mark.anyio
async def test_fetch_vectors_timeout_raises_network_error():
    """Verify that network timeout raises HorizonsNetworkError."""
    def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("Connection timed out to ssd.jpl.nasa.gov")

    transport = httpx.MockTransport(timeout_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = HorizonsClient(http_client=mock_http, timeout=5.0)
        start = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
        end = datetime(2027, 1, 1, 1, 0, tzinfo=timezone.utc)

        with pytest.raises(HorizonsNetworkError) as exc_info:
            await client.fetch_vectors(
                target_body="10",
                start_time=start,
                end_time=end,
            )
        assert "timed out" in str(exc_info.value) or "Failed to communicate" in str(exc_info.value)
