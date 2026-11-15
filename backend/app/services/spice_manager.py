"""NAIF SPICE kernel manager for lunar orientation and frame transformations.

Locates, validates checksum integrity, and safely loads DE440-compatible NAIF SPICE
kernels (LSK, FK, binary PCK) required to transform Moon-centered celestial inertial
vectors (ICRF/J2000) into the body-fixed selenographic MOON_ME reference frame.

Kernel Management Architecture:
- Centralized Concurrency: All native CSPICE operations are serialized via SPICE_LOCK.
- Transactional Loading: If any kernel or frame verification fails, only kernels introduced
  by that transaction are rolled back in reverse order (via spice.unload), preserving
  pre-existing kernels.
- Pool Desync Detection: Detects discrepancies if external code calls spice.kclear().
- Mandatory Integrity: Enforces SHA-256 cryptographic verification before loading.
- Binary Exclusion: All binary kernels are kept outside Git tracking.
"""

from dataclasses import dataclass
import functools
import hashlib
from pathlib import Path
import threading
from typing import Any, Callable, Dict, List, Optional, Set, TypeVar
import httpx
import spiceypy as spice

from app.core.config import get_settings

F = TypeVar("F", bound=Callable[..., Any])

# Process-wide recursive mutex serializing all non-reentrant native CSPICE operations
SPICE_LOCK = threading.RLock()


def synchronized_spice(func: F) -> F:
    """Decorator to serialize any native CSPICE function call with the global process lock.
    
    CSPICE is fundamentally a non-reentrant C library with internal static memory buffers.
    All calls to pxform, sxform, str2et, et2utc, furnsh, unload, and kclear must be serialized
    through SPICE_LOCK to guarantee thread safety in multi-threaded asynchronous servers.
    """
    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        with SPICE_LOCK:
            return func(*args, **kwargs)
    return wrapper  # type: ignore[return-value]


class SpiceError(Exception):
    """Base exception for NAIF SPICE operations."""
    pass


class KernelMissingError(SpiceError):
    """Raised when a required NAIF SPICE kernel is not found on disk."""
    pass


class KernelIntegrityError(SpiceError):
    """Raised when a local SPICE kernel's cryptographic hash does not match expected reference."""
    pass


class KernelCompatibilityError(SpiceError):
    """Raised when a loaded kernel fails compatibility or coverage verification."""
    pass


@dataclass(frozen=True)
class KernelMetadata:
    """Authoritative metadata and integrity specification for a NAIF SPICE kernel."""
    filename: str
    kernel_type: str  # LSK, FK, PCK
    description: str
    sha256: str
    size_bytes: int
    source_url: str
    coverage: str
    required_frames: List[str]


# Authoritative DE440 NAIF Lunar Frame Specification
OFFICIAL_LUNAR_KERNELS: Dict[str, KernelMetadata] = {
    "lsk": KernelMetadata(
        filename="naif0012.tls",
        kernel_type="LSK",
        description="Official NAIF Leapseconds Kernel (LSK)",
        sha256="678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b",
        size_bytes=5257,
        source_url="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        coverage="1972-01-01 through active IERS bulletin schedule",
        required_frames=[],
    ),
    "fk": KernelMetadata(
        filename="moon_de440_250416.tf",
        kernel_type="FK",
        description="Official NAIF Lunar Frame Definition Kernel (DE440 compatible)",
        sha256="a47c71e9c9f33796bdafb2c9d69a7ee447b6016ecad80f71cd6f3e479f9cf768",
        size_bytes=19478,
        source_url="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf",
        coverage="Infinite / Mathematical Frame Realization",
        required_frames=["MOON_PA", "MOON_ME", "MOON_PA_DE440", "MOON_ME_DE440_ME421"],
    ),
    "pck": KernelMetadata(
        filename="moon_pa_de440_200625.bpc",
        kernel_type="PCK",
        description="Official NAIF High-Precision Binary Lunar Orientation PCK (DE440)",
        sha256="60cd55aa401ea2ea97360636f567554bfe4e37bb829f901b4460a455dfaf783f",
        size_bytes=12863488,
        source_url="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc",
        coverage="1549-DEC-31 00:00:00 ET to 2650-JAN-25 00:00:00 ET",
        required_frames=["MOON_PA_DE440"],
    ),
}


