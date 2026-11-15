/**
 * Pre-curated candidate lunar landing sites with published literature coordinates.
 * Sourced directly from backend app/schemas/coordinates.py (CANDIDATE_LUNAR_SITES).
 */

import type { LunarSite } from '../types/api';

export const CANDIDATE_LUNAR_SITES: LunarSite[] = [
  {
    site_id: 'shackleton_connecting_ridge',
    name: 'Shackleton Connecting Ridge',
    coordinates: {
      latitude_deg: -89.44,
      longitude_deg: 138.0,
      elevation_m: 1100.0,
      frame: 'MOON_ME',
    },
    description: 'High-elevation ridge connecting Shackleton and de Gerlache craters. Prime candidate for quasi-continuous illumination.',
    region: 'South Pole',
  },
  {
    site_id: 'shackleton_rim_peak',
    name: 'Shackleton Rim Peak',
    coordinates: {
      latitude_deg: -89.9,
      longitude_deg: 0.0,
      elevation_m: 1200.0,
      frame: 'MOON_ME',
    },
    description: 'Ultra-high latitude peak on the rim of Shackleton crater with direct Earth visibility windows.',
    region: 'South Pole',
  },
  {
    site_id: 'de_gerlache_rim',
    name: 'de Gerlache Crater Rim',
    coordinates: {
      latitude_deg: -88.5,
      longitude_deg: -88.3,
      elevation_m: 600.0,
      frame: 'MOON_ME',
    },
    description: 'Elevated rim of de Gerlache crater providing alternate southern polar site access.',
    region: 'South Pole',
  },
  {
    site_id: 'malapert_mountain',
    name: 'Malapert Mountain (Peak M5)',
    coordinates: {
      latitude_deg: -84.9,
      longitude_deg: 12.9,
      elevation_m: 5000.0,
      frame: 'MOON_ME',
    },
    description: 'Massive elevated massif offering extended line-of-sight communications back to Earth.',
    region: 'South Polar Highlands',
  },
  {
    site_id: 'haworth_crater_floor',
    name: 'Haworth Crater Floor (PSR)',
    coordinates: {
      latitude_deg: -87.4,
      longitude_deg: -5.1,
      elevation_m: -2800.0,
      frame: 'MOON_ME',
    },
    description: 'Permanently shadowed region (PSR) inside deep crater floor for cryo-volatiles prospecting.',
    region: 'South Pole PSR',
  },
];
