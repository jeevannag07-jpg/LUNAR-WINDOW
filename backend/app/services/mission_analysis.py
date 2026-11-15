"""Central scientific mission analysis orchestration service.

Coordinates:
1. Site geodetic validation and coordinate normalization.
2. Digital Elevation Model (LOLA DEM) horizon mask evaluation.
3. High-precision NAIF SPICE / JPL Horizons Sun and Earth ephemeris computing.
4. Topocentric terrain visibility and solar disk illumination calculation.
5. Contiguous operational window segmentation (Sunlight, Darkness, Earth LoS, Combined).
6. Comprehensive mission operational metrics and scientific disclosure assembly.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from app.schemas.coordinates import SelenographicCoordinates
from app.schemas.disclosure import (
    DataProvenance,
    DataQualityStatus,
    ScientificDisclosure,
    TerrainFidelity,
)
from app.schemas.mission import (
    EphemerisSample,
    MissionSummary,
    MissionVisibilityRequest,
    MissionVisibilityResponse,
    OperationalWindow,
)
from app.schemas.terrain import TerrainProfileRequest, TerrainProfileResponse
from app.science.astronomy.engine import AstronomyEngine
from app.science.terrain.dem_service import DEMService
from app.science.terrain.models import HorizonProfile
from app.science.visibility.earth import evaluate_earth_visibility, segment_earth_windows
from app.science.visibility.solar import (
    evaluate_solar_visibility,
    segment_solar_windows,
)
from app.science.visibility.windows import (
    build_mission_summary,
    segment_combined_opportunity_windows,
)

logger = logging.getLogger(__name__)


class MissionAnalysisService:
    """Orchestrates comprehensive lunar mission planning and visibility analysis."""

    def __init__(
        self,
        astronomy_engine: Optional[AstronomyEngine] = None,
        dem_service: Optional[DEMService] = None,
    ) -> None:
        """Initialize analysis service with computing engines.

        Args:
            astronomy_engine: AstronomyEngine instance for topocentric ephemeris.
            dem_service: DEMService instance for terrain elevation and horizon masks.
        """
        self.astronomy_engine = astronomy_engine or AstronomyEngine()
        self.dem_service = dem_service or DEMService()

    async def evaluate_visibility(
        self,
        request: MissionVisibilityRequest,
    ) -> MissionVisibilityResponse:
        """Execute end-to-end mission visibility analysis.

        Args:
            request: Validated MissionVisibilityRequest payload.

        Returns:
            Complete MissionVisibilityResponse payload.
        """
        site = request.site

        # 1. Evaluate or retrieve terrain horizon profile
        site_elev_m = site.elevation_m or 0.0
        terrain_fidelity = TerrainFidelity.SPHERICAL_DATUM_ONLY
        horizon_profile: HorizonProfile

        # Check if site is within polar DEM coverage (-90 to -80 deg)
        is_polar = site.latitude_deg <= -80.0
        if request.require_terrain_occlusion and is_polar and self.dem_service.is_available:
            # Query actual DEM elevation if available
            sample = self.dem_service.sample_elevation(site.latitude_deg, site.longitude_deg)
            if sample and sample.is_valid and sample.relative_elevation_m is not None:
                site_elev_m = sample.relative_elevation_m

            horizon_profile = self.dem_service.get_horizon_profile(
                site_lat_deg=site.latitude_deg,
                site_lon_deg=site.longitude_deg,
                site_elevation_m=site_elev_m,
                azimuth_step_deg=2.0,
            )
            terrain_fidelity = TerrainFidelity.LOLA_TOPOGRAPHIC_HORIZON
        else:
            # Spherical datum horizon profile
            horizon_profile = self.dem_service.get_horizon_profile(
                site_lat_deg=site.latitude_deg,
                site_lon_deg=site.longitude_deg,
                site_elevation_m=site_elev_m,
            )
            terrain_fidelity = TerrainFidelity.SPHERICAL_DATUM_ONLY

        # 2. Compute astronomical time series via AstronomyEngine
        astronomy_result = await self.astronomy_engine.calculate_astronomy_timeseries(
            site=site,
            start_time=request.start_time_utc,
            end_time=request.end_time_utc,
            sampling_interval_minutes=request.sampling_interval_minutes,
        )

        # 3. Evaluate visibility at each epoch
        samples: List[EphemerisSample] = []
        for epoch_rec in astronomy_result.records:
            ts = epoch_rec.timestamp_utc
            sun_sample = epoch_rec.sun
            earth_sample = epoch_rec.earth

            # Topographic horizon at body azimuths
            horiz_sun = horizon_profile.get_elevation_at_azimuth(sun_sample.azimuth_deg)
            horiz_earth = horizon_profile.get_elevation_at_azimuth(earth_sample.azimuth_deg)

            # Solar evaluation
            sun_upper_limb, sun_frac, is_sun_vis = evaluate_solar_visibility(
                sun_azimuth_deg=sun_sample.azimuth_deg,
                sun_center_elevation_deg=sun_sample.elevation_deg,
                horizon_elevation_deg=horiz_sun,
                min_solar_elevation_deg=request.min_solar_elevation_deg,
                reference=request.solar_elevation_reference,
            )

            # Earth evaluation
            is_earth_los = evaluate_earth_visibility(
                earth_azimuth_deg=earth_sample.azimuth_deg,
                earth_center_elevation_deg=earth_sample.elevation_deg,
                horizon_elevation_deg=horiz_earth,
                min_earth_elevation_deg=request.min_earth_elevation_deg,
            )

            samples.append(
                EphemerisSample(
                    timestamp_utc=ts,
                    sun_azimuth_deg=sun_sample.azimuth_deg,
                    sun_center_elevation_deg=sun_sample.elevation_deg,
                    sun_upper_limb_elevation_deg=sun_upper_limb,
                    solar_disk_illumination_fraction=sun_frac,
                    is_sun_visible=is_sun_vis,
                    earth_azimuth_deg=earth_sample.azimuth_deg,
                    earth_center_elevation_deg=earth_sample.elevation_deg,
                    is_earth_line_of_sight=is_earth_los,
                    terrain_horizon_elevation_deg=horiz_sun if terrain_fidelity == TerrainFidelity.LOLA_TOPOGRAPHIC_HORIZON else None,
                )
            )

        # 4. Segment operational windows
        solar_windows, solar_metrics = segment_solar_windows(samples)
        earth_windows, earth_metrics = segment_earth_windows(samples)
        combined_windows, combined_metrics = segment_combined_opportunity_windows(samples)

        all_windows: List[OperationalWindow] = solar_windows + earth_windows + combined_windows
        all_windows.sort(key=lambda w: w.start_time_utc)

        # 5. Compile summary metrics
        summary: MissionSummary = build_mission_summary(
            samples=samples,
            solar_metrics=solar_metrics,
            earth_metrics=earth_metrics,
            combined_metrics=combined_metrics,
        )

        # 6. Assemble Scientific Disclosure
        assumptions = [
            "Planetary reference datum: Sphere with mean radius R_0 = 1,737,400.0 m (IAU/PDS standard).",
            "Astronomical ephemeris: NASA JPL Horizons DE440 state vectors rotated via NAIF CSPICE pxform into MOON_ME.",
            "Solar angular semi-diameter: Fixed at 0.267 degrees (~16.0 arcminutes) as viewed from lunar distance.",
            "Earth limb geometry: Evaluated for Earth geometric center; atmospheric refraction is zero in lunar vacuum.",
        ]
        if terrain_fidelity == TerrainFidelity.LOLA_TOPOGRAPHIC_HORIZON:
            assumptions.append("Topographic horizon: Evaluated against LOLA polar digital elevation model.")
        else:
            assumptions.append("Topographic horizon: Ideal spherical lunar datum without local terrain obstructions.")

        limitations = [
            "Topocentric results represent geometric visibility and do not evaluate solar panel electrical power output.",
            "Earth geometric line-of-sight does not guarantee an operational RF communication link (link budgets unmodeled).",
            "Interpolation between discrete sampling epochs assumes smooth astronomical body motion.",
            "Not certified for real-time spacecraft flight navigation, descent steering, or hazard avoidance.",
        ]

        disclosure = ScientificDisclosure(
            provenance=DataProvenance.REAL_NASA_JPL_HORIZONS,
            ephemeris_source="NASA JPL Horizons API (DE440 / NAIF IDs 10 & 399) + NAIF SPICE MOON_ME",
            coordinate_frame="MOON_ME (IAU Mean Earth / Polar Axis)",
            terrain_fidelity=terrain_fidelity,
            data_quality_status=DataQualityStatus.VERIFIED,
            assumptions=assumptions,
            limitations=limitations,
        )

        return MissionVisibilityResponse(
            site=SelenographicCoordinates(
                latitude_deg=site.latitude_deg,
                longitude_deg=site.longitude_deg,
                elevation_m=site_elev_m,
                frame=site.frame,
            ),
            start_time_utc=request.start_time_utc,
            end_time_utc=request.end_time_utc,
            sampling_interval_minutes=request.sampling_interval_minutes,
            summary=summary,
            windows=all_windows,
            timeline=samples if request.include_timeline else None,
            disclosure=disclosure,
        )

    def evaluate_terrain_profile(
        self,
        request: TerrainProfileRequest,
    ) -> TerrainProfileResponse:
        """Evaluate and return 360-degree local terrain horizon profile."""
        site = request.site
        site_elev_m = site.elevation_m or 0.0

        is_polar = site.latitude_deg <= -80.0
        coverage_status = "SPHERICAL_DATUM"
        terrain_fidelity = TerrainFidelity.SPHERICAL_DATUM_ONLY

        if is_polar and self.dem_service.is_available:
            sample = self.dem_service.sample_elevation(site.latitude_deg, site.longitude_deg)
            if sample and sample.is_valid and sample.relative_elevation_m is not None:
                site_elev_m = sample.relative_elevation_m
            coverage_status = "LOLA_POLAR_ACTIVE"
            terrain_fidelity = TerrainFidelity.LOLA_TOPOGRAPHIC_HORIZON

        horizon = self.dem_service.get_horizon_profile(
            site_lat_deg=site.latitude_deg,
            site_lon_deg=site.longitude_deg,
            site_elevation_m=site_elev_m,
            azimuth_step_deg=request.azimuth_step_deg,
            max_distance_m=request.max_distance_km * 1000.0,
        )

        disclosure = ScientificDisclosure(
            provenance=DataProvenance.HISTORICAL_BENCHMARK if is_polar else DataProvenance.ANALYTICAL_APPROXIMATION,
            ephemeris_source="LOLA Gridded Data Record (LDEM_80S_20M)" if is_polar else "Analytical Spherical Datum",
            coordinate_frame="MOON_ME (IAU Mean Earth / Polar Axis)",
            terrain_fidelity=terrain_fidelity,
            data_quality_status=DataQualityStatus.VERIFIED,
            assumptions=[
                "Radial horizon evaluation using planar South Polar Stereographic projection.",
                "Spherical lunar datum base radius R_0 = 1,737,400.0 m.",
            ],
            limitations=[
                "Sub-pixel slope roughness below DEM resolution (20m/px) is not captured.",
                "Ray horizon scanning truncated at requested max_distance_km.",
            ],
        )

        return TerrainProfileResponse(
            site=SelenographicCoordinates(
                latitude_deg=site.latitude_deg,
                longitude_deg=site.longitude_deg,
                elevation_m=site_elev_m,
                frame=site.frame,
            ),
            elevation_m=site_elev_m,
            azimuths_deg=horizon.azimuths_deg,
            elevations_deg=horizon.elevations_deg,
            max_elevation_deg=horizon.max_elevation_deg,
            min_elevation_deg=horizon.min_elevation_deg,
            mean_elevation_deg=horizon.mean_elevation_deg,
            is_fully_within_dem=horizon.is_fully_within_dem,
            dem_coverage_status=coverage_status,
            disclosure=disclosure,
        )
