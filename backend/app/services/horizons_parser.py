"""Parser for NASA JPL Horizons API responses and vector ephemeris tables.

Extracts Cartesian state vectors (X, Y, Z, Range) from fixed-width ASCII results
delimited by $$SOE and $$EOE markers.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HorizonsError(Exception):
    """Base exception for NASA JPL Horizons parsing or API failures."""
    pass


class HorizonsAPIError(HorizonsError):
    """Raised when Horizons reports an explicit query error or refusal."""
    pass


class HorizonsParsingError(HorizonsError):
    """Raised when Horizons ASCII response table cannot be parsed."""
    pass


class HorizonsVectorRecord(BaseModel):
    """Extracted instantaneous Cartesian state vector from Horizons ephemeris table."""

    timestamp_utc: datetime = Field(
        ...,
        description="Observation epoch in ISO 8601 UTC.",
    )
    julian_date: float = Field(
        ...,
        description="Barycentric Julian Date (TDB / UTC).",
    )
    x_km: float = Field(..., description="X coordinate in kilometers.")
    y_km: float = Field(..., description="Y coordinate in kilometers.")
    z_km: float = Field(..., description="Z coordinate in kilometers.")
    range_km: float = Field(..., description="Observer-target distance in kilometers.")
    vx_km_s: Optional[float] = Field(default=None, description="Velocity X in km/s.")
    vy_km_s: Optional[float] = Field(default=None, description="Velocity Y in km/s.")
    vz_km_s: Optional[float] = Field(default=None, description="Velocity Z in km/s.")
    light_time_sec: Optional[float] = Field(default=None, description="One-way light time in seconds.")
    range_rate_km_s: Optional[float] = Field(default=None, description="Range rate in km/s.")


class HorizonsParser:
    """Parser for NASA JPL Horizons JSON response payloads and raw ASCII tables."""

    # Month conversion mapping for Horizons date strings (e.g. 2027-Jan-01)
    MONTH_MAP = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
        "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
    }

    # Regex patterns for Horizons vector format
    RE_SOE_EOE = re.compile(r"\$\$SOE\s*(.*?)\s*\$\$EOE", re.DOTALL)
    RE_HEADER = re.compile(
        r"^\s*([0-9]+\.[0-9]+)\s*=\s*(?:A\.D\.\s*)?([0-9]{4})-([A-Za-z]{3})-([0-9]{1,2})\s+([0-9]{2}):([0-9]{2}):([0-9]{2}(?:\.[0-9]+)?)"
    )
    RE_POS = re.compile(
        r"X\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?)\s+"
        r"Y\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?)\s+"
        r"Z\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?)"
    )
    RE_VEL = re.compile(
        r"VX\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?)\s+"
        r"VY\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?)\s+"
        r"VZ\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?)"
    )
    RE_OPT = re.compile(
        r"(?:LT\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?))?.*?"
        r"RG\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?)"
        r"(?:.*?RR\s*=\s*([+-]?[0-9]+\.?[0-9]*(?:[EDed][+-]?[0-9]+)?))?"
    )

    @classmethod
    def parse_json_response(cls, payload: Dict[str, Any]) -> List[HorizonsVectorRecord]:
        """Parse the JSON wrapper returned by Horizons REST API.
        
        Args:
            payload: Parsed JSON dictionary from Horizons API.
            
        Returns:
            List of parsed HorizonsVectorRecord instances.
            
        Raises:
            HorizonsAPIError: When Horizons returns an error message or error banner.
            HorizonsParsingError: When ephemeris table format cannot be parsed.
        """
        # Check for explicit top-level error in JSON response
        if "error" in payload:
            raise HorizonsAPIError(f"NASA JPL Horizons API returned error: {payload['error']}")

        result_text = payload.get("result", "")
        if not result_text:
            raise HorizonsParsingError("NASA JPL Horizons response missing 'result' field.")

        return cls.parse_vector_text(result_text)

    @classmethod
    def parse_vector_text(cls, result_text: str) -> List[HorizonsVectorRecord]:
        """Parse raw Horizons ASCII text result.
        
        Args:
            result_text: Text content containing $$SOE ... $$EOE table.
            
        Returns:
            List of HorizonsVectorRecord objects.
        """
        # Check for common Horizons error markers in ASCII output
        if "*** ERROR ***" in result_text or "Cannot interpret" in result_text:
            lines = [ln.strip() for ln in result_text.splitlines() if "ERROR" in ln or "Cannot" in ln]
            err_msg = " | ".join(lines) if lines else "Unspecified Horizons query error"
            raise HorizonsAPIError(f"Horizons query failed: {err_msg}")

        # Locate ephemeris block between $$SOE and $$EOE
        match = cls.RE_SOE_EOE.search(result_text)
        if not match:
            raise HorizonsParsingError("No ephemeris table found (missing $$SOE / $$EOE markers).")

        raw_table = match.group(1).strip()
        if not raw_table:
            return []

        records: List[HorizonsVectorRecord] = []
        lines = [line.strip() for line in raw_table.splitlines() if line.strip()]
        idx = 0
        total_lines = len(lines)

        while idx < total_lines:
            header_line = lines[idx]
            header_match = cls.RE_HEADER.match(header_line)

            if not header_match:
                idx += 1
                continue

            # Parse timestamp and JD
            jd = float(header_match.group(1))
            year = int(header_match.group(2))
            month_str = header_match.group(3)
            day = int(header_match.group(4))
            hour = int(header_match.group(5))
            minute = int(header_match.group(6))
            sec_float = float(header_match.group(7))
            second = int(sec_float)
            microsecond = int(round((sec_float - second) * 1_000_000))
            if microsecond >= 1_000_000:
                microsecond = 0
                second += 1
            if second >= 60:
                # Horizons/IERS historical leap second (second=60);
                # clamp to 59.999999s as standard ISO 8601 representation for Python datetime.
                second = 59
                microsecond = 999_999

            month = cls.MONTH_MAP.get(month_str)
            if not month:
                raise HorizonsParsingError(f"Unrecognized month abbreviation '{month_str}' in Horizons table.")

            timestamp_utc = datetime(
                year, month, day, hour, minute, second, microsecond, tzinfo=timezone.utc
            )

            idx += 1
            if idx >= total_lines:
                break

            # Line with X, Y, Z
            pos_line = lines[idx]
            pos_match = cls.RE_POS.search(pos_line)
            if not pos_match:
                idx += 1
                continue

            def parse_float(s: str) -> float:
                return float(s.replace("D", "E").replace("d", "e"))

            x_km = parse_float(pos_match.group(1))
            y_km = parse_float(pos_match.group(2))
            z_km = parse_float(pos_match.group(3))

            # Optional velocity and range lines
            vx_km_s = None
            vy_km_s = None
            vz_km_s = None
            range_km = None
            lt_sec = None
            rr_km_s = None

            idx += 1
            # Check next line for VX, VY, VZ
            if idx < total_lines:
                vel_match = cls.RE_VEL.search(lines[idx])
                if vel_match:
                    vx_km_s = parse_float(vel_match.group(1))
                    vy_km_s = parse_float(vel_match.group(2))
                    vz_km_s = parse_float(vel_match.group(3))
                    idx += 1

            # Check next line for LT, RG, RR
            if idx < total_lines:
                opt_match = cls.RE_OPT.search(lines[idx])
                if opt_match:
                    if opt_match.group(1):
                        lt_sec = parse_float(opt_match.group(1))
                    range_km = parse_float(opt_match.group(2))
                    if opt_match.group(3):
                        rr_km_s = parse_float(opt_match.group(3))
                    idx += 1

            # If range not present in extra line, compute Euclidean norm
            if range_km is None:
                range_km = float((x_km**2 + y_km**2 + z_km**2) ** 0.5)

            record = HorizonsVectorRecord(
                timestamp_utc=timestamp_utc,
                julian_date=jd,
                x_km=x_km,
                y_km=y_km,
                z_km=z_km,
                range_km=range_km,
                vx_km_s=vx_km_s,
                vy_km_s=vy_km_s,
                vz_km_s=vz_km_s,
                light_time_sec=lt_sec,
                range_rate_km_s=rr_km_s,
            )
            records.append(record)

        return records
