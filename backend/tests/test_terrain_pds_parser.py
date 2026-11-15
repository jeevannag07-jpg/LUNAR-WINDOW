"""Unit tests for PDS3 label parser and metadata validation."""

import pytest

from app.science.terrain.pds_label_parser import PDSLabelParser

AUTHORITATIVE_LBL_TEXT = """
PDS_VERSION_ID            = "PDS3"
FILE_NAME                 = "LDEM_80S_20M.IMG"
RECORD_TYPE               = FIXED_LENGTH
RECORD_BYTES              = 60800
FILE_RECORDS              = 30400

OBJECT                    = IMAGE
  LINES                   = 30400
  LINE_SAMPLES            = 30400
  DERIVED_MINIMUM         = -14594
  DERIVED_MAXIMUM         = 14054
  SAMPLE_TYPE             = LSB_INTEGER
  SAMPLE_BITS             = 16
  UNIT                    = METER
  SCALING_FACTOR          = 0.5
  OFFSET                  = 1737400.
END_OBJECT                = IMAGE

OBJECT                    = IMAGE_MAP_PROJECTION
  MAP_PROJECTION_TYPE          = "POLAR STEREOGRAPHIC"
  MAP_RESOLUTION               = 1516.17 <pix/deg>
  A_AXIS_RADIUS                = 1737.4 <km>
  B_AXIS_RADIUS                = 1737.4 <km>
  C_AXIS_RADIUS                = 1737.4 <km>
  CENTER_LATITUDE              = -90 <deg>
  CENTER_LONGITUDE             = 0 <deg>
  MAP_SCALE                    = 20 <m/pix>
  MAXIMUM_LATITUDE             = -80 <deg>
  MINIMUM_LATITUDE             = -90 <deg>
  LINE_PROJECTION_OFFSET       = 15199.5 <pix>
  SAMPLE_PROJECTION_OFFSET     = 15199.5 <pix>
  COORDINATE_SYSTEM_NAME       = "MEAN EARTH/POLAR AXIS OF DE421"
  COORDINATE_SYSTEM_TYPE       = "BODY-FIXED ROTATING"
END_OBJECT                    = IMAGE_MAP_PROJECTION
END
"""


def test_parse_authoritative_label():
    """Verify parsing of verbatim NASA LOLA LDEM_80S_20M label."""
    meta = PDSLabelParser.parse_text(AUTHORITATIVE_LBL_TEXT)

    assert meta.product_id == "LDEM_80S_20M"
    assert meta.lines == 30400
    assert meta.line_samples == 30400
    assert meta.map_scale_m_pix == 20.0
    assert meta.map_resolution_pix_deg == 1516.17
    assert meta.scaling_factor == 0.5
    assert meta.offset_m == 1737400.0
    assert meta.line_projection_offset == 15199.5
    assert meta.sample_projection_offset == 15199.5
    assert meta.sample_type == "LSB_INTEGER"
    assert meta.sample_bits == 16
    assert meta.map_projection_type == "POLAR STEREOGRAPHIC"
    assert meta.coordinate_system_name == "MEAN EARTH/POLAR AXIS OF DE421"
    assert meta.derived_minimum == -14594
    assert meta.derived_maximum == 14054
    # Crucial provenance verification: LDEM_80S_20M.LBL does NOT declare a NoData sentinel
    assert meta.nodata_value is None
    assert meta.has_documented_nodata is False


def test_parse_label_with_explicit_null():
    """Verify parsing when an explicit NULL sentinel is declared in metadata."""
    text_with_null = AUTHORITATIVE_LBL_TEXT.replace(
        "OFFSET                  = 1737400.",
        "OFFSET                  = 1737400.\n  NULL                    = -32768"
    )
    meta = PDSLabelParser.parse_text(text_with_null)
    assert meta.nodata_value == -32768
    assert meta.has_documented_nodata is True


def test_reject_unsupported_projection():
    """Verify that non-polar projections are rejected."""
    bad_text = AUTHORITATIVE_LBL_TEXT.replace('"POLAR STEREOGRAPHIC"', '"MERCATOR"')
    with pytest.raises(ValueError, match="Unsupported MAP_PROJECTION_TYPE"):
        PDSLabelParser.parse_text(bad_text)


def test_reject_unsupported_sample_type_msb():
    """Verify that big-endian (MSB) integer rasters are rejected."""
    bad_text = AUTHORITATIVE_LBL_TEXT.replace("LSB_INTEGER", "MSB_INTEGER")
    with pytest.raises(ValueError, match="Unsupported SAMPLE_TYPE"):
        PDSLabelParser.parse_text(bad_text)


def test_reject_unsupported_sample_bits():
    """Verify that non-16-bit rasters are rejected."""
    bad_text = AUTHORITATIVE_LBL_TEXT.replace("SAMPLE_BITS             = 16", "SAMPLE_BITS             = 32")
    with pytest.raises(ValueError, match="Unsupported SAMPLE_BITS"):
        PDSLabelParser.parse_text(bad_text)


def test_reject_contradictory_latitudes():
    """Verify rejection when MINIMUM_LATITUDE > MAXIMUM_LATITUDE."""
    bad_text = AUTHORITATIVE_LBL_TEXT.replace("MINIMUM_LATITUDE             = -90", "MINIMUM_LATITUDE             = -70")
    with pytest.raises(ValueError, match="Contradictory latitude bounds"):
        PDSLabelParser.parse_text(bad_text)


def test_reject_contradictory_derived_bounds():
    """Verify rejection when DERIVED_MINIMUM > DERIVED_MAXIMUM."""
    bad_text = AUTHORITATIVE_LBL_TEXT.replace("DERIVED_MINIMUM         = -14594", "DERIVED_MINIMUM         = 20000")
    with pytest.raises(ValueError, match="Contradictory derived bounds"):
        PDSLabelParser.parse_text(bad_text)


def test_reject_missing_mandatory_keyword():
    """Verify rejection when a required keyword (e.g. LINES) is missing."""
    bad_text = AUTHORITATIVE_LBL_TEXT.replace("LINES                   = 30400", "")
    with pytest.raises(ValueError, match="Missing mandatory PDS keyword"):
        PDSLabelParser.parse_text(bad_text)


def test_comment_stripping():
    """Verify that block comments /* ... */ containing keywords do not pollute parsing."""
    text_with_comment = AUTHORITATIVE_LBL_TEXT.replace(
        "LINES                   = 30400",
        "/* LINES = 99999 */\nLINES = 30400"
    )
    meta = PDSLabelParser.parse_text(text_with_comment)
    assert meta.lines == 30400
