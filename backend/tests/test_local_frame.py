"""Unit tests for the local East-North-Up (ENU) topocentric reference frame."""

import math
import numpy as np
import pytest

from app.science.geometry.local_frame import (
    ENUBasis,
    cartesian_to_enu,
    compute_enu_basis,
    get_cartesian_to_enu_matrix,
)


def test_enu_basis_orthonormality_and_right_handedness():
    """Verify that ENU basis vectors are unit length, mutually orthogonal, and form a right-handed system."""
    test_locations = [
        (0.0, 0.0),       # Equator prime meridian
        (0.0, 90.0),      # Equator 90°E
        (0.0, -90.0),     # Equator 90°W
        (45.0, 45.0),     # Mid-latitude North
        (-45.0, -45.0),   # Mid-latitude South
        (85.0, 120.0),    # High North
        (-89.44, 138.0),  # Shackleton South Pole candidate site
        (90.0, 0.0),      # Exact North Pole
        (-90.0, 0.0),     # Exact South Pole
    ]

    for lat, lon in test_locations:
        basis = compute_enu_basis(lat, lon)
        e, n, u = basis.east, basis.north, basis.up

        # 1. Unit lengths
        assert np.linalg.norm(e) == pytest.approx(1.0, abs=1e-12)
        assert np.linalg.norm(n) == pytest.approx(1.0, abs=1e-12)
        assert np.linalg.norm(u) == pytest.approx(1.0, abs=1e-12)

        # 2. Mutual orthogonality
        assert np.dot(e, n) == pytest.approx(0.0, abs=1e-12)
        assert np.dot(e, u) == pytest.approx(0.0, abs=1e-12)
        assert np.dot(n, u) == pytest.approx(0.0, abs=1e-12)

        # 3. Right-handed coordinate basis: e x n == u
        cross_prod = np.cross(e, n)
        np.testing.assert_allclose(cross_prod, u, atol=1e-12)

        # 4. Rotation matrix determinant == +1.0
        matrix = basis.as_rotation_matrix()
        assert np.linalg.det(matrix) == pytest.approx(1.0, abs=1e-12)

        # 5. Orthogonality: M^T @ M == I
        np.testing.assert_allclose(matrix.T @ matrix, np.eye(3), atol=1e-12)


def test_equatorial_zero_longitude_enu_orientation():
    """Verify analytic basis at equator prime meridian (lat=0, lon=0).
    
    Analytic reference:
        u_hat = [cos(0)*cos(0), cos(0)*sin(0), sin(0)] = [1, 0, 0]  (radial outward along +X)
        e_hat = [-sin(0), cos(0), 0]                   = [0, 1, 0]  (pointing East along +Y)
        n_hat = u_hat x e_hat                          = [0, 0, 1]  (pointing North along +Z)
    """
    basis = compute_enu_basis(latitude_deg=0.0, longitude_deg=0.0)

    np.testing.assert_allclose(basis.up, [1.0, 0.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(basis.east, [0.0, 1.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(basis.north, [0.0, 0.0, 1.0], atol=1e-12)

    # Test cartesian_to_enu projection at this site:
    # Vector along +X (radially outward) should be purely Up: [0, 0, 10]
    v_rad = [10.0, 0.0, 0.0]
    enu_rad = cartesian_to_enu(v_rad, latitude_deg=0.0, longitude_deg=0.0)
    np.testing.assert_allclose(enu_rad, [0.0, 0.0, 10.0], atol=1e-12)

    # Vector along +Y should be purely East: [10, 0, 0]
    v_east = [0.0, 10.0, 0.0]
    enu_east = cartesian_to_enu(v_east, latitude_deg=0.0, longitude_deg=0.0)
    np.testing.assert_allclose(enu_east, [10.0, 0.0, 0.0], atol=1e-12)

    # Vector along +Z should be purely North: [0, 10, 0]
    v_north = [0.0, 0.0, 10.0]
    enu_north = cartesian_to_enu(v_north, latitude_deg=0.0, longitude_deg=0.0)
    np.testing.assert_allclose(enu_north, [0.0, 10.0, 0.0], atol=1e-12)


def test_equatorial_ninety_deg_east_enu_orientation():
    """Verify analytic basis at equator 90°E (lat=0, lon=90°).
    
    Analytic reference:
        u_hat = [0, 1, 0]  (radial outward along +Y)
        e_hat = [-1, 0, 0] (pointing East toward -X)
        n_hat = [0, 0, 1]  (pointing North toward +Z)
    """
    basis = compute_enu_basis(latitude_deg=0.0, longitude_deg=90.0)

    np.testing.assert_allclose(basis.up, [0.0, 1.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(basis.east, [-1.0, 0.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(basis.north, [0.0, 0.0, 1.0], atol=1e-12)


def test_polar_singularity_behavior():
    """Verify mathematically sound behavior at exact North Pole (+90°) and South Pole (-90°)."""
    # North Pole: Up is [0, 0, 1]
    basis_np = compute_enu_basis(latitude_deg=90.0, longitude_deg=0.0)
    np.testing.assert_allclose(basis_np.up, [0.0, 0.0, 1.0], atol=1e-12)
    np.testing.assert_allclose(basis_np.east, [0.0, 1.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(basis_np.north, [-1.0, 0.0, 0.0], atol=1e-12)
    assert np.linalg.det(basis_np.as_rotation_matrix()) == pytest.approx(1.0, abs=1e-12)

    # South Pole: Up is [0, 0, -1]
    basis_sp = compute_enu_basis(latitude_deg=-90.0, longitude_deg=0.0)
    np.testing.assert_allclose(basis_sp.up, [0.0, 0.0, -1.0], atol=1e-12)
    np.testing.assert_allclose(basis_sp.east, [0.0, 1.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(basis_sp.north, [1.0, 0.0, 0.0], atol=1e-12)
    assert np.linalg.det(basis_sp.as_rotation_matrix()) == pytest.approx(1.0, abs=1e-12)


def test_invalid_and_non_finite_inputs():
    """Verify input validation and non-finite rejection."""
    with pytest.raises(ValueError):
        compute_enu_basis(latitude_deg=95.0, longitude_deg=0.0)

    with pytest.raises(ValueError):
        compute_enu_basis(latitude_deg=0.0, longitude_deg=185.0)

    with pytest.raises(ValueError):
        compute_enu_basis(latitude_deg=float("nan"), longitude_deg=0.0)

    with pytest.raises(ValueError):
        cartesian_to_enu([1.0, 2.0], latitude_deg=0.0, longitude_deg=0.0)

    with pytest.raises(ValueError):
        cartesian_to_enu([1.0, float("inf"), 3.0], latitude_deg=0.0, longitude_deg=0.0)
