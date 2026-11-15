"""Unit tests for South Polar Stereographic map projection engine."""

import math
import pytest

from app.science.terrain.projection import (
    LAT_BOUNDARY_DEG,
    LAT_CARDINAL_EDGE_BOUNDARY_DEG,
    LAT_CARDINAL_PIXEL_CENTER_DEG,
    LAT_CORNER_BOUNDARY_DEG,
    MAX_GRID_HALF_WIDTH_M,
    RHO_80S_M,
    R_MOON_SPHERE_M,

    is_within_pixel_center_hull,
    is_within_raster_footprint,
    latlon_to_pixel,
    latlon_to_polar_stereo,
    pixel_to_latlon,
    pixel_to_polar_stereo,
    polar_stereo_to_latlon,

    polar_stereo_to_pixel,
)


def test_south_pole_control_point_and_offset_equivalence():
    """Verify that South Pole (lat=-90, lon=0) maps to projection center (X=0, Y=0).

    Demonstrates exact equivalence between:
    - 0-based NumPy index center: (15199.5, 15199.5)
    - 1-based PDS/Fortran coordinate center: (15200.5, 15200.5)
    """
    stereo = latlon_to_polar_stereo(-90.0, 0.0)
    assert stereo.x_m == 0.0
    assert stereo.y_m == 0.0
    assert stereo.rho_m == 0.0

    pixel = polar_stereo_to_pixel(stereo.x_m, stereo.y_m)
    assert pixel.col_0 == 15199.5
    assert pixel.row_0 == 15199.5
    assert pixel.sample_1 == 15200.5
    assert pixel.line_1 == 15200.5

    # Inverse mapping
    lat, lon = polar_stereo_to_latlon(0.0, 0.0)
    assert lat == -90.0
    assert lon == 0.0

    inv_lat, inv_lon = pixel_to_latlon(15199.5, 15199.5)
    assert inv_lat == -90.0
    assert inv_lon == 0.0


def test_shackleton_rim_control_point():
    """Verify Shackleton Crater rim site at -89.90 deg latitude, 0.0 deg longitude.

    Colatitude = 0.10 deg, half-colatitude = 0.05 deg.
    rho = 2 * R * tan(0.05 deg) = 3032.336 m.
    Since lon=0, Y is positive Earthward (North on grid), line/row decreases.
    """
    lat_shackleton = -89.90
    lon_shackleton = 0.0

    stereo = latlon_to_polar_stereo(lat_shackleton, lon_shackleton)
    expected_rho = 2.0 * R_MOON_SPHERE_M * math.tan(math.radians(0.05))
    assert abs(stereo.rho_m - expected_rho) < 1e-6
    assert abs(stereo.x_m - 0.0) < 1e-6
    assert abs(stereo.y_m - expected_rho) < 1e-6

    pixel = polar_stereo_to_pixel(stereo.x_m, stereo.y_m)
    assert pixel.col_0 == 15199.5
    expected_row_0 = 15199.5 - (expected_rho / 20.0)
    assert abs(pixel.row_0 - expected_row_0) < 1e-6
    assert abs(pixel.line_1 - (expected_row_0 + 1.0)) < 1e-6

    # Inverse round-trip
    rev_lat, rev_lon = pixel_to_latlon(pixel.col_0, pixel.row_0)
    assert abs(rev_lat - lat_shackleton) < 1e-9
    assert abs(rev_lon - lon_shackleton) < 1e-9


def test_footprint_corners_and_edge_midpoints():
    """Verify analytical coordinates of all 4 corners and 4 edge midpoints of outer footprint."""
    scale = 20.0
    offset = 15199.5

    # 1. Four edge midpoints (outer boundary: rho = 304,000.0 m)
    edge_cases = [
        ("North", 15199.5, -0.5, 0.0, 304000.0, 0.0),
        ("South", 15199.5, 30399.5, 0.0, -304000.0, 180.0),
        ("East", 30399.5, 15199.5, 304000.0, 0.0, 90.0),
        ("West", -0.5, 15199.5, -304000.0, 0.0, 270.0),
    ]

    for name, c0, r0, exp_x, exp_y, exp_lon in edge_cases:
        stereo = pixel_to_polar_stereo(c0, r0)
        assert abs(stereo.x_m - exp_x) < 1e-6
        assert abs(stereo.y_m - exp_y) < 1e-6
        assert abs(stereo.rho_m - 304000.0) < 1e-6

        lat, lon = polar_stereo_to_latlon(stereo.x_m, stereo.y_m)
        assert abs(lat - LAT_CARDINAL_EDGE_BOUNDARY_DEG) < 1e-5, f"{name} edge latitude mismatch"
        assert abs(lon - exp_lon) < 1e-5, f"{name} edge longitude mismatch"

    # 2. Four corners (outer boundary: rho = 304000 * sqrt(2) = 429920.923 m)
    expected_corner_rho = 304000.0 * math.sqrt(2.0)
    corner_cases = [
        ("NW", -0.5, -0.5, -304000.0, 304000.0, 315.0),
        ("NE", 30399.5, -0.5, 304000.0, 304000.0, 45.0),
        ("SE", 30399.5, 30399.5, 304000.0, -304000.0, 135.0),
        ("SW", -0.5, 30399.5, -304000.0, -304000.0, 225.0),
    ]

    for name, c0, r0, exp_x, exp_y, exp_lon in corner_cases:
        stereo = pixel_to_polar_stereo(c0, r0)
        assert abs(stereo.x_m - exp_x) < 1e-6
        assert abs(stereo.y_m - exp_y) < 1e-6
        assert abs(stereo.rho_m - expected_corner_rho) < 1e-4

        lat, lon = polar_stereo_to_latlon(stereo.x_m, stereo.y_m)
        assert abs(lat - LAT_CORNER_BOUNDARY_DEG) < 1e-5, f"{name} corner latitude mismatch"
        assert abs(lon - exp_lon) < 1e-5, f"{name} corner longitude mismatch"


