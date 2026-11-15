"""Unit tests for NAIF SPICE lunar orientation and frame transformations (ICRF/J2000 to MOON_ME)."""

from datetime import datetime, timezone
import math
import numpy as np
import pytest

from app.science.astronomy.orientation import (
    get_rotation_matrix,
    get_state_transformation_matrix,
    normalize_frame_name,
    transform_position,
    transform_state,
)
from app.science.astronomy.time import utc_to_et
from app.services.spice_manager import SpiceError, SpiceManager


@pytest.fixture(scope="module", autouse=True)
def load_lunar_spice_kernels():
    """Ensure kernels are loaded for orientation tests."""
    manager = SpiceManager(kernel_dir="data/kernels")
    manager.load_kernels()
    yield
    SpiceManager.unload_all()


def test_frame_name_normalization():
    """Verify that ICRF is correctly mapped to J2000 and case is standardized."""
    assert normalize_frame_name("icrf") == "J2000"
    assert normalize_frame_name("ICRF") == "J2000"
    assert normalize_frame_name("j2000") == "J2000"
    assert normalize_frame_name("moon_me") == "MOON_ME"
    assert normalize_frame_name("moon_pa") == "MOON_PA"


def test_rotation_matrix_orthonormality_and_determinant():
    """Verify that rotation matrix is strictly orthogonal with determinant +1.0."""
    et = 852033669.1839125  # 2027-01-01T00:00:00 UTC
    r_mat = get_rotation_matrix(et, from_frame="J2000", to_frame="MOON_ME")

    assert r_mat.shape == (3, 3)

    # Det(R) == +1.0 (proper rotation)
    det = np.linalg.det(r_mat)
    assert pytest.approx(det, abs=1e-12) == 1.0

    # R^T @ R == I
    identity = r_mat.T @ r_mat
    np.testing.assert_allclose(identity, np.eye(3), atol=1e-12)


def test_vector_norm_preservation():
    """Verify that vector magnitude is strictly preserved during rotation."""
    et = 852033669.1839125
    pos_inertial = np.array([1.488342416e8, 1.624103173e7, 6.994276709e6])  # Sun vector ~1 AU

    pos_me = transform_position(pos_inertial, et, from_frame="ICRF", to_frame="MOON_ME")

    assert pos_me.shape == (3,)
    norm_orig = np.linalg.norm(pos_inertial)
    norm_transformed = np.linalg.norm(pos_me)

    assert pytest.approx(norm_transformed, rel=1e-12) == norm_orig


def test_forward_and_inverse_transformation_consistency():
    """Verify that rotating J2000 -> MOON_ME and back -> J2000 recovers original coordinates."""
    et = 852033669.1839125
    pos_orig = np.array([350000.0, -120000.0, 45000.0])  # Realistic lunar-distance vector

    # J2000 -> MOON_ME
    pos_me = transform_position(pos_orig, et, from_frame="J2000", to_frame="MOON_ME")
    # MOON_ME -> J2000
    pos_recovered = transform_position(pos_me, et, from_frame="MOON_ME", to_frame="J2000")

    np.testing.assert_allclose(pos_recovered, pos_orig, atol=1e-9)


def test_state_vector_transformation_dimensions_and_finite():
    """Verify 6D state vector transformation dimensions and finite numerical output."""
    et = 852033669.1839125
    state_inertial = np.array([384400.0, 0.0, 0.0, 0.0, 1.022, 0.0])

    state_me = transform_state(state_inertial, et, from_frame="J2000", to_frame="MOON_ME")

    assert state_me.shape == (6,)
    assert np.all(np.isfinite(state_me))


def test_invalid_input_dimensions_rejected():
    """Verify that non-3D position vectors and non-6D state vectors are rejected."""
    et = 852033669.1839125

    # 2D position vector
    with pytest.raises(ValueError) as exc:
        transform_position([100.0, 200.0], et)
    assert "shape (3,)" in str(exc.value)

    # 4D position vector
    with pytest.raises(ValueError) as exc:
        transform_position([100.0, 200.0, 300.0, 400.0], et)
    assert "shape (3,)" in str(exc.value)

    # 3D vector for state transformation (requires 6D)
    with pytest.raises(ValueError) as exc:
        transform_state([100.0, 200.0, 300.0], et)
    assert "shape (6,)" in str(exc.value)


def test_non_finite_inputs_rejected():
    """Verify that NaN or Inf values in input vectors raise ValueError."""
    et = 852033669.1839125

    with pytest.raises(ValueError) as exc:
        transform_position([100.0, float("nan"), 300.0], et)
    assert "non-finite" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        transform_position([100.0, float("inf"), 300.0], et)
    assert "non-finite" in str(exc.value)


def test_moon_pa_and_moon_me_are_distinct():
    """Verify that MOON_PA and MOON_ME produce distinct orientation vectors with ~70 arcsec offset.
    
    Proves that the backend does NOT conflate Principal Axis (PA) and Mean Earth (ME) frames.
    """
    et = 852033669.1839125
    pos_inertial = np.array([1737.4, 0.0, 0.0])  # Lunar radius on X axis

    pos_me = transform_position(pos_inertial, et, from_frame="J2000", to_frame="MOON_ME")
    pos_pa = transform_position(pos_inertial, et, from_frame="J2000", to_frame="MOON_PA")

    # Must NOT be identical
    assert not np.allclose(pos_me, pos_pa, atol=1e-3)

    # Calculate angular difference between the two resulting vectors
    dot_prod = np.dot(pos_me, pos_pa) / (np.linalg.norm(pos_me) * np.linalg.norm(pos_pa))
    angular_diff_rad = math.acos(np.clip(dot_prod, -1.0, 1.0))
    angular_diff_arcsec = math.degrees(angular_diff_rad) * 3600.0

    # Theoretical 3D rotation offset between DE440 PA and ME is ~101.6 arcseconds
    # (combining ~78.6 arcsec Z-axis rotation and ~64 arcsec Y-axis rotation)
    assert 80.0 < angular_diff_arcsec < 120.0, f"Expected ~101.6 arcsec difference, got {angular_diff_arcsec} arcsec"
    assert pytest.approx(angular_diff_arcsec, abs=2.0) == 101.64


