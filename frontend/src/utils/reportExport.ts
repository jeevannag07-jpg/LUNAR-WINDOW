/**
 * LUNAR WINDOW — Report Export Utility
 * Provides structured JSON, CSV tabular data, and formatted PDF/Print layout exports.
 */

import type { SiteComparisonResponse, SiteEvaluationMetric, RankingWeights } from '../types/api';

export interface LandingAssessmentReportData {
  title: string;
  generated_utc: string;
  project: string;
  version: string;
  coordinate_frame: string;
  weights_used: RankingWeights;
  selected_site: {
    site_id: string;
    name: string;
    latitude_deg: number;
    longitude_deg: number;
    assessment_radius_km: number;
    elevation_m: number;
  };
  terrain_assessment: {
    slope_status: string;
    roughness_status: string;
    elevation_variation_status: string;
    boulder_hazard_status: string;
    active_terrain_source: string;
    data_missing_disclosure: string;
  };
  illumination_assessment: {
    sunlight_percentage: number;
    longest_continuous_sunlight_hours: number;
    longest_continuous_darkness_hours: number;
    ephemeris_source: string;
    solar_power_disclaimer: string;
  };
  earth_visibility_assessment: {
    earth_line_of_sight_percentage: number;
    simultaneous_window_percentage: number;
    rf_communications_disclaimer: string;
  };
  candidate_comparison: SiteEvaluationMetric[];
  preliminary_verdict: {
    highest_opportunity_site_id: string;
    composite_opportunity_score: number;
    relative_rank: number;
    evidence_status: string;
    safety_disclaimer: string;
  };
  disclosure: {
    provenance: string;
    assumptions: string[];
    limitations: string[];
  };
}

export function exportStructuredJson(data: unknown, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateTabularCsvString(sites: SiteEvaluationMetric[]): string {
  const headers = [
    'Relative Rank',
    'Site ID',
    'Site Name',
    'Latitude (deg)',
    'Longitude (deg)',
    'Assessment Radius (km)',
    'Elevation (m)',
    'Sunlight %',
    'Continuous Sunlight (hrs)',
    'Continuous Darkness (hrs)',
    'Earth Line-of-Sight %',
    'Combined Sun+Earth %',
    'Mean Horizon (deg)',
    'Composite Score',
    'Data Completeness %',
    'Terrain Hazard Status',
    'Evidence Status',
  ];

  const rows = sites.map((s) => [
    s.relative_rank,
    `"${s.site_id}"`,
    `"${s.name}"`,
    s.latitude_deg.toFixed(4),
    s.longitude_deg.toFixed(4),
    s.assessment_radius_km ?? 10.0,
    s.elevation_m.toFixed(1),
    s.sunlight_percentage.toFixed(2),
    s.longest_continuous_sunlight_hours.toFixed(2),
    s.longest_continuous_darkness_hours.toFixed(2),
    s.earth_line_of_sight_percentage.toFixed(2),
    s.combined_opportunity_percentage.toFixed(2),
    s.mean_horizon_elevation_deg.toFixed(2),
    s.composite_opportunity_score.toFixed(2),
    s.data_completeness_percentage ?? 57.1,
    `"${s.terrain_hazard_status || 'DATA_UNAVAILABLE'}"`,
    `"${s.evidence_status || 'INCOMPLETE_EVIDENCE'}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportTabularCsv(sites: SiteEvaluationMetric[], filename: string): void {
  const csvContent = generateTabularCsvString(sites);
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function triggerPrintReport(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
