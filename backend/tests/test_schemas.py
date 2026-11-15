"""Unit tests for Stage 2 scientific data contracts, coordinate models, and disclosures."""

from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError

from app.schemas.coordinates import (
    CANDIDATE_LUNAR_SITES,
    CoordinateFrame,
    SelenographicCoordinates,
)
from app.schemas.disclosure import (
    DataProvenance,
    DataQualityStatus,
    ScientificDisclosure,
    TerrainFidelity,
)
from app.schemas.mission import (
    MissionVisibilityRequest,
    SolarElevationReference,
)


# --- 1. Coordinate Validation Tests ---

def test_valid_selenographic_coordinates():
    """Verify valid lunar coordinates within geodetic limits."""
    coords = SelenographicCoordinates(
        latitude_deg=-89.44,
        longitude_deg=138.0,
        elevation_m=1100.0,
    )
    assert coords.latitude_deg == -89.44
    assert coords.longitude_deg == 138.0
    assert coords.elevation_m == 1100.0
    assert coords.frame == CoordinateFrame.MOON_ME


def test_invalid_latitude_exceeds_positive_bound():
    """Verify latitude > 90 is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        SelenographicCoordinates(latitude_deg=90.01, longitude_deg=0.0)
    assert "latitude_deg" in str(exc_info.value)


def test_invalid_latitude_exceeds_negative_bound():
    """Verify latitude < -90 is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        SelenographicCoordinates(latitude_deg=-90.01, longitude_deg=0.0)
    assert "latitude_deg" in str(exc_info.value)


def test_invalid_longitude_exceeds_positive_bound():
    """Verify longitude > 180 is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        SelenographicCoordinates(latitude_deg=0.0, longitude_deg=180.01)
    assert "longitude_deg" in str(exc_info.value)


def test_invalid_longitude_exceeds_negative_bound():
    """Verify longitude < -180 is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        SelenographicCoordinates(latitude_deg=0.0, longitude_deg=-180.01)
    assert "longitude_deg" in str(exc_info.value)


def test_candidate_sites_integrity():
    """Verify pre-curated candidate landing sites are well-formed."""
    assert len(CANDIDATE_LUNAR_SITES) >= 4
    site_ids = [s.site_id for s in CANDIDATE_LUNAR_SITES]
    assert "shackleton_connecting_ridge" in site_ids
    assert "malapert_mountain" in site_ids
    assert "apollo_11_tranquility" in site_ids


# --- 2. Datetime & Mission Request Tests ---

def test_naive_timestamp_rejected():
    """Verify that naive datetimes without timezone offset are strictly rejected."""
    site = SelenographicCoordinates(latitude_deg=-85.0, longitude_deg=0.0)
    with pytest.raises(ValidationError) as exc_info:
        MissionVisibilityRequest(
            site=site,
            start_time_utc=datetime(2027, 1, 1, 0, 0, 0),  # Naive
            end_time_utc=datetime(2027, 1, 14, 0, 0, 0, tzinfo=timezone.utc),
        )
    assert "timezone-aware" in str(exc_info.value)


def test_timezone_normalization_to_utc():
    """Verify non-UTC timezone-aware timestamps are normalized to UTC."""
    site = SelenographicCoordinates(latitude_deg=-85.0, longitude_deg=0.0)
    # UTC+5:30 (IST)
    tz_ist = timezone(timedelta(hours=5, minutes=30))
    start_ist = datetime(2027, 1, 1, 5, 30, 0, tzinfo=tz_ist)
    end_ist = datetime(2027, 1, 14, 5, 30, 0, tzinfo=tz_ist)

    req = MissionVisibilityRequest(
        site=site,
        start_time_utc=start_ist,
        end_time_utc=end_ist,
    )
    # Normalized to 00:00:00 UTC
    assert req.start_time_utc.tzinfo == timezone.utc
    assert req.start_time_utc.hour == 0
    assert req.start_time_utc.minute == 0
    assert req.end_time_utc.tzinfo == timezone.utc
    assert req.end_time_utc.hour == 0


