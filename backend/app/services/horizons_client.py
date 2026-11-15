"""Asynchronous HTTP client for the NASA JPL Horizons REST API.

Provides state vector ephemeris queries for Sun (10) and Earth (399) relative to
the Moon center of mass (500@301), integrated with local deterministic caching.

Notice on Reference Frames:
Output vectors from Horizons with CENTER='500@301' and REF_SYSTEM='ICRF' are
Moon-centered celestial inertial vectors in the International Celestial Reference Frame.
They do NOT rotate with the Moon. Stage 4 astronomical calculations will apply the IAU
lunar orientation matrix (libration / pole rotation) to project these vectors into
the rotating body-fixed selenographic MOON_ME frame prior to local topocentric evaluation.

Notice on Time Scales (UT vs UTC vs TDB), Precision, and Leap Seconds:
1. Horizons API parameter TIME_TYPE accepts 'UT' (Universal Time) or 'TT' (Terrestrial Time).
   Horizons does not accept 'UTC' as a parameter string.
2. For calendar dates after 1962-Jan-01, Horizons defines 'UT' as Coordinated Universal Time (UTC).
   Mission inputs remain strictly timezone-aware UTC (datetime normalized to UTC).
3. Output Timestamp Precision: Horizons parameter TIME_DIGITS is explicitly configured to 'SECONDS',
   and query parameters START_TIME and STOP_TIME format epochs with second resolution (%Y-%m-%d %H:%M:%S),
   ensuring second-level mission epoch fidelity is preserved.
4. Horizons table output epoch lines are labeled as either TDB (Barycentric Dynamical Time)
   or UT. In modern epochs, TDB leads UTC by approximately Delta_T ≈ 69 seconds
   (TDB ≈ TT ≈ TAI + 32.184s ≈ UTC + Delta_AT + 32.184s). TDB timestamps must not be
   falsely labeled as UTC without noting this relationship.
5. Leap-Second Limitation: Horizons maintains historical leap seconds from IERS bulletins;
   unpredictable future leap seconds (or potential future UTC offset freezes) cannot be
   modeled beyond published IERS kernels.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

from app.services.cache import EphemerisCache
from app.services.horizons_parser import (
    HorizonsAPIError,
    HorizonsError,
    HorizonsParser,
    HorizonsVectorRecord,
)


class HorizonsNetworkError(HorizonsError):
    """Raised when external HTTP communication with JPL Horizons fails or times out."""
    pass


class HorizonsClient:
    """Asynchronous client interacting with NASA JPL Horizons REST service."""

    def __init__(
        self,
        base_url: str = "https://ssd.jpl.nasa.gov/api/horizons.api",
        timeout: float = 30.0,
        cache: Optional[EphemerisCache] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        """Initialize client with URL, timeout, and optional persistent cache.
        
        Args:
            base_url: Horizons API endpoint URL.
            timeout: Request timeout in seconds.
            cache: EphemerisCache instance for persisting query results.
            http_client: Injected httpx.AsyncClient (useful for unit testing with MockTransport).
        """
        self.base_url = base_url
        self.timeout = timeout
        self.cache = cache
        self._http_client = http_client

    @staticmethod
    def build_vector_query(
        target_body: str,
        center: str,
        start_time: datetime,
        end_time: datetime,
        step_minutes: int,
        vec_table: str = "3",
        vec_corr: str = "NONE",
        time_type: str = "UT",
        time_digits: str = "SECONDS",
    ) -> Dict[str, str]:
        """Construct query parameter dictionary for Horizons API vector ephemeris.
        
        Args:
            target_body: NAIF body code ('10' for Sun, '399' for Earth).
            center: Coordinate origin ('500@301' for Moon center).
            start_time: Observation start epoch (UTC).
            end_time: Observation end epoch (UTC).
            step_minutes: Time step interval in minutes.
            vec_table: Horizons table format ('3'=full state vector with LT, RG, RR).
            vec_corr: Light-time/aberration correction ('NONE'=geometric, 'LT'=astrometric).
            time_type: Horizons time scale specification ('UT' for Universal Time/UTC).
            time_digits: Horizons calendar output precision ('SECONDS', 'MINUTES', or 'FRACSEC').
            
        Returns:
            Dictionary of string query parameters.
        """
        # Ensure timestamps are in UTC
        start_utc = start_time.astimezone(timezone.utc)
        end_utc = end_time.astimezone(timezone.utc)

        return {
            "format": "json",
            "COMMAND": f"'{target_body}'",
            "EPHEM_TYPE": "VECTORS",
            "CENTER": f"'{center}'",
            "REF_PLANE": "'FRAME'",
            "REF_SYSTEM": "'ICRF'",
            "START_TIME": f"'{start_utc.strftime('%Y-%m-%d %H:%M:%S')}'",
            "STOP_TIME": f"'{end_utc.strftime('%Y-%m-%d %H:%M:%S')}'",
            "STEP_SIZE": f"'{int(step_minutes)}m'",
            "VEC_TABLE": str(vec_table),
            "VEC_CORR": f"'{vec_corr}'",
            "TIME_TYPE": f"'{time_type}'",
            "TIME_DIGITS": f"'{time_digits}'",
            "OUT_UNITS": "'KM-S'",
            "CSV_FORMAT": "'NO'",
        }

    async def fetch_vectors(
        self,
        target_body: str,
        center: str = "500@301",
        start_time: datetime = None,
        end_time: datetime = None,
        step_minutes: int = 60,
        vec_table: str = "3",
        vec_corr: str = "NONE",
        time_type: str = "UT",
        time_digits: str = "SECONDS",
    ) -> List[HorizonsVectorRecord]:
        """Retrieve state vectors from local cache or NASA JPL Horizons API.
        
        Args:
            target_body: Body ID ('10' for Sun, '399' for Earth).
            center: Center body code ('500@301' for Moon center).
            start_time: Observation start epoch.
            end_time: Observation end epoch.
            step_minutes: Sampling interval in minutes.
            vec_table: Vector table selection (default '3' for position, velocity, and range).
            vec_corr: Correction type (default 'NONE' for geometric vectors).
            time_type: Time scale standard (default 'UT').
            
        Returns:
            List of HorizonsVectorRecord objects.
            
        Raises:
            HorizonsNetworkError: When NASA API is unreachable, times out, or fails with 5xx/429.
            HorizonsAPIError: When Horizons returns an error message.
            HorizonsParsingError: When response text cannot be parsed.
        """
        if start_time is None or end_time is None:
            raise ValueError("start_time and end_time must be provided.")

        start_iso = start_time.astimezone(timezone.utc).isoformat()
        end_iso = end_time.astimezone(timezone.utc).isoformat()

        cache_key = None
        if self.cache is not None:
            cache_key = self.cache.generate_key(
                target_body=target_body,
                center=center,
                start_time_iso=start_iso,
                end_time_iso=end_iso,
                step_minutes=step_minutes,
                ref_plane="FRAME",
                ref_system="ICRF",
                time_type=time_type,
                vec_corr=vec_corr,
                vec_table=vec_table,
                out_units="KM-S",
                csv_format="NO",
                schema_version="v1",
            )
            cached_data = self.cache.get(cache_key)
            if cached_data is not None and "records" in cached_data:
                # Cache hit: Rehydrate records without network call
                return [HorizonsVectorRecord(**rec) for rec in cached_data["records"]]

        # Cache miss: Execute query against NASA Horizons REST API
        params = self.build_vector_query(
            target_body=target_body,
            center=center,
            start_time=start_time,
            end_time=end_time,
            step_minutes=step_minutes,
            vec_table=vec_table,
            vec_corr=vec_corr,
            time_type=time_type,
            time_digits=time_digits,
        )

        try:
            if self._http_client is not None:
                response = await self._http_client.get(
                    self.base_url, params=params, timeout=self.timeout
                )
            else:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(self.base_url, params=params)

            if response.status_code == 429:
                raise HorizonsNetworkError(
                    "NASA JPL Horizons API rate limit exceeded (HTTP 429). Please reduce request frequency."
                )
            if response.status_code >= 500:
                raise HorizonsNetworkError(
                    f"NASA JPL Horizons API server error (HTTP {response.status_code})."
                )

            response.raise_for_status()
            payload = response.json()

        except httpx.TimeoutException as exc:
            raise HorizonsNetworkError(
                f"Connection to NASA JPL Horizons API timed out after {self.timeout}s."
            ) from exc
        except httpx.RequestError as exc:
            raise HorizonsNetworkError(
                f"Failed to communicate with NASA JPL Horizons API: {str(exc)}"
            ) from exc

        # Parse extracted vector records
        records = HorizonsParser.parse_json_response(payload)

        # Store in cache
        if self.cache is not None and cache_key is not None:
            cache_payload = {
                "target_body": target_body,
                "center": center,
                "start_time_iso": start_iso,
                "end_time_iso": end_iso,
                "step_minutes": step_minutes,
                "ref_plane": "FRAME",
                "ref_system": "ICRF",
                "time_type": time_type,
                "vec_corr": vec_corr,
                "vec_table": vec_table,
                "out_units": "KM-S",
                "csv_format": "NO",
                "signature": payload.get("signature"),
                "records": [rec.model_dump(mode="json") for rec in records],
            }
            self.cache.set(cache_key, cache_payload)

        return records
