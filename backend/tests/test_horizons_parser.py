"""Unit tests for the NASA JPL Horizons ASCII and JSON response parser."""

from datetime import datetime, timezone
import pytest

from app.services.horizons_parser import (
    HorizonsAPIError,
    HorizonsParser,
    HorizonsParsingError,
)

SAMPLE_HORIZONS_VECTOR_TEXT = """
*******************************************************************************
 Revised: Jul 31, 2023             Sun / (Solar System Barycenter)            10
 Center-site name: Moon center (500@301)
*******************************************************************************
$$SOE
2461407.500000000 = A.D. 2027-Jan-01 00:00:00.0000 TDB 
 X = 1.488342416040854E+08 Y = 1.624103173770425E+07 Z = 6.994276709849542E+06
 VX=-4.246736209869502E+00 VY= 2.721495944111352E+01 VZ= 1.173852033069151E+01
 LT= 4.995963236720993E+02 RG= 1.498863604118086E+08 RR=-3.076899738981442E-01
2461407.541666667 = A.D. 2027-Jan-01 01:00:00.0000 TDB 
 X = 1.488189531818296E+08 Y = 1.633898711833075E+07 Z = 7.036528795079634E+06
 VX=-4.247585098939763E+00 VY= 2.720473215509939E+01 VZ= 1.173429396115982E+01
 LT= 4.995444148110547E+02 RG= 1.498707886475685E+08 RR=-3.088322648833441E-01
$$EOE
*******************************************************************************
"""


def test_parse_authentic_horizons_vector_payload():
    """Verify parsing of valid Horizons vector table with timestamps, coordinates, and velocity."""
    payload = {
        "signature": {"version": "1.2", "source": "NASA/JPL Horizons API"},
        "result": SAMPLE_HORIZONS_VECTOR_TEXT,
    }

    records = HorizonsParser.parse_json_response(payload)

    assert len(records) == 2

    # Check Epoch 1
    rec1 = records[0]
    assert rec1.timestamp_utc == datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    assert rec1.julian_date == 2461407.5
    assert pytest.approx(rec1.x_km, rel=1e-6) == 1.488342416040854e8
    assert pytest.approx(rec1.y_km, rel=1e-6) == 1.624103173770425e7
    assert pytest.approx(rec1.z_km, rel=1e-6) == 6.994276709849542e6
    assert pytest.approx(rec1.range_km, rel=1e-6) == 1.498863604118086e8
    assert pytest.approx(rec1.vx_km_s, rel=1e-6) == -4.246736209869502
    assert pytest.approx(rec1.light_time_sec, rel=1e-6) == 499.5963236720993

    # Check Epoch 2 (1 hour later)
    rec2 = records[1]
    assert rec2.timestamp_utc == datetime(2027, 1, 1, 1, 0, 0, tzinfo=timezone.utc)
    assert pytest.approx(rec2.range_km, rel=1e-6) == 1.498707886475685e8


def test_parse_horizons_missing_soe_raises_parsing_error():
    """Verify that missing $$SOE markers raise a HorizonsParsingError."""
    payload = {
        "result": "Header text without ephemeris table markers..."
    }
    with pytest.raises(HorizonsParsingError) as exc_info:
        HorizonsParser.parse_json_response(payload)
    assert "No ephemeris table found" in str(exc_info.value)


def test_parse_horizons_error_banner_raises_api_error():
    """Verify that Horizons error messages in the result string raise HorizonsAPIError."""
    payload = {
        "result": "*** ERROR *** Cannot interpret target body code '9999999'"
    }
    with pytest.raises(HorizonsAPIError) as exc_info:
        HorizonsParser.parse_json_response(payload)
    assert "Horizons query failed" in str(exc_info.value)


def test_parse_horizons_top_level_error_key_raises_api_error():
    """Verify that an explicit 'error' key in Horizons JSON raises HorizonsAPIError."""
    payload = {
        "error": "Bad request parameters: STEP_SIZE invalid"
    }
    with pytest.raises(HorizonsAPIError) as exc_info:
        HorizonsParser.parse_json_response(payload)
    assert "NASA JPL Horizons API returned error" in str(exc_info.value)


def test_parse_horizons_empty_table_returns_empty_list():
    """Verify that an empty ephemeris table between $$SOE and $$EOE returns an empty list."""
    payload = {
        "result": "$$SOE\n$$EOE"
    }
    records = HorizonsParser.parse_json_response(payload)
    assert records == []


def test_parse_horizons_unknown_month_raises_parsing_error():
    """Verify that an unparseable month abbreviation raises HorizonsParsingError."""
    bad_table = """
    $$SOE
    2461407.500000000 = A.D. 2027-Foo-01 00:00:00.0000 TDB 
     X = 1.0 Y = 2.0 Z = 3.0
    $$EOE
    """
    with pytest.raises(HorizonsParsingError) as exc_info:
        HorizonsParser.parse_json_response({"result": bad_table})
    assert "Unrecognized month abbreviation" in str(exc_info.value)
