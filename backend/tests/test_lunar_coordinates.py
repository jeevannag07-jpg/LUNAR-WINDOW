"""Unit tests for selenographic to Moon-centered Cartesian coordinate conversions."""

import math
import numpy as np
import pytest

from app.science.geometry.lunar_coordinates import (
    LUNAR_MEAN_RADIUS_KM,
    LunarCartesianPosition,
    cartesian_to_selenographic,
    selenographic_to_cartesian,
)


def test_equatorial_site_at_zero_longitude():
    """Verify equatorial prime meridian site (lat=0, lon=0, elev=0).
    
    Analytic reference:
        r = 1737.4 km
        X = 1737.4 * cos(0) * cos(0) = 1737.4 km
        Y = 1737.4 * cos(0) * sin(0) = 0.0 km
        Z = 1737.4 * sin(0) = 0.0 km
    """
    pos = selenographic_to_cartesian(latitude_deg=0.0, longitude_deg=0.0, elevation_km=0.0)

    assert pos.frame == "MOON_ME"
    assert pos.units == "km"
    assert pos.radius_km == pytest.approx(1737.4, abs=1e-9)
    assert pos.x_km == pytest.approx(1737.4, abs=1e-9)
    assert pos.y_km == pytest.approx(0.0, abs=1e-9)
    assert pos.z_km == pytest.approx(0.0, abs=1e-9)

    # Invert back to selenographic
    lat, lon, elev = cartesian_to_selenographic(pos.as_array())
    assert lat == pytest.approx(0.0, abs=1e-9)
    assert lon == pytest.approx(0.0, abs=1e-9)
    assert elev == pytest.approx(0.0, abs=1e-6)


def test_equatorial_site_at_ninety_deg_east_longitude():
    """Verify equatorial 90° East longitude site (lat=0, lon=90, elev=0).
    
    Analytic reference:
        X = 1737.4 * cos(0) * cos(90°) = 0.0 km
        Y = 1737.4 * cos(0) * sin(90°) = 1737.4 km
        Z = 0.0 km
    """
    pos = selenographic_to_cartesian(latitude_deg=0.0, longitude_deg=90.0, elevation_km=0.0)

    assert pos.x_km == pytest.approx(0.0, abs=1e-9)
    assert pos.y_km == pytest.approx(1737.4, abs=1e-9)
    assert pos.z_km == pytest.approx(0.0, abs=1e-9)

    lat, lon, elev = cartesian_to_selenographic(pos.as_array())
    assert lat == pytest.approx(0.0, abs=1e-9)
    assert lon == pytest.approx(90.0, abs=1e-9)
    assert elev == pytest.approx(0.0, abs=1e-6)


def test_north_and_south_poles():
    """Verify North Pole (+90°) and South Pole (-90°) coordinates.
    
    Analytic reference:
        North Pole: X = 0, Y = 0, Z = +1737.4 km
        South Pole: X = 0, Y = 0, Z = -1737.4 km
    """
    pos_north = selenographic_to_cartesian(latitude_deg=90.0, longitude_deg=0.0, elevation_km=0.0)
    assert pos_north.x_km == pytest.approx(0.0, abs=1e-9)
    assert pos_north.y_km == pytest.approx(0.0, abs=1e-9)
    assert pos_north.z_km == pytest.approx(1737.4, abs=1e-9)

    pos_south = selenographic_to_cartesian(latitude_deg=-90.0, longitude_deg=45.0, elevation_km=0.0)
    assert pos_south.x_km == pytest.approx(0.0, abs=1e-9)
    assert pos_south.y_km == pytest.approx(0.0, abs=1e-9)
    assert pos_south.z_km == pytest.approx(-1737.4, abs=1e-9)


def test_positive_and_negative_latitudes():
    """Verify general mid-latitude sites in northern and southern hemispheres."""
    # Northern hemisphere: 45°N, 45°E
    r = 1737.4
    expected_x = r * math.cos(math.pi / 4) * math.cos(math.pi / 4)  # r * 0.5 = 868.7
    expected_y = r * math.cos(math.pi / 4) * math.sin(math.pi / 4)  # r * 0.5 = 868.7
    expected_z = r * math.sin(math.pi / 4)  # r * sqrt(2)/2 ≈ 1228.5273

    pos_north = selenographic_to_cartesian(latitude_deg=45.0, longitude_deg=45.0, elevation_km=0.0)
    assert pos_north.x_km == pytest.approx(expected_x, rel=1e-7)
    assert pos_north.y_km == pytest.approx(expected_y, rel=1e-7)
    assert pos_north.z_km == pytest.approx(expected_z, rel=1e-7)

    # Southern hemisphere: -45°S, -45°W
    pos_south = selenographic_to_cartesian(latitude_deg=-45.0, longitude_deg=-45.0, elevation_km=0.0)
    assert pos_south.x_km == pytest.approx(expected_x, rel=1e-7)
    assert pos_south.y_km == pytest.approx(-expected_y, rel=1e-7)
    assert pos_south.z_km == pytest.approx(-expected_z, rel=1e-7)


def test_zero_and_nonzero_site_elevation():
    """Verify that radial elevation modifies the geocentric radius r = R + h."""
    # Shackleton ridge candidate: elevation 1.1 km
    pos_elev = selenographic_to_cartesian(
        latitude_deg=-89.44, longitude_deg=138.0, elevation_km=1.1
    )
    assert pos_elev.radius_km == pytest.approx(1737.4 + 1.1, abs=1e-9)
    assert np.linalg.norm(pos_elev.as_array()) == pytest.approx(1738.5, abs=1e-9)

    # Invert
    lat, lon, elev = cartesian_to_selenographic(pos_elev.as_array())
    assert lat == pytest.approx(-89.44, abs=1e-5)
    assert lon == pytest.approx(138.0, abs=1e-5)
    assert elev == pytest.approx(1.1, abs=1e-5)


def test_invalid_coordinates_and_non_finite_rejection():
    """Verify bounds enforcement and rejection of non-finite inputs."""
    with pytest.raises(ValueError) as exc:
        selenographic_to_cartesian(latitude_deg=90.1, longitude_deg=0.0)
    assert "Latitude must be between -90.0 and +90.0" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        selenographic_to_cartesian(latitude_deg=-90.1, longitude_deg=0.0)
    assert "Latitude must be between -90.0 and +90.0" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        selenographic_to_cartesian(latitude_deg=0.0, longitude_deg=180.1)
    assert "Longitude must be between -180.0 and +180.0" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        selenographic_to_cartesian(latitude_deg=float("nan"), longitude_deg=0.0)
    assert "finite" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        selenographic_to_cartesian(latitude_deg=0.0, longitude_deg=float("inf"))
    assert "finite" in str(exc.value)


def test_cartesian_to_selenographic_zero_length_and_dimension_rejection():
    """Verify that zero-length vectors and invalid dimensions raise ValueError."""
    with pytest.raises(ValueError) as exc:
        cartesian_to_selenographic([0.0, 0.0, 0.0])
    assert "near zero" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        cartesian_to_selenographic([1000.0, 2000.0])
    assert "shape (3,)" in str(exc.value)


def test_reproducibility():
    """Verify that identical inputs produce bit-level identical outputs."""
    p1 = selenographic_to_cartesian(latitude_deg=-89.44, longitude_deg=138.0, elevation_km=1.1)
    p2 = selenographic_to_cartesian(latitude_deg=-89.44, longitude_deg=138.0, elevation_km=1.1)
    assert p1 == p2
