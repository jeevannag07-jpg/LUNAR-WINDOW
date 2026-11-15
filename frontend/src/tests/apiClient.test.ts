import { describe, it, expect, vi } from 'vitest';
import { ApiClient, ApiError } from '../services/apiClient';

describe('ApiClient Unit Tests', () => {
  it('instantiates cleanly with normalized base URL', () => {
    const client = new ApiClient('http://localhost:8000///');
    expect(client).toBeDefined();
  });

  it('handles ApiError with status and custom detail', () => {
    const err = new ApiError(501, 'Not Implemented', { milestone: 'Stage 2' });
    expect(err.status).toBe(501);
    expect(err.statusText).toBe('Not Implemented');
    expect(err.message).toContain('501');
    expect(err.message).toContain('Stage 2');
  });

  it('correctly reports network errors on connection failure', async () => {
    const client = new ApiClient('http://invalid-unreachable-host:9999');
    // Global fetch mock to simulate network failure
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(client.getHealth()).rejects.toThrow('Network failure connecting to LUNAR WINDOW backend');
  });

  it('correctly processes successful JSON responses', async () => {
    const mockHealth = { status: 'healthy', project: 'LUNAR WINDOW' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    });

    const client = new ApiClient('http://localhost:8000');
    const res = await client.getHealth();
    expect(res.status).toBe('healthy');
    expect(res.project).toBe('LUNAR WINDOW');
  });

  it('normalizes readiness probe service_status and services fields', async () => {
    const mockReady = {
      status: 'ready',
      project: 'LUNAR WINDOW',
      services: { spice: 'operational', horizons: 'operational' },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReady,
    });

    const client = new ApiClient('http://localhost:8000');
    const res = await client.getReady();
    expect(res.status).toBe('ready');
    expect(res.service_status?.spice).toBe('operational');
  });

  it('submits terrain profile request to /api/v1/analysis/terrain/profile', async () => {
    const mockTerrain = {
      site: { latitude_deg: -89.44, longitude_deg: 138.0, elevation_m: 1100.0 },
      elevation_m: 1100.0,
      azimuths_deg: [0.0, 180.0],
      elevations_deg: [0.1, -0.2],
      max_elevation_deg: 0.1,
      min_elevation_deg: -0.2,
      mean_elevation_deg: -0.05,
      is_fully_within_dem: true,
      dem_coverage_status: 'SPHERICAL_DATUM',
      disclosure: { assumptions: [], limitations: [] },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTerrain,
    });

    const client = new ApiClient('http://localhost:8000');
    const res = await client.getTerrainProfile({
      site: { latitude_deg: -89.44, longitude_deg: 138.0, elevation_m: 1100.0 },
      azimuth_step_deg: 5.0,
    });
    expect(res.dem_coverage_status).toBe('SPHERICAL_DATUM');
    expect(res.max_elevation_deg).toBe(0.1);
  });

  it('submits multi-site comparison request to /api/v1/analysis/compare', async () => {
    const mockCompare = {
      start_time_utc: '2027-01-01T00:00:00Z',
      end_time_utc: '2027-01-02T00:00:00Z',
      duration_hours: 24.0,
      sites: [
        {
          site_id: 'SHACKLETON_RIM',
          name: 'Shackleton Rim',
          latitude_deg: -89.44,
          longitude_deg: 138.0,
          elevation_m: 1100.0,
          max_horizon_elevation_deg: 0.5,
          mean_horizon_elevation_deg: 0.1,
          sunlight_percentage: 100.0,
          longest_continuous_sunlight_hours: 24.0,
          longest_continuous_darkness_hours: 0.0,
          earth_line_of_sight_percentage: 100.0,
          combined_opportunity_percentage: 100.0,
          dem_coverage_status: 'SPHERICAL_DATUM',
          composite_opportunity_score: 95.0,
          relative_rank: 1,
        },
      ],
      highest_opportunity_site_id: 'SHACKLETON_RIM',
      comparison_notes: ['Top site ranked by composite score'],
      disclosure: { assumptions: [], limitations: [] },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCompare,
    });

    const client = new ApiClient('http://localhost:8000');
    const res = await client.compareSites({
      sites: [
        {
          site_id: 'SHACKLETON_RIM',
          name: 'Shackleton Rim',
          coordinates: { latitude_deg: -89.44, longitude_deg: 138.0, elevation_m: 1100.0 },
        },
      ],
      start_time_utc: '2027-01-01T00:00:00Z',
      end_time_utc: '2027-01-02T00:00:00Z',
    });
    expect(res.highest_opportunity_site_id).toBe('SHACKLETON_RIM');
    expect(res.sites).toHaveLength(1);
    expect(res.sites[0].composite_opportunity_score).toBe(95.0);
  });
});
