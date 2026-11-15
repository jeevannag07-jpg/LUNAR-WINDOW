"""Unit tests for memory-mapped DEM raster access, decoding, and scaling."""

from pathlib import Path
import numpy as np
import pytest

from app.science.terrain.dem_raster import DEMRasterReader
from app.science.terrain.models import PDSLabelMetadata, SubRasterWindow


@pytest.fixture
def synthetic_dem(tmp_path: Path) -> tuple[Path, PDSLabelMetadata, np.ndarray]:
    """Create a small synthetic 16-bit binary DEM fixture with known topography."""
    lines = 100
    samples = 100
    raster_file = tmp_path / "synthetic_dem.img"

    # Define synthetic digital numbers:
    # - Cell (50, 50) is the South Pole: DN = 0 (relative height = 0.0 m)
    # - Cell (50, 40) is a mountain peak: DN = 2000 (relative height = +1000.0 m)
    # - Cell (50, 60) is a crater floor: DN = -3000 (relative height = -1500.0 m)
    # - Cell (10, 10) is a sentinel value: DN = -32768
    grid = np.zeros((lines, samples), dtype="<i2")
    grid[50, 40] = 2000
    grid[50, 60] = -3000
    grid[10, 10] = -32768

    grid.tofile(raster_file)

    metadata = PDSLabelMetadata(
        product_id="SYNTHETIC_LOLA",
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
        lines=lines,
        line_samples=samples,
        line_projection_offset=49.5,
        sample_projection_offset=49.5,
        sample_type="LSB_INTEGER",
        sample_bits=16,
        scaling_factor=0.5,
        offset_m=1737400.0,
        derived_minimum=-14594,
        derived_maximum=14054,
        nodata_value=None,  # Unresolved by default, matching LDEM_80S_20M.LBL
    )

    return raster_file, metadata, grid


def test_little_endian_decoding_and_scaling(synthetic_dem: tuple[Path, PDSLabelMetadata, np.ndarray]):
    """Verify exact decoding of signed little-endian 16-bit samples into meters."""
    raster_file, metadata, _ = synthetic_dem

    with DEMRasterReader(raster_file, metadata) as reader:
        # 1. South pole (DN = 0) -> height = 0.0 m, radius = 1737400.0 m
        pole_sample = reader.get_sample_at_pixel(col_0=50.0, row_0=50.0)
        assert pole_sample.is_valid is True
        assert pole_sample.is_within_dem is True
        assert pole_sample.raw_dn == 0
        assert pole_sample.relative_elevation_m == 0.0
        assert pole_sample.planetary_radius_m == 1737400.0

        # 2. Mountain peak (DN = 2000) -> height = +1000.0 m, radius = 1738400.0 m
        peak_sample = reader.get_sample_at_pixel(col_0=40.0, row_0=50.0)
        assert peak_sample.is_valid is True
        assert peak_sample.raw_dn == 2000
        assert peak_sample.relative_elevation_m == 1000.0
        assert peak_sample.planetary_radius_m == 1738400.0

        # 3. Crater floor (DN = -3000) -> height = -1500.0 m, radius = 1735900.0 m
        crater_sample = reader.get_sample_at_pixel(col_0=60.0, row_0=50.0)
        assert crater_sample.is_valid is True
        assert crater_sample.raw_dn == -3000
        assert crater_sample.relative_elevation_m == -1500.0
        assert crater_sample.planetary_radius_m == 1735900.0


def test_undocumented_nodata_policy_preservation(synthetic_dem: tuple[Path, PDSLabelMetadata, np.ndarray]):
    """Verify that when NoData is undocumented, reader does not guess or drop samples."""
    raster_file, metadata, _ = synthetic_dem
    assert metadata.has_documented_nodata is False

    with DEMRasterReader(raster_file, metadata) as reader:
        assert reader.has_documented_nodata is False
        # Without documented sentinel, raw value is retained as a measurement
        sample = reader.get_sample_at_pixel(col_0=10.0, row_0=10.0)
        assert sample.is_valid is True
        assert sample.raw_dn == -32768
        assert sample.relative_elevation_m == -32768 * 0.5


def test_explicit_nodata_sentinel_handling(synthetic_dem: tuple[Path, PDSLabelMetadata, np.ndarray]):
    """Verify that when an explicit NoData sentinel is provided, matching cells are marked invalid."""
    raster_file, metadata, _ = synthetic_dem

    with DEMRasterReader(raster_file, metadata, explicit_nodata_value=-32768) as reader:
        assert reader.has_documented_nodata is True
        null_sample = reader.get_sample_at_pixel(col_0=10.0, row_0=10.0)
        assert null_sample.is_valid is False
        assert null_sample.is_within_dem is True
        assert null_sample.raw_dn == -32768
        assert null_sample.relative_elevation_m is None
        assert null_sample.planetary_radius_m is None