def test_invalid_time_ordering():
    """Verify end time <= start time is rejected."""
    site = SelenographicCoordinates(latitude_deg=-85.0, longitude_deg=0.0)
    start = datetime(2027, 1, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2027, 1, 5, 0, 0, 0, tzinfo=timezone.utc)

    with pytest.raises(ValidationError) as exc_info:
        MissionVisibilityRequest(
            site=site,
            start_time_utc=start,
            end_time_utc=end,
        )
    assert "end_time_utc must be strictly later than start_time_utc" in str(exc_info.value)


def test_duration_exceeding_180_days():
    """Verify that requests spanning more than 180 days are rejected."""
    site = SelenographicCoordinates(latitude_deg=-85.0, longitude_deg=0.0)
    start = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=181)

    with pytest.raises(ValidationError) as exc_info:
        MissionVisibilityRequest(
            site=site,
            start_time_utc=start,
            end_time_utc=end,
        )
    assert "cannot exceed 180 days" in str(exc_info.value)


def test_invalid_sampling_intervals():
    """Verify invalid sampling intervals (< 1 min or > 1440 min) are rejected."""
    site = SelenographicCoordinates(latitude_deg=-85.0, longitude_deg=0.0)
    start = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=7)

    # Interval = 0
    with pytest.raises(ValidationError):
        MissionVisibilityRequest(
            site=site,
            start_time_utc=start,
            end_time_utc=end,
            sampling_interval_minutes=0,
        )

    # Interval = 1441 (> 24 hours)
    with pytest.raises(ValidationError):
        MissionVisibilityRequest(
            site=site,
            start_time_utc=start,
            end_time_utc=end,
            sampling_interval_minutes=1441,
        )


def test_valid_mission_request():
    """Verify a well-formed mission request succeeds."""
    site = SelenographicCoordinates(latitude_deg=-89.44, longitude_deg=138.0)
    start = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=14)

    req = MissionVisibilityRequest(
        site=site,
        start_time_utc=start,
        end_time_utc=end,
        sampling_interval_minutes=30,
        min_solar_elevation_deg=1.5,
        solar_elevation_reference=SolarElevationReference.UPPER_LIMB,
        min_earth_elevation_deg=2.0,
    )
    assert req.sampling_interval_minutes == 30
    assert req.min_solar_elevation_deg == 1.5
    assert req.solar_elevation_reference == SolarElevationReference.UPPER_LIMB


# --- 3. Scientific Disclosure Tests ---

def test_valid_scientific_disclosure():
    """Verify valid scientific disclosure with required assumptions and limitations."""
    disclosure = ScientificDisclosure(
        provenance=DataProvenance.REAL_NASA_JPL_HORIZONS,
        ephemeris_source="NASA JPL Horizons API (DE440)",
        coordinate_frame="MOON_ME (IAU Mean Earth / Polar Axis)",
        terrain_fidelity=TerrainFidelity.SPHERICAL_DATUM_ONLY,
        data_quality_status=DataQualityStatus.PRELIMINARY,
        assumptions=[
            "Moon modeled as ideal reference sphere of radius 1737.4 km.",
            "Point observer situated at 0.0 m local elevation above datum.",
        ],
        limitations=[
            "Local topography, crater walls, and boulders are not yet accounted for.",
            "Radio link budget and ground station availability are not computed.",
        ],
    )
    assert disclosure.provenance == DataProvenance.REAL_NASA_JPL_HORIZONS
    assert "decision-support prototype" in disclosure.disclaimer


def test_disclosure_requires_assumptions_and_limitations():
    """Verify empty assumptions or limitations are rejected."""
    with pytest.raises(ValidationError) as exc_info:
        ScientificDisclosure(
            provenance=DataProvenance.ANALYTICAL_APPROXIMATION,
            ephemeris_source="Analytical Model",
            assumptions=[],  # Empty
            limitations=["Some limitation"],
        )
    assert "at least one explicit assumption" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        ScientificDisclosure(
            provenance=DataProvenance.ANALYTICAL_APPROXIMATION,
            ephemeris_source="Analytical Model",
            assumptions=["Some assumption"],
            limitations=[],  # Empty
        )
    assert "at least one explicit limitation" in str(exc_info.value)
