"""Unit tests for topographic horizon profile generation."""

import math
from pathlib import Path
import numpy as np
import pytest

from app.science.terrain.dem_raster import DEMRasterReader
from app.science.terrain.horizon import generate_horizon_profile
from app.science.terrain.models import PDSLabelMetadata


@pytest.fixture
def synthetic_peak_dem(tmp_path: Path):
    """Create synthetic DEM with a prominent peak North of the pole."""
    lines, samples = 100, 100
    raster_file = tmp_path / "peak_dem.img"

    grid = np.zeros((lines, samples), dtype="<i2")
    # Cell (30, 50): Y is North (Earthward), Row 30 is ~400m North of Row 50
    # Peak of +1500m (DN = 3000)
    grid[30, 50] = 3000
    grid.tofile(raster_file)

    meta = PDSLabelMetadata(
        product_id="PEAK_DEM",
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


def test_horizon_profile_spherical_datum():
    """Verify spherical datum horizon calculation when no DEM is loaded."""
    profile = generate_horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        site_elevation_m=0.0,
        dem_reader=None,
        azimuth_step_deg=10.0,
    )

    assert len(profile.azimuths_deg) == 36
    assert profile.max_elevation_deg == 0.0
    assert profile.min_elevation_deg == 0.0
    assert profile.mean_elevation_deg == 0.0
    assert profile.is_fully_within_dem is False


def test_horizon_profile_interpolation_wrap():
    """Verify smooth azimuth interpolation and 360-degree wrap-around."""
    profile = generate_horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        site_elevation_m=0.0,
        dem_reader=None,
        azimuth_step_deg=45.0,
    )

    # Query at azimuth 0, 180, 359, 360
    assert profile.get_elevation_at_azimuth(0.0) == 0.0
    assert profile.get_elevation_at_azimuth(180.0) == 0.0
    assert profile.get_elevation_at_azimuth(359.5) == 0.0
    assert profile.get_elevation_at_azimuth(360.0) == 0.0
    assert profile.get_elevation_at_azimuth(720.0) == 0.0