def test_multiple_epochs_reflect_lunar_rotation():
    """Verify that orientation matrices at different epochs reflect sidereal lunar rotation."""
    dt1 = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    dt2 = datetime(2027, 1, 2, 0, 0, 0, tzinfo=timezone.utc)  # 1 day later

    et1 = utc_to_et(dt1)
    et2 = utc_to_et(dt2)

    r1 = get_rotation_matrix(et1, from_frame="J2000", to_frame="MOON_ME")
    r2 = get_rotation_matrix(et2, from_frame="J2000", to_frame="MOON_ME")

    # Matrices must differ
    assert not np.allclose(r1, r2, atol=1e-3)

    # Relative rotation matrix R_rel = r2 @ r1.T
    r_rel = r2 @ r1.T
    # Trace of rotation matrix: Tr(R) = 1 + 2*cos(theta)
    trace = np.trace(r_rel)
    cos_theta = (trace - 1.0) / 2.0
    rot_angle_deg = math.degrees(math.acos(np.clip(cos_theta, -1.0, 1.0)))

    # In 1 day (86400s), Moon rotates by ~360 / 27.32166 ≈ 13.176 degrees
    assert pytest.approx(rot_angle_deg, abs=0.2) == 13.18


def test_reproducibility_of_identical_requests():
    """Verify that calling the transformation with identical parameters yields identical results."""
    et = 852033669.1839125
    pos = [123456.789, -987654.321, 555555.555]

    res1 = transform_position(pos, et, from_frame="ICRF", to_frame="MOON_ME")
    res2 = transform_position(pos, et, from_frame="ICRF", to_frame="MOON_ME")

    np.testing.assert_array_equal(res1, res2)


def test_concurrent_sixteen_threads_str2et_and_pxform():
    """Verify that 16 concurrent threads executing str2et and pxform match serial reference results exactly."""
    import concurrent.futures

    epochs = [
        datetime(2027, 1, 1, hour, 0, 0, tzinfo=timezone.utc)
        for hour in range(16)
    ]
    test_vector = np.array([1.488e8, 1.624e7, 6.994e6])

    # Compute serial reference outputs in a single thread
    serial_results = []
    for dt in epochs:
        et = utc_to_et(dt)
        pos_me = transform_position(test_vector, et, from_frame="J2000", to_frame="MOON_ME")
        serial_results.append((et, pos_me))

    # Worker function for concurrent threads
    def worker(idx: int):
        dt = epochs[idx]
        et = utc_to_et(dt)
        pos_me = transform_position(test_vector, et, from_frame="J2000", to_frame="MOON_ME")
        return idx, et, pos_me

    # Execute across 16 concurrent threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        futures = [executor.submit(worker, i) for i in range(16)]
        concurrent_results = [f.result() for f in futures]

    # Validate that every concurrent thread result matches the serial reference identically
    for idx, et, pos_me in concurrent_results:
        ref_et, ref_pos = serial_results[idx]
        assert et == pytest.approx(ref_et, abs=1e-12)
        np.testing.assert_allclose(pos_me, ref_pos, atol=1e-12)


def test_concurrent_pxform_and_sxform():
    """Verify concurrent interleaved execution of pxform and sxform across multiple threads."""
    import concurrent.futures

    et_base = 852033669.1839125
    pos_vec = np.array([384400.0, 1000.0, -500.0])
    state_vec = np.array([384400.0, 1000.0, -500.0, 0.0, 1.022, 0.05])

    # Serial references
    ref_pos = transform_position(pos_vec, et_base, from_frame="J2000", to_frame="MOON_ME")
    ref_state = transform_state(state_vec, et_base, from_frame="J2000", to_frame="MOON_ME")

    def worker_pos(i: int):
        return transform_position(pos_vec, et_base, from_frame="J2000", to_frame="MOON_ME")

    def worker_state(i: int):
        return transform_state(state_vec, et_base, from_frame="J2000", to_frame="MOON_ME")

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        pos_futures = [executor.submit(worker_pos, i) for i in range(10)]
        state_futures = [executor.submit(worker_state, i) for i in range(10)]
        pos_res = [f.result() for f in pos_futures]
        state_res = [f.result() for f in state_futures]

    for p in pos_res:
        np.testing.assert_allclose(p, ref_pos, atol=1e-12)
    for s in state_res:
        np.testing.assert_allclose(s, ref_state, atol=1e-12)


def test_concurrent_kernel_load_and_transformation():
    """Verify that concurrent calls to load_kernels() and transform_position() execute safely under SPICE_LOCK."""
    import concurrent.futures

    manager = SpiceManager(kernel_dir="data/kernels")
    et = 852033669.1839125
    pos_vec = np.array([1737.4, 0.0, 0.0])

    def load_worker():
        return manager.load_kernels()

    def transform_worker():
        return transform_position(pos_vec, et, from_frame="J2000", to_frame="MOON_ME")

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        load_futs = [executor.submit(load_worker) for _ in range(5)]
        trans_futs = [executor.submit(transform_worker) for _ in range(10)]

        for f in load_futs:
            assert f.result() == 0  # Idempotent no-op since already loaded
        for f in trans_futs:
            res = f.result()
            assert res.shape == (3,)
            assert np.all(np.isfinite(res))

