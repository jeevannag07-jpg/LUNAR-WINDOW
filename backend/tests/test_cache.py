"""Unit tests for the EphemerisCache service."""

import concurrent.futures
from pathlib import Path
import tempfile
import pytest

from app.services.cache import EphemerisCache


@pytest.fixture
def temp_cache_dir():
    """Create a temporary directory for cache testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def test_cache_key_determinism():
    """Verify that identical parameters always produce the exact same SHA-256 key."""
    key1 = EphemerisCache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
    )
    key2 = EphemerisCache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
    )
    assert key1 == key2
    assert len(key1) == 64  # SHA-256 hex length


def test_cache_key_different_parameters_differ():
    """Verify that different parameters produce distinct keys."""
    key_base = EphemerisCache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
        vec_table="3",
        vec_corr="NONE",
        time_type="UT",
    )
    # Different target
    key_earth = EphemerisCache.generate_key(
        target_body="399",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
        vec_table="3",
        vec_corr="NONE",
        time_type="UT",
    )
    assert key_base != key_earth

    # Different vec_table
    key_v1 = EphemerisCache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
        vec_table="1",
        vec_corr="NONE",
        time_type="UT",
    )
    assert key_base != key_v1

    # Different vec_corr
    key_lt = EphemerisCache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
        vec_table="3",
        vec_corr="LT",
        time_type="UT",
    )
    assert key_base != key_lt


def test_cache_key_time_type_differ():
    """Verify that changing only time_type produces a strictly different cache key."""
    key_ut = EphemerisCache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
        vec_table="3",
        vec_corr="NONE",
        time_type="UT",
    )
    key_tt = EphemerisCache.generate_key(
        target_body="10",
        center="500@301",
        start_time_iso="2027-01-01T00:00:00Z",
        end_time_iso="2027-01-14T00:00:00Z",
        step_minutes=60,
        vec_table="3",
        vec_corr="NONE",
        time_type="TT",  # Different time scale
    )
    assert key_ut != key_tt


def test_cache_key_includes_all_13_canonical_fields():
    """Verify that every single one of the 13 canonical fields independently alters the cache key."""
    baseline_kwargs = {
        "target_body": "10",
        "center": "500@301",
        "start_time_iso": "2027-01-01T00:00:00Z",
        "end_time_iso": "2027-01-14T00:00:00Z",
        "step_minutes": 60,
        "ref_plane": "FRAME",
        "ref_system": "ICRF",
        "time_type": "UT",
        "vec_corr": "NONE",
        "vec_table": "3",
        "out_units": "KM-S",
        "csv_format": "NO",
        "schema_version": "v1",
    }
    baseline_key = EphemerisCache.generate_key(**baseline_kwargs)

    # 13 variations, altering exactly one field at a time
    variations = [
        ("target_body", "399"),
        ("center", "500@0"),
        ("start_time_iso", "2027-01-01T00:00:01Z"),
        ("end_time_iso", "2027-01-14T00:00:01Z"),
        ("step_minutes", 30),
        ("ref_plane", "ECLIPTIC"),
        ("ref_system", "J2000"),
        ("time_type", "TT"),
        ("vec_corr", "LT"),
        ("vec_table", "1"),
        ("out_units", "AU-D"),
        ("csv_format", "YES"),
        ("schema_version", "v2"),
    ]

    assert len(variations) == 13, "Must test exactly all 13 canonical fields"

    for field_name, altered_value in variations:
        altered_kwargs = dict(baseline_kwargs)
        altered_kwargs[field_name] = altered_value
        altered_key = EphemerisCache.generate_key(**altered_kwargs)
        assert altered_key != baseline_key, f"Field '{field_name}' did not affect cache key!"


def test_cache_set_and_get(temp_cache_dir):
    """Verify setting and getting data from cache."""
    cache = EphemerisCache(cache_dir=temp_cache_dir)
    key = "test_sample_key"
    data = {"sample": "ephemeris", "count": 42}

    assert not cache.has(key)
    assert cache.get(key) is None

    cache.set(key, data)

    assert cache.has(key)
    retrieved = cache.get(key)
    assert retrieved == data


def test_cache_delete_and_clear(temp_cache_dir):
    """Verify individual deletion and clearing the cache directory."""
    cache = EphemerisCache(cache_dir=temp_cache_dir)
    cache.set("k1", {"val": 1})
    cache.set("k2", {"val": 2})

    assert cache.has("k1")
    assert cache.has("k2")

    assert cache.delete("k1") is True
    assert not cache.has("k1")

    # Clear remaining
    cleared_count = cache.clear()
    assert cleared_count == 1
    assert not cache.has("k2")


def test_corrupted_cache_file_handled_gracefully(temp_cache_dir):
    """Verify that corrupted JSON files in cache are treated as cache misses."""
    cache = EphemerisCache(cache_dir=temp_cache_dir)
    key = "corrupted_entry"
    corrupt_file = temp_cache_dir / f"{key}.json"

    with open(corrupt_file, "w", encoding="utf-8") as f:
        f.write("{ INVALID JSON DATA ...")

    assert cache.get(key) is None


def test_concurrent_writes_same_process(temp_cache_dir):
    """Verify concurrent writes across threads do not crash or corrupt the cache."""
    cache = EphemerisCache(cache_dir=temp_cache_dir)
    key = "concurrent_key"

    def write_worker(val: int):
        cache.set(key, {"value": val})
        return cache.get(key)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(write_worker, i) for i in range(20)]
        results = [f.result() for f in futures]

    assert len(results) == 20
    assert cache.has(key)
    final_val = cache.get(key)
    assert isinstance(final_val["value"], int)
