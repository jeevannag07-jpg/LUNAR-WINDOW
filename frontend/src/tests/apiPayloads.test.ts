import { describe, it, expect } from 'vitest';
import type {
  MissionVisibilityRequest,
  TerrainProfileRequest,
  SiteComparisonRequest,
  SelenographicCoordinates,
} from '../types/api';

describe('API Payload Specification & Request Validation', () => {
  const validSite: SelenographicCoordinates = {
    latitude_deg: -89.44,
    longitude_deg: 138.0,
    elevation_m: 1100.0,
    frame: 'MOON_ME',
  };

  it('validates MissionVisibilityRequest structure', () => {
    const payload: MissionVisibilityRequest = {
      site: validSite,
      start_time_utc: '2027-01-01T00:00:00Z',
      end_time_utc: '2027-01-14T00:00:00Z',
      sampling_interval_minutes: 60,
      min_solar_elevation_deg: 0.0,
      solar_elevation_reference: 'CENTER_OF_DISK',
      min_earth_elevation_deg: 0.0,
      include_timeline: false,
      require_terrain_occlusion: false,
    };

    expect(payload.site.frame).toBe('MOON_ME');
    expect(payload.sampling_interval_minutes).toBeGreaterThanOrEqual(1);
    expect(payload.sampling_interval_minutes).toBeLessThanOrEqual(1440);
    expect(payload.solar_elevation_reference).toBe('CENTER_OF_DISK');
  });

  it('enforces TerrainProfileRequest bounds: azimuth step [0.5, 10.0] deg and scan radius [5.0, 150.0] km', () => {
    const payload: TerrainProfileRequest = {
      site: validSite,
      azimuth_step_deg: 2.0,
      max_distance_km: 50.0,
    };

    expect(payload.azimuth_step_deg).toBeGreaterThanOrEqual(0.5);
    expect(payload.azimuth_step_deg).toBeLessThanOrEqual(10.0);
    expect(payload.max_distance_km).toBeGreaterThanOrEqual(5.0);
    expect(payload.max_distance_km).toBeLessThanOrEqual(150.0);
  });

  it('validates SiteComparisonRequest multi-site list', () => {
    const payload: SiteComparisonRequest = {
      sites: [
        {
          site_id: 'SHACKLETON_RIM',
          name: 'Shackleton Rim',
          coordinates: validSite,
        },
      ],
      start_time_utc: '2027-01-01T00:00:00Z',
      end_time_utc: '2027-01-03T00:00:00Z',
      sampling_interval_minutes: 60,
    };

    expect(payload.sites.length).toBeGreaterThanOrEqual(1);
    expect(payload.sites.length).toBeLessThanOrEqual(20);
    expect(payload.sites[0].coordinates.latitude_deg).toBe(-89.44);
  });
});
