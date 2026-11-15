import { describe, it, expect } from 'vitest';
import type { RankingWeights, SiteEvaluationMetric } from '../types/api';
import { generateTabularCsvString } from '../utils/reportExport';

describe('Landing Site Intelligence — Ranking & Transparency Tests', () => {
  it('validates default weights summation and boundaries', () => {
    const defaultWeights: RankingWeights = {
      sunlight_weight: 0.40,
      earth_los_weight: 0.35,
      combined_opportunity_weight: 0.25,
      terrain_slope_weight: 0.0,
      data_completeness_weight: 0.0,
    };

    const sum =
      defaultWeights.sunlight_weight +
      defaultWeights.earth_los_weight +
      defaultWeights.combined_opportunity_weight +
      defaultWeights.terrain_slope_weight +
      defaultWeights.data_completeness_weight;

    expect(sum).toBeCloseTo(1.0, 5);
    expect(defaultWeights.terrain_slope_weight).toBe(0.0); // Locked when LOLA raster is absent
  });

  it('guarantees missing terrain data does not receive favorable scores', () => {
    const mockMetric: SiteEvaluationMetric = {
      site_id: 'SHACKLETON_RIDGE',
      name: 'Shackleton Connecting Ridge',
      latitude_deg: -89.44,
      longitude_deg: 138.0,
      assessment_radius_km: 10.0,
      elevation_m: 1100.0,
      max_horizon_elevation_deg: 0.0,
      mean_horizon_elevation_deg: 0.0,
      sunlight_percentage: 88.5,
      longest_continuous_sunlight_hours: 210.0,
      longest_continuous_darkness_hours: 24.0,
      earth_line_of_sight_percentage: 84.0,
      combined_opportunity_percentage: 80.0,
      dem_coverage_status: 'SPHERICAL_DATUM',
      terrain_hazard_status: 'DATA_UNAVAILABLE - LDEM_80S_20M binary raster absent',
      data_completeness_percentage: 57.1,
      evidence_status: 'PRELIMINARY_SCREENING_ONLY - INCOMPLETE_EVIDENCE',
      composite_opportunity_score: 84.8,
      relative_rank: 1,
      criterion_contributions: {
        sunlight_visibility: 35.4,
        earth_line_of_sight: 29.4,
        combined_sun_earth_opportunity: 20.0,
        terrain_obstruction_penalty: 0.0,
        terrain_slope_suitability: 0.0,
        surface_roughness: 0.0,
        boulder_hazard: 0.0,
      },
    };

    // Missing criteria MUST be 0.0
    expect(mockMetric.criterion_contributions?.terrain_slope_suitability).toBe(0.0);
    expect(mockMetric.criterion_contributions?.surface_roughness).toBe(0.0);
    expect(mockMetric.criterion_contributions?.boulder_hazard).toBe(0.0);
    expect(mockMetric.terrain_hazard_status).toContain('DATA_UNAVAILABLE');
    expect(mockMetric.evidence_status).toContain('INCOMPLETE_EVIDENCE');
  });

  it('verifies CSV tabular output format and headers', () => {
    const sites: SiteEvaluationMetric[] = [
      {
        site_id: 'SITE_1',
        name: 'Candidate Site 1',
        latitude_deg: -89.0,
        longitude_deg: 10.0,
        assessment_radius_km: 10.0,
        elevation_m: 500.0,
        max_horizon_elevation_deg: 1.2,
        mean_horizon_elevation_deg: 0.8,
        sunlight_percentage: 85.0,
        longest_continuous_sunlight_hours: 180.0,
        longest_continuous_darkness_hours: 30.0,
        earth_line_of_sight_percentage: 80.0,
        combined_opportunity_percentage: 75.0,
        dem_coverage_status: 'SPHERICAL_DATUM',
        terrain_hazard_status: 'DATA_UNAVAILABLE',
        data_completeness_percentage: 57.1,
        evidence_status: 'INCOMPLETE_EVIDENCE',
        composite_opportunity_score: 80.0,
        relative_rank: 1,
      },
    ];

    const csv = generateTabularCsvString(sites);
    expect(csv).toContain('Relative Rank,Site ID,Site Name');
    expect(csv).toContain('"SITE_1"');
    expect(csv).toContain('DATA_UNAVAILABLE');
    expect(csv).toContain('INCOMPLETE_EVIDENCE');
  });
});
