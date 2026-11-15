"""Unit tests for SpiceManager kernel lifecycle, checksum verification, transactional rollback, and lifespan."""

from pathlib import Path
import shutil
import tempfile
from fastapi.testclient import TestClient
import pytest
import spiceypy as spice

from app.core.config import Settings
from app.main import create_app
from app.services.spice_manager import (
    OFFICIAL_LUNAR_KERNELS,
    KernelIntegrityError,
    KernelMissingError,
    SpiceManager,
)


@pytest.fixture(autouse=True)
def clean_spice_state():
    """Ensure clean SPICE state before and after each test."""
    SpiceManager.unload_all()
    yield
    SpiceManager.unload_all()


def test_missing_kernel_raises_actionable_error():
    """Verify that an absent kernel raises KernelMissingError with clear download guidance."""
    with tempfile.TemporaryDirectory() as empty_dir:
        manager = SpiceManager(kernel_dir=empty_dir)
        with pytest.raises(KernelMissingError) as exc_info:
            manager.verify_kernel("lsk")
        assert "Required NAIF SPICE kernel 'naif0012.tls'" in str(exc_info.value)
        assert "Download from: https://naif.jpl.nasa.gov" in str(exc_info.value)


def test_corrupted_kernel_raises_integrity_error():
    """Verify that a corrupted or truncated kernel raises KernelIntegrityError."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        bad_lsk = tmp_path / "naif0012.tls"
        bad_lsk.write_text("CORRUPTED DUMMY KERNEL DATA", encoding="utf-8")

        manager = SpiceManager(kernel_dir=tmp_path)
        with pytest.raises(KernelIntegrityError) as exc_info:
            manager.verify_kernel("lsk", verify_checksum=True)
        assert "Kernel integrity verification failed for 'naif0012.tls'" in str(exc_info.value)
        assert "Expected SHA-256:" in str(exc_info.value)


def test_kernel_loading_and_idempotency():
    """Verify that all DE440 lunar kernels load into SPICE and redundant loads are no-ops."""
    manager = SpiceManager(kernel_dir="data/kernels")
    assert not SpiceManager.is_loaded()

    # Initial load
    loaded_first = manager.load_kernels(verify_checksums=True)
    assert loaded_first == 3
    assert SpiceManager.is_loaded()

    # Second load must be a no-op (idempotent)
    loaded_second = manager.load_kernels(verify_checksums=True)
    assert loaded_second == 0

    # Verify frame recognitions in CSPICE pool
    assert spice.namfrm("MOON_ME") == 31001
    assert spice.namfrm("MOON_PA") == 31000
    assert spice.namfrm("MOON_PA_DE440") == 31008
    assert spice.namfrm("MOON_ME_DE440_ME421") == 31009

    # Unload owned and verify clean state
    unloaded = SpiceManager.unload_owned()
    assert unloaded == 3
    assert not SpiceManager.is_loaded()
    assert len(SpiceManager.get_loaded_kernel_paths()) == 0


def test_partial_kernel_loading_failure_and_transactional_rollback():
    """Verify that if one kernel fails verification, any previously furnished kernels in that transaction are rolled back."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        prod_dir = Path("data/kernels")

        # Copy valid LSK and FK
        shutil.copy(prod_dir / "naif0012.tls", tmp_path / "naif0012.tls")
        shutil.copy(prod_dir / "moon_de440_250416.tf", tmp_path / "moon_de440_250416.tf")

        # Create a corrupt PCK
        bad_pck = tmp_path / "moon_pa_de440_200625.bpc"
        bad_pck.write_bytes(b"CORRUPT_PCK_DATA")

        manager = SpiceManager(kernel_dir=tmp_path)
        with pytest.raises(KernelIntegrityError):
            manager.load_kernels(verify_checksums=True)

        # Assert transactional rollback: No kernels remain loaded
        assert not SpiceManager.is_loaded()
        assert len(SpiceManager.get_loaded_kernel_paths()) == 0
        assert spice.ktotal("ALL") == 0


def test_repeated_loading_and_unloading():
    """Verify that repeatedly loading and unloading kernels does not leak kernel pool entries."""
    manager = SpiceManager(kernel_dir="data/kernels")
    for _ in range(5):
        loaded = manager.load_kernels(verify_checksums=True)
        assert loaded == 3
        assert SpiceManager.is_loaded()
        unloaded = SpiceManager.unload_owned()
        assert unloaded == 3
        assert not SpiceManager.is_loaded()
        assert spice.ktotal("ALL") == 0


def test_multiple_spice_manager_instances():
    """Verify that multiple SpiceManager instances share synchronized tracking and do not collide."""
    m1 = SpiceManager(kernel_dir="data/kernels")
    m2 = SpiceManager(kernel_dir="data/kernels")

    # Load through m1
    assert m1.load_kernels() == 3
    assert m1.is_loaded()
    assert m2.is_loaded()

    # m2 load is idempotent no-op
    assert m2.load_kernels() == 0

    # Unload through m2
    assert m2.unload_owned() == 3
    assert not m1.is_loaded()
    assert not m2.is_loaded()


def test_detection_of_external_kernel_pool_desynchronization():
    """Verify that external kclear() is detected by is_loaded() and tracking is reconciled."""
    manager = SpiceManager(kernel_dir="data/kernels")
    manager.load_kernels()
    assert SpiceManager.is_loaded()

    # External component calls raw kclear
    spice.kclear()

    # is_loaded() should detect total < expected and reset tracking
    assert not SpiceManager.is_loaded()
    assert len(SpiceManager.get_loaded_kernel_paths()) == 0


def test_detection_of_single_kernel_unload_desynchronization():
    """Verify that unloading a single kernel externally is detected by identity check."""
    manager = SpiceManager(kernel_dir="data/kernels")
    manager.load_kernels()
    assert SpiceManager.is_loaded()

    # External component unloads only the PCK file
    pck_path = str((Path("data/kernels") / "moon_pa_de440_200625.bpc").resolve())
    spice.unload(pck_path)

    # is_loaded() must detect that specific kernel identity is missing from the pool
    assert not SpiceManager.is_loaded()
    assert len(SpiceManager.get_loaded_kernel_paths()) == 0


def test_fastapi_lifespan_startup_and_shutdown():
    """Verify that FastAPI lifespan initializes kernels on startup and cleans up on shutdown."""
    settings = Settings(app_name="LUNAR WINDOW", spice_kernel_dir="data/kernels")
    app = create_app(settings=settings)

    # Within TestClient context, lifespan runs
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        # Check app.state.spice_manager is populated and kernels are loaded
        assert hasattr(app.state, "spice_manager")
        assert app.state.spice_manager.is_loaded()

    # Outside TestClient context, shutdown has executed
    assert not SpiceManager.is_loaded()


def test_fastapi_lifespan_startup_failure_on_missing_kernels():
    """Verify that FastAPI startup fails clearly when required kernels are missing."""
    with tempfile.TemporaryDirectory() as empty_dir:
        settings = Settings(app_name="LUNAR WINDOW", spice_kernel_dir=empty_dir)
        app = create_app(settings=settings)

        with pytest.raises(KernelMissingError):
            with TestClient(app):
                pass
