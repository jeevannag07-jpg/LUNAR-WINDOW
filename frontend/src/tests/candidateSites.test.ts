import { describe, it, expect } from 'vitest';
import { CANDIDATE_LUNAR_SITES } from '../data/candidateSites';

describe('Candidate Lunar Sites Dataset Integrity', () => {
  it('contains at least 5 certified high-latitude candidate sites', () => {
    expect(CANDIDATE_LUNAR_SITES.length).toBeGreaterThanOrEqual(5);
  });

  it('verifies all sites adhere to MOON_ME reference frame', () => {
    for (const site of CANDIDATE_LUNAR_SITES) {
      expect(site.coordinates.frame).toBe('MOON_ME');
      expect(site.coordinates.latitude_deg).toBeGreaterThanOrEqual(-90.0);
      expect(site.coordinates.latitude_deg).toBeLessThanOrEqual(90.0);
      expect(site.coordinates.longitude_deg).toBeGreaterThanOrEqual(-180.0);
      expect(site.coordinates.longitude_deg).toBeLessThanOrEqual(180.0);
    }
  });

  it('ensures Shackleton Connecting Ridge has published coordinates', () => {
    const ridge = CANDIDATE_LUNAR_SITES.find((s) => s.site_id === 'shackleton_connecting_ridge');
    expect(ridge).toBeDefined();
    expect(ridge?.coordinates.latitude_deg).toBeCloseTo(-89.44, 2);
    expect(ridge?.coordinates.longitude_deg).toBeCloseTo(138.0, 1);
    expect(ridge?.coordinates.elevation_m).toBe(1100.0);
  });
});
