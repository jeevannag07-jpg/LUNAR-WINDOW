/**
 * LUNAR WINDOW — Strongly Typed API Client Contracts
 * Strictly aligned with backend FastAPI schemas in app/schemas/.
 * Preserves complete data fidelity, provenance disclosure, and error boundaries.
 */

export type CoordinateFrame = 'MOON_ME';

export interface SelenographicCoordinates {
  latitude_deg: number;
  longitude_deg: number;
  elevation_m: number;
  frame?: CoordinateFrame;
}

export interface LunarSite {
  site_id: string;
  name: string;
  coordinates: SelenographicCoordinates;
  description: string;
  region: string;
}

export type SolarElevationReference = 'CENTER_OF_DISK' | 'UPPER_LIMB';

export type WindowType =
  | 'SUNLIGHT'
  | 'DARKNESS'
  | 'EARTH_LINE_OF_SIGHT'
  | 'EARTH_OCCULTED'
  | 'COMBINED_OPPORTUNITY';

export type TerrainVisibilityStatus =
  | 'DEM_MODEL_CLEAR'
  | 'DEM_MODEL_OCCULTED'
  | 'UNRESOLVED_NEAR_TANGENT'
  | 'UNRESOLVED_COVERAGE'
  | 'PARTIAL_COVERAGE_EXIT_CELL'
  | 'BOUNDARY_EXIT_GEOGRAPHIC'
  | 'OUT_OF_COVERAGE'
  | 'SPHERICAL_CLEAR'
  | 'SPHERICAL_OCCULTED';

export type TerrainFidelity = 'SPHERICAL_DATUM_ONLY' | 'LOLA_TOPOGRAPHIC_HORIZON' | 'NONE';

export type DataProvenance =
  | 'REAL_NASA_JPL_HORIZONS'
  | 'ANALYTICAL_APPROXIMATION'
  | 'HISTORICAL_BENCHMARK'
  | 'SYNTHETIC_TEST_FIXTURE';

export interface MissionVisibilityRequest {
  site: SelenographicCoordinates;
  start_time_utc: string; // ISO 8601 with Z or timezone offset
  end_time_utc: string;
  sampling_interval_minutes?: number;
  min_solar_elevation_deg?: number;
  solar_elevation_reference?: SolarElevationReference;
  min_earth_elevation_deg?: number;
  include_timeline?: boolean;
  require_terrain_occlusion?: boolean;
}

export interface EphemerisSample {
  timestamp_utc: string;
  sun_azimuth_deg: number;
  sun_center_elevation_deg: number;
  sun_upper_limb_elevation_deg: number;
  solar_disk_illumination_fraction: number;
  is_sun_visible: boolean;
  earth_azimuth_deg: number;
  earth_center_elevation_deg: number;
  is_earth_line_of_sight: boolean;
  terrain_horizon_elevation_deg?: number | null;
}

export interface OperationalWindow {
  window_type: WindowType;
  start_time_utc: string;
  end_time_utc: string;
  duration_hours: number;
  peak_solar_elevation_deg?: number | null;
  mean_solar_elevation_deg?: number | null;
  min_earth_elevation_deg?: number | null;
}

export interface MissionSummary {
  total_duration_hours: number;
  total_sunlight_hours: number;
  sunlight_percentage: number;
  total_earth_line_of_sight_hours: number;
  earth_line_of_sight_percentage: number;
  combined_opportunity_hours: number;
  combined_opportunity_percentage: number;
  longest_continuous_sunlight_hours: number;
  longest_continuous_darkness_hours: number;
}

export interface ScientificDisclosure {
  fidelity?: string;
  provenance?: DataProvenance;
  ephemeris_source?: string;
  coordinate_frame?: string;
  terrain_fidelity?: TerrainFidelity;
  data_quality_status?: string;
  assumptions: string[];
  limitations: string[];
  disclaimer?: string;
  // Legacy / UI aliases
  lunar_orientation_model?: string;
  terrain_model?: string;
  elevation_datum?: string;
  calculation_epoch?: string;
  methodology_notes?: string;
}

export interface MissionVisibilityResponse {
  site: SelenographicCoordinates;
  start_time_utc: string;
  end_time_utc: string;
  sampling_interval_minutes: number;
  summary: MissionSummary;
  windows: OperationalWindow[];
  timeline?: EphemerisSample[] | null;
  disclosure: ScientificDisclosure;
}

export interface TerrainProfileRequest {
  site: SelenographicCoordinates;
  azimuth_step_deg?: number; // 0.5 to 10.0 deg
  max_distance_km?: number; // 5.0 to 150.0 km
}

export interface TerrainProfileResponse {
  site: SelenographicCoordinates;
  elevation_m: number;
  azimuths_deg: number[];
  elevations_deg: number[];
  max_elevation_deg: number;
  min_elevation_deg: number;
  mean_elevation_deg: number;
  is_fully_within_dem: boolean;
  dem_coverage_status: string;
  disclosure: ScientificDisclosure;
}

export interface CandidateSiteInput {
  site_id: string;
  name: string;
  coordinates: SelenographicCoordinates;
  assessment_radius_km?: number;
  description?: string;
}

export interface RankingWeights {
  sunlight_weight: number;
  earth_los_weight: number;
  combined_opportunity_weight: number;
  terrain_slope_weight: number;
  data_completeness_weight: number;
}

export interface SiteEvaluationMetric {
  site_id: string;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  assessment_radius_km?: number;
  elevation_m: number;
  max_horizon_elevation_deg: number;
  mean_horizon_elevation_deg: number;
  sunlight_percentage: number;
  longest_continuous_sunlight_hours: number;
  longest_continuous_darkness_hours: number;
  earth_line_of_sight_percentage: number;
  combined_opportunity_percentage: number;
  dem_coverage_status: string;
  terrain_hazard_status?: string;
  data_completeness_percentage?: number;
  evidence_status?: string;
  composite_opportunity_score: number;
  relative_rank: number;
  criterion_contributions?: Record<string, number>;
  score_explanation?: string[];
}

export interface SiteComparisonRequest {
  sites: CandidateSiteInput[];
  start_time_utc: string;
  end_time_utc: string;
  sampling_interval_minutes?: number;
  min_solar_elevation_deg?: number;
  min_earth_elevation_deg?: number;
  require_terrain_occlusion?: boolean;
  weights?: RankingWeights;
}

export interface SiteComparisonResponse {
  start_time_utc: string;
  end_time_utc: string;
  duration_hours: number;
  sites: SiteEvaluationMetric[];
  highest_opportunity_site_id: string;
  comparison_notes: string[];
  disclosure: ScientificDisclosure;
}

export interface RootResponse {
  project: string;
  description: string;
  version: string;
}

export interface HealthResponse {
  status: string;
  project: string;
}

export interface ReadinessResponse {
  status: string;
  project: string;
  version?: string;
  services?: Record<string, string>;
  service_status?: Record<string, string>;
}
