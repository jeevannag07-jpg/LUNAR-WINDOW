"""Unit tests for Stage 6A terrain models and schemas."""

import numpy as np
import pytest

from app.science.terrain.models import (
    ComputationState,
    DataCompletenessState,
    DEMCoverageState,
    DEMPixelCoord,
    DirectionalRayResult,
    DirectionalVisibilityStatus,
    GeographicCoverageState,
    MeasurementSupportStatus,
    PDSLabelMetadata,
    PolarStereoCoord,
    SubRasterWindow,
    TerrainPatch,
    TerrainSampleResult,
)


def test_pds_label_metadata_immutability():
    """Verify that PDSLabelMetadata is frozen and enforces strict typing."""
    meta = PDSLabelMetadata(
        product_id="LDEM_80S_20M",
        map_projection_type="POLAR STEREOGRAPHIC",
        coordinate_system_name="MEAN EARTH/POLAR AXIS OF DE421",
        a_axis_radius_km=1737.4,
        b_axis_radius_km=1737.4,
        c_axis_radius_km=1737.4,
        center_latitude_deg=-90.0,
        center_longitude_deg=0.0,
        maximum_latitude_deg=-80.0,
        minimum_latitude_deg=-90.0,
        map_resolution_pix_deg=1516.17,
        map_scale_m_pix=20.0,
        lines=30400,
        line_samples=30400,
        line_projection_offset=15199.5,
        sample_projection_offset=15199.5,
        sample_type="LSB_INTEGER",
        sample_bits=16,
        scaling_factor=0.5,
        offset_m=1737400.0,
        derived_minimum=-14594,
        derived_maximum=14054,
    )
    assert meta.product_id == "LDEM_80S_20M"
    assert meta.lines == 30400
    with pytest.raises(Exception):
        meta.lines = 10000  # type: ignore


def test_dem_pixel_coord_1based_and_0based():
    """Verify exact relationship between 1-based PDS coordinates and 0-based NumPy indices."""
    coord = DEMPixelCoord(
        sample_1=15200.5,
        line_1=15200.5,
        col_0=15199.5,
        row_0=15199.5,
    )
    assert coord.col_0 == 15199.5
    assert coord.row_0 == 15199.5
    assert coord.sample_1 == 15200.5
    assert coord.line_1 == 15200.5

    # Auto-computation from sample_1 / line_1
    auto_coord = DEMPixelCoord(sample_1=10.0, line_1=25.0, col_0=None, row_0=None)  # type: ignore
    assert auto_coord.col_0 == 9.0
    assert auto_coord.row_0 == 24.0


def test_polar_stereo_coord_properties():
    """Verify kilometer and meter properties of PolarStereoCoord."""
    coord = PolarStereoCoord(x_m=304000.0, y_m=-304000.0, rho_m=429920.923)
    assert coord.x_km == 304.0
    assert coord.y_km == -304.0
    assert abs(coord.rho_km - 429.920923) < 1e-5


def test_subraster_window_dimensions():
    """Verify width and height of SubRasterWindow."""
    win = SubRasterWindow(col_min=100, col_max=300, row_min=50, row_max=150)
    assert win.width == 200
    assert win.height == 100


def test_terrain_sample_result():
    """Verify sample result representation."""
    res = TerrainSampleResult(
        lat_deg=-89.9,
        lon_deg=45.0,
        relative_elevation_m=-1200.5,
        planetary_radius_m=1736199.5,
        raw_dn=-2401,
        is_valid=True,
        is_within_dem=True,
        is_within_footprint=True,
        is_within_pixel_centers=True,
        pixel_coord=DEMPixelCoord(sample_1=100.0, line_1=100.0, col_0=99.0, row_0=99.0),
    )
    assert res.is_valid is True
    assert res.is_within_footprint is True
    assert res.is_within_pixel_centers is True
    assert res.relative_elevation_m == -1200.5
    assert res.planetary_radius_m == 1736199.5


def test_terrain_patch_statistics():
    """Verify min/max elevation calculations on TerrainPatch with valid and NaN values."""
    elev = np.array([
        [100.0, 200.0, np.nan],
        [-50.0, 300.0, 0.0],
    ], dtype=np.float32)
    mask = np.array([
        [True, True, False],
        [True, True, True],
    ], dtype=bool)

    patch = TerrainPatch(
        center_lat_deg=-89.5,
        center_lon_deg=0.0,
        radius_km=10.0,
        window=SubRasterWindow(col_min=0, col_max=3, row_min=0, row_max=2),
        elevation_data_m=elev,
        valid_mask=mask,
    )
    assert patch.min_elevation_m == -50.0
    assert patch.max_elevation_m == 300.0


def test_orthogonal_state_enums():
    """Verify that all orthogonal status enums maintain discrete separation."""
    assert DEMCoverageState.FULLY_WITHIN_DEM != DEMCoverageState.BOUNDARY_TRUNCATED
    assert DataCompletenessState.COMPLETE_DATA != DataCompletenessState.CONTAINS_MISSING_DATA
    assert ComputationState.COMPLETED_TO_MAX_RADIUS != ComputationState.HALTED_EARLY_DUE_TO_ERROR
    assert DirectionalVisibilityStatus.VISIBLE != DirectionalVisibilityStatus.UNRESOLVED_MISSING_DATA
    assert GeographicCoverageState.WITHIN_DECLARED_DOMAIN != GeographicCoverageState.OUTSIDE_DECLARED_DOMAIN
    assert MeasurementSupportStatus.UNKNOWN_UNTRACKED != MeasurementSupportStatus.DIRECT_OBSERVATION