def test_cardinal_80s_boundary_exclusion():
    """Verify that exactly 80.0 deg S lies 5.608 m outside the outer boundary at cardinal midpoints."""
    # rho at exactly 80.0 deg S
    expected_rho_80s = 2.0 * R_MOON_SPHERE_M * math.tan(math.radians(5.0))
    assert abs(RHO_80S_M - expected_rho_80s) < 1e-6
    assert abs(RHO_80S_M - 304005.608020) < 1e-4

    # Along North axis (lon = 0), X = 0, Y = RHO_80S_M = 304005.608 m
    stereo_north = latlon_to_polar_stereo(-80.0, 0.0, validate_bounds=False)
    assert abs(stereo_north.y_m - 304005.608020) < 1e-4

    pixel_north = polar_stereo_to_pixel(stereo_north.x_m, stereo_north.y_m)
    # Outer boundary is at row_0 = -0.5. At 80.0 S North, row_0 = -0.7804, which is outside!
    assert pixel_north.row_0 < -0.5
    assert abs(pixel_north.row_0 - (-0.780401)) < 1e-4
    assert is_within_raster_footprint(pixel_north.col_0, pixel_north.row_0) is False

    # The overshoot beyond the outer footprint boundary is 5.608 meters (0.2804 pixels)
    overshoot_m = stereo_north.y_m - MAX_GRID_HALF_WIDTH_M
    assert abs(overshoot_m - 5.608020) < 1e-4
    overshoot_pix = overshoot_m / 20.0
    assert abs(overshoot_pix - 0.280401) < 1e-4


def test_footprint_vs_center_hull_helpers():
    """Verify is_within_raster_footprint vs is_within_pixel_center_hull."""
    # Pixel center
    assert is_within_raster_footprint(0.0, 0.0) is True
    assert is_within_pixel_center_hull(0.0, 0.0) is True

    # Between outer footprint and pixel center: col_0 = -0.4
    assert is_within_raster_footprint(-0.4, 0.0) is True
    assert is_within_pixel_center_hull(-0.4, 0.0) is False

    # Outer footprint exact edge: col_0 = -0.5
    assert is_within_raster_footprint(-0.5, 0.0) is True
    assert is_within_pixel_center_hull(-0.5, 0.0) is False

    # Beyond outer footprint: col_0 = -0.55
    assert is_within_raster_footprint(-0.55, 0.0) is False
    assert is_within_pixel_center_hull(-0.55, 0.0) is False


def test_round_trip_projection_consistency():
    """Verify forward/inverse projection accuracy across polar grid."""
    test_coords = [
        (-90.0, 0.0),
        (-89.95, 45.0),
        (-89.5, 90.0),
        (-88.0, 135.0),
        (-85.0, 180.0),
        (-82.0, 225.0),
        (-80.5, 270.0),
        (-80.001, 315.0),
    ]

    for lat_orig, lon_orig in test_coords:
        pix = latlon_to_pixel(lat_orig, lon_orig)
        lat_rec, lon_rec = pixel_to_latlon(pix.col_0, pix.row_0)

        assert abs(lat_rec - lat_orig) < 1e-9, f"Latitude mismatch for ({lat_orig}, {lon_orig}): got {lat_rec}"
        if lat_orig > -90.0:
            assert abs(lon_rec - lon_orig) < 1e-8, f"Longitude mismatch for ({lat_orig}, {lon_orig}): got {lon_rec}"


def test_non_finite_coordinate_rejection():
    """Verify that NaN and Inf coordinates raise ValueError immediately."""
    with pytest.raises(ValueError, match="Non-finite coordinates"):
        latlon_to_polar_stereo(float("nan"), 0.0)

    with pytest.raises(ValueError, match="Non-finite coordinates"):
        latlon_to_polar_stereo(-85.0, float("inf"))

    with pytest.raises(ValueError, match="Non-finite projection coordinates"):
        polar_stereo_to_latlon(float("nan"), 100.0)
