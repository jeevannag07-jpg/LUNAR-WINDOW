"""Unit tests for site-relative topocentric geometry (azimuth, elevation, slant range)."""

import math
import numpy as np
import pytest

from app.science.geometry.local_frame import compute_enu_basis
from app.science.geometry.lunar_coordinates import selenographic_to_cartesian
from app.science.geometry.topocentric import (
    TopocentricGeometryResult,
    calculate_topocentric_geometry,
)


def test_cardinal_enu_directions_and_azimuth():
    """Verify that pure cardinal ENU vectors produce exact analytical azimuth and elevation angles.
    
    Site: Equator prime meridian (lat=0, lon=0, elev=0).
    At this site:
        u_hat = [+1, 0, 0]  (Up)
        e_hat = [0, +1, 0]  (East)
        n_hat = [0, 0, +1]  (North)
        Site Cartesian position = [1737.4, 0, 0] km
    """
    site_lat, site_lon = 0.0, 0.0
    site_pos = selenographic_to_cartesian(site_lat, site_lon, elevation_km=0.0).as_array()
    d = 1000.0  # 1000 km offset

    # 1. Pure North: rho_ENU = [0, d, 0] -> Azimuth = 0.0°, Elevation = 0.0°
    body_north = site_pos + np.array([0.0, 0.0, d])  # offset along +Z
    res_north = calculate_topocentric_geometry(
        body_position_km=body_north,
        site_position_km=site_pos,
        site_latitude_deg=site_lat,
        site_longitude_deg=site_lon,
    )
    assert res_north.azimuth_deg == pytest.approx(0.0, abs=1e-9)
    assert res_north.elevation_deg == pytest.approx(0.0, abs=1e-9)
    assert res_north.distance_km == pytest.approx(d, abs=1e-9)
    np.testing.assert_allclose(res_north.enu_vector_km, [0.0, d, 0.0], atol=1e-9)

    # 2. Pure East: rho_ENU = [d, 0, 0] -> Azimuth = 90.0°, Elevation = 0.0°
    body_east = site_pos + np.array([0.0, d, 0.0])  # offset along +Y
    res_east = calculate_topocentric_geometry(
        body_position_km=body_east,
        site_position_km=site_pos,
        site_latitude_deg=site_lat,
        site_longitude_deg=site_lon,
    )
    assert res_east.azimuth_deg == pytest.approx(90.0, abs=1e-9)
    assert res_east.elevation_deg == pytest.approx(0.0, abs=1e-9)
    assert res_east.distance_km == pytest.approx(d, abs=1e-9)
    np.testing.assert_allclose(res_east.enu_vector_km, [d, 0.0, 0.0], atol=1e-9)

    # 3. Pure South: rho_ENU = [0, -d, 0] -> Azimuth = 180.0°, Elevation = 0.0°
    body_south = site_pos + np.array([0.0, 0.0, -d])  # offset along -Z
    res_south = calculate_topocentric_geometry(
        body_position_km=body_south,
        site_position_km=site_pos,
        site_latitude_deg=site_lat,
        site_longitude_deg=site_lon,
    )
    assert res_south.azimuth_deg == pytest.approx(180.0, abs=1e-9)
    assert res_south.elevation_deg == pytest.approx(0.0, abs=1e-9)
    assert res_south.distance_km == pytest.approx(d, abs=1e-9)
    np.testing.assert_allclose(res_south.enu_vector_km, [0.0, -d, 0.0], atol=1e-9)

    # 4. Pure West: rho_ENU = [-d, 0, 0] -> Azimuth = 270.0°, Elevation = 0.0°
    body_west = site_pos + np.array([0.0, -d, 0.0])  # offset along -Y
    res_west = calculate_topocentric_geometry(
        body_position_km=body_west,
        site_position_km=site_pos,
        site_latitude_deg=site_lat,
        site_longitude_deg=site_lon,
    )
    assert res_west.azimuth_deg == pytest.approx(270.0, abs=1e-9)
    assert res_west.elevation_deg == pytest.approx(0.0, abs=1e-9)
    assert res_west.distance_km == pytest.approx(d, abs=1e-9)
    np.testing.assert_allclose(res_west.enu_vector_km, [-d, 0.0, 0.0], atol=1e-9)