def test_footprint_vs_pixel_center_boundary_distinction(synthetic_dem: tuple[Path, PDSLabelMetadata, np.ndarray]):
    """Verify exact handling of coordinates between outer footprint boundary [-0.5, N-0.5] and pixel centers [0, N-1]."""
    raster_file, metadata, _ = synthetic_dem

    with DEMRasterReader(raster_file, metadata) as reader:
        # col_0 = -0.4 is inside the physical outer footprint of pixel 0, but outside pixel centers [0, 99]
        sample_edge = reader.get_sample_at_pixel(col_0=-0.4, row_0=50.0)
        assert sample_edge.is_within_dem is True
        assert sample_edge.is_within_footprint is True
        assert sample_edge.is_within_pixel_centers is False
        assert sample_edge.is_valid is True

        # col_0 = -0.55 is strictly outside the physical outer footprint
        sample_out = reader.get_sample_at_pixel(col_0=-0.55, row_0=50.0)
        assert sample_out.is_within_dem is False
        assert sample_out.is_within_footprint is False
        assert sample_out.is_valid is False
        assert sample_out.relative_elevation_m is None


def test_extract_subraster_window(synthetic_dem: tuple[Path, PDSLabelMetadata, np.ndarray]):
    """Verify memory-mapped window extraction without loading entire raster."""
    raster_file, metadata, grid = synthetic_dem

    with DEMRasterReader(raster_file, metadata) as reader:
        win = SubRasterWindow(col_min=35, col_max=45, row_min=45, row_max=55)
        sub = reader.extract_subraster_window(win)

        assert sub.shape == (10, 10)
        # Verify peak is inside slice at row=5 (50-45), col=5 (40-35)
        assert sub[5, 5] == 2000
        assert np.array_equal(sub, grid[45:55, 35:45])


def test_geographic_coverage_enforcement(synthetic_dem: tuple[Path, PDSLabelMetadata, np.ndarray]):
    """Verify that coordinates outside declared geographic coverage are never reported as valid terrain.

    Demonstrates that points north of -80°S are strictly marked invalid with
    GeographicCoverageState.OUTSIDE_DECLARED_DOMAIN, even if queried.
    """
    raster_file, metadata, _ = synthetic_dem

    with DEMRasterReader(raster_file, metadata) as reader:
        # Latitude -75.0°S is north of declared maximum_latitude_deg (-80.0°S).
        sample_outside = reader.get_sample_at_latlon(lat_deg=-75.0, lon_deg=45.0)

        assert sample_outside.is_within_declared_coverage is False
        assert sample_outside.geographic_coverage_state.value == "OUTSIDE_DECLARED_DOMAIN"
        assert sample_outside.is_valid is False
        assert sample_outside.relative_elevation_m is None
        assert sample_outside.planetary_radius_m is None

        # Conversely, a point inside declared coverage and within the 100x100 raster (e.g. -89.99°S, ~303m from pole) is valid
        sample_valid = reader.get_sample_at_latlon(lat_deg=-89.99, lon_deg=0.0)
        assert sample_valid.is_within_declared_coverage is True
        assert sample_valid.geographic_coverage_state.value == "WITHIN_DECLARED_DOMAIN"
        assert sample_valid.is_valid is True
        assert sample_valid.relative_elevation_m is not None