class SpiceManager:
    """Thread-safe lifecycle manager for NASA/NAIF SPICE kernels."""

    _instance_lock = SPICE_LOCK
    _loaded_kernels: Set[str] = set()

    def __init__(self, kernel_dir: Optional[Path | str] = None):
        """Initialize SPICE manager with specific or default kernel directory.
        
        Args:
            kernel_dir: Path to directory containing required SPICE kernels.
                        Defaults to configured Settings.spice_kernel_dir.
        """
        if kernel_dir is not None:
            self.kernel_dir = Path(kernel_dir)
        else:
            settings = get_settings()
            self.kernel_dir = Path(settings.spice_kernel_dir)

    @staticmethod
    def compute_sha256(file_path: Path) -> str:
        """Calculate hexadecimal SHA-256 digest of a local file."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def verify_kernel(self, key: str, verify_checksum: bool = True) -> Path:
        """Locate and verify a single required kernel.
        
        Args:
            key: Kernel identifier ('lsk', 'fk', or 'pck').
            verify_checksum: When True, enforces SHA-256 hash match against official reference.
            
        Returns:
            Path to verified kernel file.
            
        Raises:
            KernelMissingError: If file is absent.
            KernelIntegrityError: If checksum does not match authoritative reference.
        """
        if key not in OFFICIAL_LUNAR_KERNELS:
            raise ValueError(f"Unknown kernel key '{key}'. Supported: {list(OFFICIAL_LUNAR_KERNELS.keys())}")

        meta = OFFICIAL_LUNAR_KERNELS[key]
        file_path = self.kernel_dir / meta.filename

        if not file_path.exists():
            raise KernelMissingError(
                f"Required NAIF SPICE kernel '{meta.filename}' ({meta.description}) is missing from '{self.kernel_dir}'. "
                f"Download from: {meta.source_url}"
            )

        if verify_checksum:
            actual_hash = self.compute_sha256(file_path)
            if actual_hash != meta.sha256:
                raise KernelIntegrityError(
                    f"Kernel integrity verification failed for '{meta.filename}'.\n"
                    f"Expected SHA-256: {meta.sha256}\n"
                    f"Actual SHA-256:   {actual_hash}\n"
                    f"File may be corrupted, truncated, or an unverified version. Please re-download from {meta.source_url}."
                )

        return file_path

    def verify_all_kernels(self, verify_checksums: bool = True) -> Dict[str, Path]:
        """Verify presence and integrity of all required DE440 lunar kernels.
        
        Returns:
            Dictionary mapping kernel key to resolved local Path.
        """
        resolved: Dict[str, Path] = {}
        for key in OFFICIAL_LUNAR_KERNELS:
            resolved[key] = self.verify_kernel(key, verify_checksum=verify_checksums)
        return resolved

    def load_kernels(self, verify_checksums: bool = True) -> int:
        """Safely and transactionally load all required lunar orientation kernels into CSPICE.
        
        Guarantees transactional rollback: If any kernel fails to load or fails frame verification,
        only the kernels introduced by this transaction are unloaded via spice.unload() in reverse
        order, preserving previously loaded kernels while keeping CSPICE in a consistent state.
        
        Args:
            verify_checksums: Enforce SHA-256 hash verification before loading.
            
        Returns:
            Number of newly loaded kernels.
            
        Raises:
            KernelMissingError: When any kernel is absent.
            KernelIntegrityError: When any kernel fails cryptographic verification.
            SpiceError: When CSPICE fails to parse or load a kernel.
        """
        with SPICE_LOCK:
            # Detect desynchronization if external code cleared CSPICE pool
            try:
                total_in_pool = spice.ktotal("ALL")
                if self._loaded_kernels and total_in_pool == 0:
                    self._loaded_kernels.clear()
            except Exception:
                self._loaded_kernels.clear()

            verified_paths = self.verify_all_kernels(verify_checksums=verify_checksums)

            # Check if all are already loaded
            paths_to_load = [
                path for path in verified_paths.values()
                if str(path.resolve()) not in self._loaded_kernels
            ]

            if not paths_to_load and self._loaded_kernels:
                return 0

            # Furnish kernels in strict dependency order: LSK first, then FK, then PCK
            order = ["lsk", "fk", "pck"]
            new_count = 0
            transaction_loaded: List[str] = []

            try:
                for key in order:
                    path = verified_paths[key]
                    resolved_str = str(path.resolve())
                    if resolved_str not in self._loaded_kernels:
                        spice.furnsh(resolved_str)
                        transaction_loaded.append(resolved_str)
                        self._loaded_kernels.add(resolved_str)
                        new_count += 1

                # Verify that required frames are now recognized by CSPICE
                for frame_name in ["MOON_ME", "MOON_PA"]:
                    frame_id = spice.namfrm(frame_name)
                    if frame_id == 0:
                        raise KernelCompatibilityError(
                            f"SPICE frame '{frame_name}' is not recognized after loading lunar frame kernels."
                        )

                return new_count

            except Exception:
                # TRANSACTIONAL ROLLBACK: Unload only kernels introduced during this transaction in reverse order
                for path_str in reversed(transaction_loaded):
                    try:
                        spice.unload(path_str)
                    except Exception:
                        pass
                    self._loaded_kernels.discard(path_str)
                raise

    @classmethod
    def unload_owned(cls) -> int:
        """Unload only the kernels owned and loaded by this manager instance in reverse order.
        
        Returns:
            Count of unloaded kernels.
        """
        with SPICE_LOCK:
            count = 0
            for path_str in list(cls._loaded_kernels):
                try:
                    spice.unload(path_str)
                    count += 1
                except Exception:
                    pass
            cls._loaded_kernels.clear()
            return count

    @classmethod
    def unload_all(cls) -> None:
        """Full coordinated reset: clear the entire CSPICE kernel pool via kclear()."""
        with SPICE_LOCK:
            try:
                spice.kclear()
            finally:
                cls._loaded_kernels.clear()

    @classmethod
    def is_loaded(cls) -> bool:
        """Check if all 3 official DE440 lunar kernels are currently loaded in CSPICE.
        
        Performs identity-level kernel pool verification using ktotal() and kdata()
        to detect external desynchronizations (e.g. if foreign code called kclear() or unloaded kernels).
        """
        with SPICE_LOCK:
            if not cls._loaded_kernels:
                return False
            try:
                total = spice.ktotal("ALL")
                if total < len(OFFICIAL_LUNAR_KERNELS):
                    cls._loaded_kernels.clear()
                    return False

                # Strengthen desynchronization detection by checking actual kernel file identities
                active_files_in_pool = set()
                for i in range(total):
                    file_name, _, _, _ = spice.kdata(i, "ALL")
                    active_files_in_pool.add(Path(file_name).resolve().as_posix().lower())

                for tracked_path in cls._loaded_kernels:
                    if Path(tracked_path).resolve().as_posix().lower() not in active_files_in_pool:
                        # Specific kernel identity missing from pool!
                        cls._loaded_kernels.clear()
                        return False

                return True
            except Exception:
                cls._loaded_kernels.clear()
                return False

    @classmethod
    def get_loaded_kernel_paths(cls) -> List[str]:
        """Return list of currently tracked loaded kernel file paths."""
        with SPICE_LOCK:
            return sorted(list(cls._loaded_kernels))

    @classmethod
    def download_kernels(cls, target_dir: Path | str, timeout: float = 60.0) -> Dict[str, Path]:
        """Explicit utility method to download authoritative NAIF kernels.
        
        Args:
            target_dir: Destination folder.
            timeout: Network request timeout in seconds.
            
        Returns:
            Dictionary mapping kernel key to Path of downloaded and verified file.
        """
        dest_dir = Path(target_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)
        results: Dict[str, Path] = {}

        for key, meta in OFFICIAL_LUNAR_KERNELS.items():
            dest_file = dest_dir / meta.filename
            if not dest_file.exists():
                with httpx.Client(timeout=timeout) as client:
                    resp = client.get(meta.source_url)
                    resp.raise_for_status()
                    with open(dest_file, "wb") as f:
                        f.write(resp.content)

            # Verify hash
            actual_hash = cls.compute_sha256(dest_file)
            if actual_hash != meta.sha256:
                dest_file.unlink(missing_ok=True)
                raise KernelIntegrityError(
                    f"Downloaded file '{meta.filename}' failed SHA-256 checksum verification: {actual_hash}"
                )
            results[key] = dest_file

        return results