def test_positive_negative_and_zenith_elevation():
    """Verify elevation calculation for overhead, horizon, and subsurface targets."""
    site_lat, site_lon = 0.0, 0.0
    site_pos = selenographic_to_cartesian(site_lat, site_lon, elevation_km=0.0).as_array()
    d = 1000.0

    # 1. Direct Zenith (+90°): rho along +X axis
    body_zenith = site_pos + np.array([d, 0.0, 0.0])
    res_zenith = calculate_topocentric_geometry(
        body_position_km=body_zenith,
        site_position_km=site_pos,
        site_latitude_deg=site_lat,
        site_longitude_deg=site_lon,
    )
    assert res_zenith.elevation_deg == pytest.approx(90.0, abs=1e-9)
    assert res_zenith.is_near_zenith is True
    assert res_zenith.azimuth_deg == 0.0  # Singularity convention

    # 2. Elevation +45° at Azimuth 45° (North-East quadrant)
    # rho_E = 1000, rho_N = 1000, rho_U = 1000 * sqrt(2) ≈ 1414.21356
    # In Cartesian (lat=0, lon=0): X is Up, Y is East, Z is North
    body_ne_45 = site_pos + np.array([1000.0 * math.sqrt(2), 1000.0, 1000.0])
    res_ne_45 = calculate_topocentric_geometry(
        body_position_km=body_ne_45,
        site_position_km=site_pos,
        site_latitude_deg=site_lat,
        site_longitude_deg=site_lon,
    )
    assert res_ne_45.azimuth_deg == pytest.approx(45.0, abs=1e-7)
    assert res_ne_45.elevation_deg == pytest.approx(45.0, abs=1e-7)
    assert res_ne_45.distance_km == pytest.approx(2000.0, abs=1e-7)

    # 3. Negative Elevation (-30°): target below horizon
    # rho_U = -1000 * sin(30°) = -500, rho_N = 1000 * cos(30°) = 866.025, rho_E = 0
    body_sub = site_pos + np.array([-500.0, 0.0, 500.0 * math.sqrt(3)])
    res_sub = calculate_topocentric_geometry(
        body_position_km=body_sub,
        site_position_km=site_pos,
        site_latitude_deg=site_lat,
        site_longitude_deg=site_lon,
    )
    assert res_sub.elevation_deg == pytest.approx(-30.0, abs=1e-7)
    assert res_sub.azimuth_deg == pytest.approx(0.0, abs=1e-7)


def test_zero_length_relative_vector_rejected():
    """Verify that if target body coincides with site position, ValueError is raised."""
    site_pos = [1737.4, 0.0, 0.0]
    body_pos = [1737.4, 0.0, 0.0]  # Coincident

    with pytest.raises(ValueError) as exc:
        calculate_topocentric_geometry(
            body_position_km=body_pos,
            site_position_km=site_pos,
            site_latitude_deg=0.0,
            site_longitude_deg=0.0,
        )
    assert "Zero-length relative vector" in str(exc.value)
    assert "geometrically undefined" in str(exc.value)


def test_frame_mismatch_rejection():
    """Verify that mixing different reference frames is strictly rejected."""
    site_pos = [1737.4, 0.0, 0.0]
    body_pos = [1.5e8, 0.0, 0.0]

    # ICRF vs MOON_ME
    with pytest.raises(ValueError) as exc1:
        calculate_topocentric_geometry(
            body_position_km=body_pos,
            site_position_km=site_pos,
            site_latitude_deg=0.0,
            site_longitude_deg=0.0,
            body_frame="ICRF",
            site_frame="MOON_ME",
        )
    assert "Reference frame mismatch" in str(exc1.value)
    assert "ICRF" in str(exc1.value)

    # MOON_PA vs MOON_ME
    with pytest.raises(ValueError) as exc2:
        calculate_topocentric_geometry(
            body_position_km=body_pos,
            site_position_km=site_pos,
            site_latitude_deg=0.0,
            site_longitude_deg=0.0,
            body_frame="MOON_PA",
            site_frame="MOON_ME",
        )
    assert "Reference frame mismatch" in str(exc2.value)