def test_independent_coverage_and_footprint_states_adversarial(tmp_path: Path):
    """Verify independent coverage states on the full LDEM_80S_20M coordinate system.

    Uses an instantaneous sparse file (0 allocated disk blocks) matching exact
    PDS dimensions (30400 x 30400 x 2 bytes = 1,848,320,000 bytes) to rigorously
    test the four critical geodetic control points:

    1. (-75.0°S, 45.0°E):
       - Outside declared geographic coverage (-75° > -80°).
       - Outside raster outer footprint (col_0 = 31373.37 > 30399.5, row_0 = -974.37 < -0.5).
       - Outside pixel-center domain.
       - Outside discrete raster storage.
       - Confirms -75°S, 45°E is NOT inside storage.

    2. (-76.0°S, 45.0°E) [Adversarial corner]:
       - Outside declared geographic coverage (-76° > -80°).
       - Inside outer footprint (col_0 = 30283.92, row_0 = 115.08).
       - Inside pixel-center domain.
       - Inside discrete raster storage (r=115, c=30284).
       - MUST be rejected as invalid terrain (is_valid=False) despite being in storage.

    3. (-80.0°S, 45.0°E) [Valid corner]:
       - Inside declared geographic coverage (-80.0°S boundary).
       - Inside outer footprint (col_0 = 25947.72, row_0 = 4451.28).
       - Inside pixel-center domain.
       - Inside discrete raster storage (r=4451, c=25948).
       - Valid terrain (is_valid=True).

    4. (-80.0°S, 0.0°E) [Cardinal overshoot]:
       - Inside declared geographic coverage (-80.0°S boundary).
       - Outside outer footprint (row_0 = -0.7804 < -0.5, 5.608 m beyond grid edge).
       - Outside pixel-center domain (row_0 < 0.0).
       - Outside discrete raster storage (r = -1).
       - MUST be rejected without clamping (is_valid=False, is_within_raster_storage=False).
    """
    sparse_file = tmp_path / "ldem_80s_20m_sparse.img"
    with open(sparse_file, "wb") as f:
        f.seek(30400 * 30400 * 2 - 1)
        f.write(b"\x00")

    metadata = PDSLabelMetadata(
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
    )

    with DEMRasterReader(sparse_file, metadata) as reader:
        # Point 1: (-75°S, 45°E) - Outside coverage AND outside storage
        p1 = reader.get_sample_at_latlon(lat_deg=-75.0, lon_deg=45.0)
        assert p1.is_within_declared_coverage is False
        assert p1.is_within_footprint is False
        assert p1.is_within_pixel_centers is False
        assert p1.is_within_raster_storage is False
        assert p1.is_within_dem is False
        assert p1.is_valid is False
        assert p1.relative_elevation_m is None
        assert p1.pixel_coord.col_0 == pytest.approx(31373.3690, abs=1e-3)
        assert p1.pixel_coord.row_0 == pytest.approx(-974.3690, abs=1e-3)

        # Point 2: (-76°S, 45°E) - Outside coverage BUT inside storage
        p2 = reader.get_sample_at_latlon(lat_deg=-76.0, lon_deg=45.0)
        assert p2.is_within_declared_coverage is False
        assert p2.geographic_coverage_state.value == "OUTSIDE_DECLARED_DOMAIN"
        assert p2.is_within_footprint is True
        assert p2.is_within_pixel_centers is True
        assert p2.is_within_raster_storage is True
        assert p2.is_within_dem is True
        assert p2.is_valid is False  # Must NOT be valid terrain despite being in binary storage!
        assert p2.relative_elevation_m is None
        assert p2.pixel_coord.col_0 == pytest.approx(30283.9188, abs=1e-3)
        assert p2.pixel_coord.row_0 == pytest.approx(115.0812, abs=1e-3)

        # Point 3: (-80°S, 45°E) - Inside coverage AND inside storage
        p3 = reader.get_sample_at_latlon(lat_deg=-80.0, lon_deg=45.0)
        assert p3.is_within_declared_coverage is True
        assert p3.geographic_coverage_state.value == "WITHIN_DECLARED_DOMAIN"
        assert p3.is_within_footprint is True
        assert p3.is_within_pixel_centers is True
        assert p3.is_within_raster_storage is True
        assert p3.is_within_dem is True
        assert p3.is_valid is True
        assert p3.relative_elevation_m is not None
        assert p3.pixel_coord.col_0 == pytest.approx(25947.7213, abs=1e-3)
        assert p3.pixel_coord.row_0 == pytest.approx(4451.2787, abs=1e-3)

        # Point 4: (-80°S, 0°E) - Inside coverage BUT outside storage
        p4 = reader.get_sample_at_latlon(lat_deg=-80.0, lon_deg=0.0)
        assert p4.is_within_declared_coverage is True
        assert p4.geographic_coverage_state.value == "WITHIN_DECLARED_DOMAIN"
        assert p4.is_within_footprint is False  # row_0 = -0.7804 < -0.5
        assert p4.is_within_pixel_centers is False
        assert p4.is_within_raster_storage is False  # Discrete row is -1
        assert p4.is_within_dem is False
        assert p4.is_valid is False  # Must NOT be clamped to row 0!
        assert p4.relative_elevation_m is None
        assert p4.pixel_coord.col_0 == pytest.approx(15199.5000, abs=1e-3)
        assert p4.pixel_coord.row_0 == pytest.approx(-0.7804, abs=1e-3)


def test_file_size_validation(tmp_path: Path):
    """Verify that truncated or oversized binary files raise ValueError on initialization."""
    bad_file = tmp_path / "truncated.img"
    bad_file.write_bytes(b"\x00" * 100)

    metadata = PDSLabelMetadata(
        product_id="TEST",
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
        lines=100,
        line_samples=100,
        line_projection_offset=49.5,
        sample_projection_offset=49.5,
        sample_type="LSB_INTEGER",
        sample_bits=16,
        scaling_factor=0.5,
        offset_m=1737400.0,
    )

    with pytest.raises(ValueError, match="Raster file size mismatch"):
        DEMRasterReader(bad_file, metadata)
