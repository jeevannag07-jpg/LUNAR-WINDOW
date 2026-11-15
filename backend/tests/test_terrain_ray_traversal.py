"""Unit tests for terrain ray tracing and obstruction evaluation."""

import math
from pathlib import Path
import numpy as np
import pytest

from app.science.terrain.dem_raster import DEMRasterReader
from app.science.terrain.models import (
    DirectionalVisibilityStatus,
    PDSLabelMetadata,
)
from app.science.terrain.ray_traversal import (
    compute_ray_state,
    compute_topocentric_triad,
    evaluate_ray_obstruction,
)


@pytest.fixture
def synthetic_dem_reader(tmp_path: Path):
    """Create a synthetic DEM raster with a mountain peak and crater."""
    lines, samples = 100, 100
    raster_file = tmp_path / "test_terrain.img"

    grid = np.zeros((lines, samples), dtype="<i2")
    # Cell (50, 40) is North of South Pole: Mountain peak DN = 2000 (+1000m)
    grid[50, 40] = 2000
    grid.tofile(raster_file)

    meta = PDSLabelMetadata(
        product_id="TEST_TERRAIN",
        map_projection_type="POLAR STEREOGRAPHIC",
        coordinate_system_name="MEAN EARTH",
        a_axis_radius_km=1737.4,
        b_axis_radius_km=1737.4,
        c_axis_radius_km=1737.4,
        center_latitude_deg=-90.0,
        center_longitude_deg=0.0,
        maximum_latitude_deg=-80.0,
        minimum_latitude_deg=-90.0,
        map_resolution_pix_deg=1516.17,
        map_scale_m_pix=20.0,
        lines=lines,
        line_samples=samples,
        line_projection_offset=49.5,
        sample_projection_offset=49.5,
        sample_type="LSB_INTEGER",
        sample_bits=16,
        scaling_factor=0.5,
        offset_m=1737400.0,
    )

    reader = DEMRasterReader(raster_file, meta)
    yield reader
    reader.close()


def test_topocentric_triad_orthonormality():
    """Verify local ENU triad vectors are orthonormal and right-handed."""
    u_east, u_north, u_up = compute_topocentric_triad(-85.0, 45.0)

    # Unit norms
    assert math.isclose(np.linalg.norm(u_east), 1.0, rel_tol=1e-9)
    assert math.isclose(np.linalg.norm(u_north), 1.0, rel_tol=1e-9)
    assert math.isclose(np.linalg.norm(u_up), 1.0, rel_tol=1e-9)

    # Mutual orthogonality
    assert math.isclose(np.dot(u_east, u_north), 0.0, abs_tol=1e-9)
    assert math.isclose(np.dot(u_east, u_up), 0.0, abs_tol=1e-9)
    assert math.isclose(np.dot(u_north, u_up), 0.0, abs_tol=1e-9)

    # Right-handed cross product
    cross = np.cross(u_east, u_north)
    assert np.allclose(cross, u_up, atol=1e-9)


def test_ray_state_at_pole_eastward():
    """Verify ray subpoint coordinates for Eastward horizontal ray at the South Pole."""
    sub_lat, sub_lon, arc_s, ray_alt = compute_ray_state(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        site_elevation_m=0.0,
        azimuth_deg=90.0,
        elevation_deg=0.0,
        t_m=1000.0,
    )

    # Traveling East from South pole moves along longitude 90 deg E
    assert math.isclose(sub_lon, 90.0, abs_tol=1e-4)
    assert sub_lat > -90.0
    assert math.isclose(arc_s, 1000.0, rel_tol=1e-5)
    # At t=1000m, curvature creates small altitude above sphere: t^2 / (2*R0) ~ 0.287m
    assert 0.25 < ray_alt < 0.35


def test_evaluate_ray_obstruction_skyward_clears(synthetic_dem_reader):
    """Verify that a high-elevation ray (+45 deg) clears terrain without obstruction."""
    result = evaluate_ray_obstruction(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        site_elevation_m=0.0,
        azimuth_deg=0.0,
        elevation_deg=45.0,
        dem_reader=synthetic_dem_reader,
    )

    assert result.is_obstructed is False
    assert result.directional_status == DirectionalVisibilityStatus.VISIBLE


def test_evaluate_ray_obstruction_downward_blocked(synthetic_dem_reader):
    """Verify that a downward ray into the lunar ground is blocked."""
    result = evaluate_ray_obstruction(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        site_elevation_m=0.0,
        azimuth_deg=0.0,
        elevation_deg=-90.0,
        dem_reader=synthetic_dem_reader,
    )

    assert result.is_obstructed is True
    assert result.directional_status == DirectionalVisibilityStatus.OCCULTED
