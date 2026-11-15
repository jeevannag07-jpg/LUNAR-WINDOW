"""Time scale transformations and SPICE Ephemeris Time (ET) utilities.

Provides strict timezone validation, UTC normalization, and authoritative UTC-to-ET
conversion via the NAIF SPICE leapseconds kernel (naif0012.tls).

Numerical Precision & Time Semantics:
1. SPICE Ephemeris Time (ET / TDB):
   SPICE represents ET as double-precision floating-point seconds (IEEE 754 float64, 53 bits
   mantissa) past the J2000 epoch (2000-01-01 12:00:00 TDB). At modern mission epochs (~2027,
   et ≈ 8.52e8 seconds), the floating-point machine resolution is:
       eps = 8.52e8 * 2^(-52) ≈ 0.189 microseconds.
2. Python datetime Representation:
   Standard Python datetime objects support microsecond resolution (1e-6 seconds = 1 microsecond).
   Formatting timestamps via ISO string ('%Y-%m-%dT%H:%M:%S.%f') is bounded at 6 decimal digits.
   Therefore, end-to-end round-trip precision between Python datetime and SPICE is strictly bounded
   at 1 microsecond (1.0 µs). Sub-microsecond end-to-end precision cannot be preserved by the Python
   datetime interface, though internal SPICE numerical mathematics operates at ~0.19 µs precision.
3. TDB vs UTC Dynamic Relationship:
   TDB and UTC are NOT related by a permanently fixed offset. The offset ΔT = TDB - UTC incorporates
   historical and active IERS leap seconds plus relativistic variation:
       TDB ≈ TT = TAI + 32.184s = UTC + ΔAT + 32.184s.
   At current epochs (post-2016), ΔAT = 37s, so ΔT ≈ 69.184 seconds.
4. Concurrency:
   All native CSPICE invocations (str2et, et2utc) are strictly synchronized via SPICE_LOCK.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
import spiceypy as spice

from app.services.spice_manager import SPICE_LOCK, SpiceError, synchronized_spice


class EpochMetadata(BaseModel):
    """Explicit metadata capturing epoch representations across astrodynamic time scales."""

    timestamp_utc: datetime = Field(
        ...,
        description="Timezone-aware UTC observation timestamp (bounded by Python datetime 1-microsecond resolution)",
    )
    et_seconds_past_j2000: float = Field(
        ...,
        description="SPICE Ephemeris Time (ET / TDB) in floating-point seconds past J2000 (2000-01-01 12:00:00 TDB)",
    )
    julian_date_et: float = Field(
        ...,
        description="Barycentric Julian Date (Ephemeris Time / TDB scale)",
    )
    time_scale: str = Field(
        default="TDB",
        description="Time scale for SPICE dynamical calculations (Barycentric Dynamical Time)",
    )
    leapseconds_kernel: str = Field(
        default="naif0012.tls",
        description="Official NAIF leapseconds kernel used for dynamic UTC-TDB evaluation",
    )
    timing_precision_note: str = Field(
        default="Python datetime I/O bounded at 1 microsecond; SPICE ET numerical resolution is ~0.19 microseconds.",
        description="Scientific disclosure of numerical precision limits across interfaces",
    )


def validate_and_normalize_utc(dt: datetime) -> datetime:
    """Validate that a datetime is timezone-aware and return it normalized to UTC.
    
    Args:
        dt: Input datetime.
        
    Returns:
        Timezone-aware datetime in UTC.
        
    Raises:
        ValueError: If datetime is naive (missing timezone).
    """
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        raise ValueError(
            f"Datetime {dt} is naive. All mission and astronomical epochs must be timezone-aware."
        )
    return dt.astimezone(timezone.utc)


@synchronized_spice
def utc_to_et(dt: datetime) -> float:
    """Convert a timezone-aware UTC datetime into SPICE Ephemeris Time (ET / TDB).
    
    Uses NAIF CSPICE str2et to evaluate the exact time transformation based on loaded
    IERS leap seconds. Requires a loaded leapseconds kernel (e.g. naif0012.tls).
    Synchronized via SPICE_LOCK for thread safety.
    
    Args:
        dt: Timezone-aware UTC datetime.
        
    Returns:
        Ephemeris Time (ET) in floating-point seconds past J2000 epoch (2000-01-01 12:00:00 TDB).
        
    Raises:
        ValueError: If datetime is naive.
        SpiceError: If SPICE leapseconds kernel is missing or str2et conversion fails.
    """
    dt_utc = validate_and_normalize_utc(dt)

    # Format ISO 8601 string for SPICE str2et (microsecond resolution)
    iso_utc = dt_utc.strftime("%Y-%m-%dT%H:%M:%S.%f")

    try:
        et = spice.str2et(iso_utc)
        return float(et)
    except Exception as exc:
        raise SpiceError(
            f"Failed to convert UTC timestamp '{iso_utc}' to SPICE Ephemeris Time: {str(exc)}. "
            f"Ensure NAIF leapseconds kernel (naif0012.tls) is loaded via SpiceManager."
        ) from exc


@synchronized_spice
def et_to_utc(et: float, precision: int = 6) -> datetime:
    """Convert SPICE Ephemeris Time (ET) back into a timezone-aware UTC datetime.
    
    Synchronized via SPICE_LOCK for thread safety.
    
    Args:
        et: Ephemeris Time in seconds past J2000.
        precision: Number of decimal digits for fractional seconds (default 6 for microsecond resolution).
        
    Returns:
        Timezone-aware UTC datetime.
        
    Raises:
        SpiceError: If CSPICE et2utc conversion fails.
    """
    try:
        # Request ISOC format (YYYY-MM-DDTHH:MM:SS.######)
        iso_str = spice.et2utc(et, "ISOC", precision)
        # Parse ISO string into UTC datetime
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception as exc:
        raise SpiceError(
            f"Failed to convert SPICE Ephemeris Time ({et}s) to UTC: {str(exc)}"
        ) from exc


def get_epoch_metadata(dt: datetime) -> EpochMetadata:
    """Generate comprehensive epoch metadata across time scales for a given UTC timestamp.
    
    Args:
        dt: Timezone-aware observation timestamp.
        
    Returns:
        EpochMetadata containing UTC, ET seconds past J2000, Julian Date, and precision disclosure.
    """
    dt_utc = validate_and_normalize_utc(dt)
    et = utc_to_et(dt_utc)
    # Julian Date in ET/TDB = J2000 epoch (2451545.0) + et / 86400.0
    jd_et = 2451545.0 + (et / 86400.0)

    return EpochMetadata(
        timestamp_utc=dt_utc,
        et_seconds_past_j2000=et,
        julian_date_et=jd_et,
        time_scale="TDB",
        leapseconds_kernel="naif0012.tls",
        timing_precision_note=(
            "Python datetime I/O bounded at 1 microsecond; SPICE ET numerical resolution is ~0.19 microseconds."
        ),
    )
