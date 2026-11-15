"""Astronomy computing engine.

Integrates:
- NASA JPL Horizons vector client and cache (Stage 3).
- NAIF SPICE time conversions and DE440 lunar orientation (Stage 4B/4B.1).
- Selenographic coordinates and topocentric geometry (Stage 4C).

Produces timestamped topocentric observation time series of the Sun and Earth from
any specified lunar surface site in the rotating MOON_ME reference frame.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Union
import numpy as np

from app.science.astronomy.models import (
    AstronomyEpochRecord,
    AstronomyProvenanceMetadata,
    AstronomySiteMetadata,
    AstronomyTimeSeriesResult,
    BodyTopocentricSample,
)
from app.science.astronomy.orientation import transform_position
from app.science.astronomy.time import utc_to_et, validate_and_normalize_utc
from app.science.geometry.lunar_coordinates import (
    LUNAR_MEAN_RADIUS_KM,
    selenographic_to_cartesian,
)
from app.science.geometry.topocentric import calculate_topocentric_geometry
from app.schemas.coordinates import CoordinateFrame, SelenographicCoordinates
from app.services.cache import EphemerisCache
from app.services.horizons_client import HorizonsClient
from app.services.spice_manager import SpiceManager


# NAIF body identifiers
NAIF_ID_SUN: int = 10
NAIF_ID_EARTH: int = 399
LUNAR_CENTER_HORIZONS: str = "500@301"

# Maximum analysis window in seconds (180 days)
MAX_DURATION_SECONDS: float = 180.0 * 86400.0


class AstronomyEngineError(Exception):
    """Base exception for AstronomyEngine calculation failures."""
    pass


class AstronomyEngine:
    """Computes topocentric Sun and Earth observation time series from lunar surface sites."""

    def __init__(
        self,
        horizons_client: Optional[HorizonsClient] = None,
        spice_manager: Optional[SpiceManager] = None,
        cache: Optional[EphemerisCache] = None,
    ):
        """Initialize AstronomyEngine with required services.
        
        Args:
            horizons_client: Configured HorizonsClient instance (uses default if None).
            spice_manager: Configured SpiceManager instance (uses default singleton if None).
            cache: EphemerisCache instance passed to default HorizonsClient if created.
        """
        self.spice_manager = spice_manager or SpiceManager()
        if horizons_client is not None:
            self.horizons_client = horizons_client
        else:
            self.horizons_client = HorizonsClient(cache=cache or EphemerisCache())

    async def calculate_astronomy_timeseries(
        self,
        site: Union[SelenographicCoordinates, Dict[str, Any]],
        start_time: datetime,
        end_time: datetime,
        sampling_interval_minutes: int = 60,
    ) -> AstronomyTimeSeriesResult:
        """Calculate complete topocentric astronomy time series for Sun and Earth.
        
        Mathematical Pipeline:
            1. Validate inputs (site coordinates, bounds, UTC normalization, duration limit).
            2. Verify SPICE DE440 kernel readiness.
            3. Batch-fetch Moon-centered geometric state vectors for Sun (10) and Earth (399)
               in the ICRF/J2000 inertial frame via Horizons client/cache.
            4. Validate chronological alignment and completeness across body samples.
            5. For each epoch:
               a. Convert UTC to SPICE Ephemeris Time (ET/TDB) via leapseconds kernel.
               b. Transform position vectors from ICRF/J2000 into MOON_ME via pxform.
               c. Project body vectors relative to site into local East-North-Up (ENU) frame.
               d. Calculate azimuth (clockwise from True North), elevation, and slant range.
            6. Assemble validated AstronomyTimeSeriesResult with complete scientific provenance.

        Args:
            site: Lunar site coordinates (SelenographicCoordinates model or dict).
            start_time: Observation start epoch (timezone-aware UTC).
            end_time: Observation end epoch (timezone-aware UTC).
            sampling_interval_minutes: Time step in minutes [1, 1440].

        Returns:
            AstronomyTimeSeriesResult containing chronologically sorted records and metadata.

        Raises:
            ValueError: On invalid site coordinates, improper timestamps, or mismatched records.
            AstronomyEngineError: On calculation or SPICE transform failure.
        """
        # 1. Validate and normalize site coordinates
        site_lat, site_lon, site_elev_km, site_frame = self._extract_and_validate_site(site)

        # 2. Validate timestamps and duration bounds
        start_utc = validate_and_normalize_utc(start_time)
        end_utc = validate_and_normalize_utc(end_time)

        if start_utc >= end_utc:
            raise ValueError(
                f"start_time ({start_utc.isoformat()}) must be strictly earlier than end_time ({end_utc.isoformat()})."
            )

        duration_sec = (end_utc - start_utc).total_seconds()
        if duration_sec > MAX_DURATION_SECONDS:
            raise ValueError(
                f"Requested duration ({duration_sec / 86400.0:.2f} days) exceeds maximum allowed span of 180 days."
            )

        if not 1 <= int(sampling_interval_minutes) <= 1440:
            raise ValueError(
                f"sampling_interval_minutes must be between 1 and 1440 minutes, got {sampling_interval_minutes}."
            )

        # 3. Ensure SPICE kernels are furnished
        if not self.spice_manager.is_loaded():
            self.spice_manager.load_kernels()

        # 4. Compute observer Moon-centered Cartesian coordinates in MOON_ME
        site_cart = selenographic_to_cartesian(
            latitude_deg=site_lat,
            longitude_deg=site_lon,
            elevation_km=site_elev_km,
            radius_km=LUNAR_MEAN_RADIUS_KM,
            frame="MOON_ME",
        )
        site_cart_array = site_cart.as_array()

        # 5. Acquire batch state vectors for Sun and Earth from Horizons (via cache/API)
        sun_vectors = await self.horizons_client.fetch_vectors(
            target_body=str(NAIF_ID_SUN),
            center=LUNAR_CENTER_HORIZONS,
            start_time=start_utc,
            end_time=end_utc,
            step_minutes=int(sampling_interval_minutes),
            vec_corr="NONE",
            time_type="UT",
            time_digits="SECONDS",
        )

        earth_vectors = await self.horizons_client.fetch_vectors(
            target_body=str(NAIF_ID_EARTH),
            center=LUNAR_CENTER_HORIZONS,
            start_time=start_utc,
            end_time=end_utc,
            step_minutes=int(sampling_interval_minutes),
            vec_corr="NONE",
            time_type="UT",
            time_digits="SECONDS",
        )

        # 6. Validate ephemeris vector sets
        if not sun_vectors:
            raise AstronomyEngineError(f"No vector records returned for Sun (target {NAIF_ID_SUN}).")
        if not earth_vectors:
            raise AstronomyEngineError(f"No vector records returned for Earth (target {NAIF_ID_EARTH}).")
        if len(sun_vectors) != len(earth_vectors):
            raise AstronomyEngineError(
                f"Sample count mismatch: Sun returned {len(sun_vectors)} records, "
                f"Earth returned {len(earth_vectors)} records."
            )

        # 7. Step-by-step alignment and transformation loop
        records: List[AstronomyEpochRecord] = []
        prev_timestamp: Optional[datetime] = None

        for idx, (sun_rec, earth_rec) in enumerate(zip(sun_vectors, earth_vectors)):
            # Verify chronological monotonicity and reject duplicates
            curr_ts = sun_rec.timestamp_utc
            if prev_timestamp is not None:
                if curr_ts <= prev_timestamp:
                    raise AstronomyEngineError(
                        f"Non-monotonic or duplicate timestamp detected at sample {idx}: "
                        f"{curr_ts.isoformat()} <= {prev_timestamp.isoformat()}."
                    )
            prev_timestamp = curr_ts

            # Verify identical timestamp alignment between Sun and Earth
            if abs((sun_rec.timestamp_utc - earth_rec.timestamp_utc).total_seconds()) > 1e-3:
                raise AstronomyEngineError(
                    f"Timestamp misalignment at index {idx}: Sun has {sun_rec.timestamp_utc.isoformat()}, "
                    f"Earth has {earth_rec.timestamp_utc.isoformat()}."
                )

            # Validate numerical values are finite
            sun_icrf = np.array([sun_rec.x_km, sun_rec.y_km, sun_rec.z_km], dtype=np.float64)
            earth_icrf = np.array([earth_rec.x_km, earth_rec.y_km, earth_rec.z_km], dtype=np.float64)

            if not np.all(np.isfinite(sun_icrf)):
                raise AstronomyEngineError(f"Non-finite Sun state vector at epoch {curr_ts}: {sun_icrf}")
            if not np.all(np.isfinite(earth_icrf)):
                raise AstronomyEngineError(f"Non-finite Earth state vector at epoch {curr_ts}: {earth_icrf}")

            # 7a. Convert UTC timestamp to SPICE Ephemeris Time (ET/TDB)
            et = utc_to_et(curr_ts)

            # 7b. Transform position vectors from ICRF/J2000 into MOON_ME via pxform
            # Notice: Horizons REF_SYSTEM='ICRF' is aligned with CSPICE 'J2000' within < 0.05 arcsec
            sun_moon_me = transform_position(sun_icrf, et, from_frame="J2000", to_frame="MOON_ME")
            earth_moon_me = transform_position(earth_icrf, et, from_frame="J2000", to_frame="MOON_ME")

            # 7c. Compute site-relative topocentric geometry using Stage 4C
            sun_topo = calculate_topocentric_geometry(
                body_position_km=sun_moon_me,
                site_position_km=site_cart_array,
                site_latitude_deg=site_lat,
                site_longitude_deg=site_lon,
                body_frame="MOON_ME",
                site_frame="MOON_ME",
            )

            earth_topo = calculate_topocentric_geometry(
                body_position_km=earth_moon_me,
                site_position_km=site_cart_array,
                site_latitude_deg=site_lat,
                site_longitude_deg=site_lon,
                body_frame="MOON_ME",
                site_frame="MOON_ME",
            )

            # 7d. Construct body samples
            sun_sample = BodyTopocentricSample(
                body_name="Sun",
                naif_id=NAIF_ID_SUN,
                azimuth_deg=sun_topo.azimuth_deg,
                elevation_deg=sun_topo.elevation_deg,
                distance_km=sun_topo.distance_km,
                enu_vector_km=sun_topo.enu_vector_km.tolist(),
                cartesian_moon_me_km=sun_moon_me.tolist(),
                is_near_zenith=sun_topo.is_near_zenith,
            )

            earth_sample = BodyTopocentricSample(
                body_name="Earth",
                naif_id=NAIF_ID_EARTH,
                azimuth_deg=earth_topo.azimuth_deg,
                elevation_deg=earth_topo.elevation_deg,
                distance_km=earth_topo.distance_km,
                enu_vector_km=earth_topo.enu_vector_km.tolist(),
                cartesian_moon_me_km=earth_moon_me.tolist(),
                is_near_zenith=earth_topo.is_near_zenith,
            )

            record = AstronomyEpochRecord(
                timestamp_utc=curr_ts,
                epoch_et_seconds=float(et),
                julian_date=float(sun_rec.julian_date),
                sun=sun_sample,
                earth=earth_sample,
            )
            records.append(record)

        # 8. Assemble complete result
        site_meta = AstronomySiteMetadata(
            latitude_deg=site_lat,
            longitude_deg=site_lon,
            elevation_km=site_elev_km,
            cartesian_moon_me_km=site_cart_array.tolist(),
            datum="SPHERICAL_MEAN_RADIUS",
            datum_radius_km=LUNAR_MEAN_RADIUS_KM,
            frame=site_frame,
        )

        return AstronomyTimeSeriesResult(
            site=site_meta,
            provenance=AstronomyProvenanceMetadata(),
            start_time_utc=start_utc,
            end_time_utc=end_utc,
            sampling_interval_minutes=int(sampling_interval_minutes),
            sample_count=len(records),
            records=records,
        )

    @staticmethod
    def _extract_and_validate_site(
        site: Union[SelenographicCoordinates, Dict[str, Any]],
    ) -> tuple[float, float, float, str]:
        """Extract and validate lunar surface coordinates."""
        if isinstance(site, SelenographicCoordinates):
            lat = site.latitude_deg
            lon = site.longitude_deg
            # SelenographicCoordinates has elevation_m in meters; convert to km
            elev_km = site.elevation_m / 1000.0
            frame = site.frame.value if hasattr(site.frame, "value") else str(site.frame)
        elif isinstance(site, dict):
            lat = float(site.get("latitude_deg", 0.0))
            lon = float(site.get("longitude_deg", 0.0))
            if "elevation_km" in site:
                elev_km = float(site["elevation_km"])
            elif "elevation_m" in site:
                elev_km = float(site["elevation_m"]) / 1000.0
            else:
                elev_km = 0.0
            frame = str(site.get("frame", "MOON_ME"))
        else:
            raise ValueError(f"Site must be SelenographicCoordinates or dict, got {type(site).__name__}")

        if not -90.0 <= lat <= 90.0:
            raise ValueError(f"Latitude must be between -90.0 and +90.0 degrees, got {lat}.")
        if not -180.0 <= lon <= 180.0:
            raise ValueError(f"Longitude must be between -180.0 and +180.0 degrees, got {lon}.")
        if not math.isfinite(lat) or not math.isfinite(lon) or not math.isfinite(elev_km):
            raise ValueError("Latitude, longitude, and elevation must be finite numbers.")
        if frame != "MOON_ME":
            raise ValueError(f"Unsupported coordinate frame: '{frame}'. Only 'MOON_ME' is supported.")

        return lat, lon, elev_km, frame