def test_invalid_dimensions_and_non_finite_rejection():
    """Verify that invalid shapes and non-finite values are rejected."""
    site_pos = [1737.4, 0.0, 0.0]
    valid_body = [1737.4, 1000.0, 0.0]

    # Invalid dimension
    with pytest.raises(ValueError) as exc:
        calculate_topocentric_geometry(
            body_position_km=[1.0, 2.0],
            site_position_km=site_pos,
            site_latitude_deg=0.0,
            site_longitude_deg=0.0,
        )
    assert "shape (3,)" in str(exc.value)

    # Non-finite values
    with pytest.raises(ValueError) as exc:
        calculate_topocentric_geometry(
            body_position_km=[float("nan"), 100.0, 0.0],
            site_position_km=site_pos,
            site_latitude_deg=0.0,
            site_longitude_deg=0.0,
        )
    assert "non-finite" in str(exc.value)


def test_reproducibility():
    """Verify that identical inputs produce bit-level identical results."""
    site_pos = [1737.4, 0.0, 0.0]
    body_pos = [1737.4, 500.0, 800.0]

    res1 = calculate_topocentric_geometry(
        body_position_km=body_pos,
        site_position_km=site_pos,
        site_latitude_deg=0.0,
        site_longitude_deg=0.0,
    )
    res2 = calculate_topocentric_geometry(
        body_position_km=body_pos,
        site_position_km=site_pos,
        site_latitude_deg=0.0,
        site_longitude_deg=0.0,
    )

    assert res1.azimuth_deg == res2.azimuth_deg
    assert res1.elevation_deg == res2.elevation_deg
    assert res1.distance_km == res2.distance_km
    np.testing.assert_array_equal(res1.enu_vector_km, res2.enu_vector_km)


def test_end_to_end_spice_to_topocentric_geometry():
    """Verify end-to-end integration: ICRF body vector -> SPICE MOON_ME -> Topocentric ENU.
    
    Uses authentic DE440 kernels loaded via SpiceManager:
    - Target: Earth position in Moon-centered ICRF (~384,400 km).
    - Observer: Lunar South Pole site (lat=-89.9°, lon=0.0°).
    - Checks that transformed vector is strictly in MOON_ME, topocentric distance accounts
      for lunar radius parallax, and elevation/azimuth are physically consistent.
    """
    from datetime import datetime, timezone
    from app.services.spice_manager import SpiceManager
    from app.science.astronomy.time import utc_to_et
    from app.science.astronomy.orientation import transform_position

    manager = SpiceManager()
    manager.load_kernels()

    dt = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    et = utc_to_et(dt)

    # Synthetic Moon-centered Earth vector in ICRF (approx 384,400 km)
    earth_icrf = np.array([350000.0, 150000.0, -50000.0], dtype=np.float64)

    # 1. Transform ICRF -> MOON_ME using SPICE
    earth_moon_me = transform_position(earth_icrf, et, from_frame="ICRF", to_frame="MOON_ME")
    np.testing.assert_allclose(
        np.linalg.norm(earth_moon_me),
        np.linalg.norm(earth_icrf),
        rtol=1e-12,
        err_msg="Vector magnitude must be invariant under rigid rotation",
    )

    # 2. Compute Lunar South Pole site position in MOON_ME
    site = selenographic_to_cartesian(latitude_deg=-89.9, longitude_deg=0.0, elevation_km=0.0)

    # 3. Compute Topocentric Geometry
    topo_res = calculate_topocentric_geometry(
        body_position_km=earth_moon_me,
        site_position_km=site.as_array(),
        site_latitude_deg=-89.9,
        site_longitude_deg=0.0,
        body_frame="MOON_ME",
        site_frame=site.frame,
    )

    assert 0.0 <= topo_res.azimuth_deg < 360.0
    assert -90.0 <= topo_res.elevation_deg <= 90.0
    assert topo_res.distance_km > 0.0
    assert topo_res.frame == "MOON_ME"
    # Slant range differs from Moon-centered distance due to lunar surface parallax (up to 1737.4 km)
    assert abs(topo_res.distance_km - np.linalg.norm(earth_icrf)) <= 1737.4 + 1.0
