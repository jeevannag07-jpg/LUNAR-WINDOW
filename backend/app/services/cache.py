"""Deterministic file-backed caching service for astronomical ephemeris data.

Safeguards NASA JPL Horizons API from excessive or redundant queries by caching
ephemeris results keyed by canonical request parameters.

Concurrency Guarantees & Limitations:
- Same-Process Concurrency: Fully thread-safe. Protected via process-wide threading locks
  and unique UUID temporary files. Separate EphemerisCache instances in the same Python process
  share synchronization.
- Cross-Process Concurrency: Uses unique temporary filenames (PID + UUID) and atomic OS file
  replacement (Path.replace / os.replace). However, OS-level cross-process advisory file locking
  (e.g. msvcrt on Windows or fcntl on POSIX) is NOT implemented. On Windows, concurrent
  cross-process writes to the same key while another process has the destination file open
  may raise PermissionError.
"""

import hashlib
import json
import os
from pathlib import Path
import threading
from typing import Any, Dict, Optional
import uuid


class EphemerisCache:
    """Deterministic disk cache for ephemeris vector series with same-process concurrency safety."""

    # Class-level lock shared across all instances within the same Python process
    _process_lock = threading.Lock()

    def __init__(self, cache_dir: Path | str = ".cache/horizons"):
        """Initialize cache with specified directory path.
        
        Args:
            cache_dir: Directory where cache files are stored.
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    @staticmethod
    def generate_key(
        target_body: str,
        center: str,
        start_time_iso: str,
        end_time_iso: str,
        step_minutes: int,
        ref_plane: str = "FRAME",
        ref_system: str = "ICRF",
        time_type: str = "UT",
        vec_corr: str = "NONE",
        vec_table: str = "3",
        out_units: str = "KM-S",
        csv_format: str = "NO",
        schema_version: str = "v1",
    ) -> str:
        """Derive a deterministic SHA-256 cache key from all 13 canonical result-affecting parameters.
        
        The 13 canonical fields are:
        1. center
        2. csv_format
        3. end_time_iso
        4. out_units
        5. ref_plane
        6. ref_system
        7. schema_version
        8. start_time_iso
        9. step_minutes
        10. target_body
        11. time_type
        12. vec_corr
        13. vec_table
        
        Args:
            target_body: JPL NAIF ID or symbol (e.g. '10' for Sun, '399' for Earth).
            center: Coordinate center (e.g. '500@301' for Moon center of mass).
            start_time_iso: ISO 8601 UTC start string.
            end_time_iso: ISO 8601 UTC end string.
            step_minutes: Sampling step size in minutes.
            ref_plane: Reference plane specification (e.g. 'FRAME').
            ref_system: Celestial coordinate reference system (e.g. 'ICRF').
            time_type: Time scale standard (e.g. 'UT' for Universal Time).
            vec_corr: Aberration/light-time correction (e.g. 'NONE', 'LT').
            vec_table: Horizons vector table type ('1'=pos, '2'=pos+vel, '3'=full state).
            out_units: Physical units for vectors ('KM-S', 'AU-D').
            csv_format: Table delimiter format ('NO' for fixed-width, 'YES' for CSV).
            schema_version: Cache/parser schema namespace version.
            
        Returns:
            Hexadecimal SHA-256 digest string.
        """
        canonical_payload = {
            "center": str(center).strip(),
            "csv_format": str(csv_format).strip(),
            "end_time_iso": str(end_time_iso).strip(),
            "out_units": str(out_units).strip(),
            "ref_plane": str(ref_plane).strip(),
            "ref_system": str(ref_system).strip(),
            "schema_version": str(schema_version).strip(),
            "start_time_iso": str(start_time_iso).strip(),
            "step_minutes": int(step_minutes),
            "target_body": str(target_body).strip(),
            "time_type": str(time_type).strip(),
            "vec_corr": str(vec_corr).strip(),
            "vec_table": str(vec_table).strip(),
        }
        canonical_str = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def _get_path(self, key: str) -> Path:
        """Return the absolute file path for a given cache key."""
        return self.cache_dir / f"{key}.json"

    def has(self, key: str) -> bool:
        """Check if a valid cache file exists for the given key."""
        with EphemerisCache._process_lock:
            path = self._get_path(key)
            return path.is_file() and path.stat().st_size > 0

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached JSON payload if present, or return None.
        
        Args:
            key: Deterministic cache key.
            
        Returns:
            Cached dictionary or None if cache miss or corrupted.
        """
        with EphemerisCache._process_lock:
            path = self._get_path(key)
            if not path.is_file():
                return None

            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                # If cache file is corrupt or unreadable, treat as cache miss
                return None

    def set(self, key: str, data: Dict[str, Any]) -> None:
        """Atomically persist JSON data to disk cache.
        
        Uses process-wide locking, unique UUID temporary filenames, and atomic file
        replacement to prevent race conditions or corrupted partial reads across threads.
        
        Args:
            key: Deterministic cache key.
            data: Serializable dictionary payload.
        """
        path = self._get_path(key)
        temp_path = self.cache_dir / f"{key}.tmp.{os.getpid()}.{uuid.uuid4().hex}"

        with EphemerisCache._process_lock:
            try:
                with open(temp_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                temp_path.replace(path)
            except Exception:
                if temp_path.exists():
                    temp_path.unlink(missing_ok=True)
                raise

    def delete(self, key: str) -> bool:
        """Remove a cached entry. Returns True if deleted, False if not found."""
        with EphemerisCache._process_lock:
            path = self._get_path(key)
            if path.is_file():
                path.unlink(missing_ok=True)
                return True
            return False

    def clear(self) -> int:
        """Remove all cache files from the cache directory. Returns count of deleted files."""
        with EphemerisCache._process_lock:
            count = 0
            for entry in self.cache_dir.glob("*.json"):
                if entry.is_file():
                    entry.unlink(missing_ok=True)
                    count += 1
            return count
