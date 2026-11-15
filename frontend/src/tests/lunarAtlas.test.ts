import { describe, it, expect } from 'vitest';
import {
  R_MOON_SPHERE_M,
  RHO_80S_M,
  latLonToPolarStereo,
  polarStereoToLatLon,
  polarStereoToPixel,
  pixelToPolarStereo,
  isWithinDeclaredCoverage,
  isWithinRasterStorage,
  calculateGreatCircleDistance,
  polarStereoToSvg,
  svgToPolarStereo,
} from '../utils/polarProjection';
import { LUNAR_SOUTH_POLAR_LANDMARKS } from '../data/lunarLandmarks';

describe('Lunar Atlas Polar Stereographic Projection Engine', () => {
  it('correctly projects the South Pole singularity (-90°S, 0°E)', () => {
    const { x_m, y_m, rho_m } = latLonToPolarStereo(-90.0, 0.0);
    expect(x_m).toBe(0.0);
    expect(y_m).toBe(0.0);
    expect(rho_m).toBe(0.0);

    const inverse = polarStereoToLatLon(0.0, 0.0);
    expect(inverse.lat_deg).toBe(-90.0);
    expect(inverse.lon_deg).toBe(0.0);
  });

  it('correctly projects cardinal -80°S boundary points', () => {
    // 0°E (Earthward, positive Y)
    const p0 = latLonToPolarStereo(-80.0, 0.0);
    expect(p0.rho_m).toBeCloseTo(RHO_80S_M, 2);
    expect(p0.x_m).toBeCloseTo(0.0, 2);
    expect(p0.y_m).toBeCloseTo(RHO_80S_M, 2);

    // 90°E (Eastward, positive X)
    const p90 = latLonToPolarStereo(-80.0, 90.0);
    expect(p90.rho_m).toBeCloseTo(RHO_80S_M, 2);
    expect(p90.x_m).toBeCloseTo(RHO_80S_M, 2);
    expect(p90.y_m).toBeCloseTo(0.0, 2);

    // 180°E (Far-side, negative Y)
    const p180 = latLonToPolarStereo(-80.0, 180.0);
    expect(p180.rho_m).toBeCloseTo(RHO_80S_M, 2);
    expect(p180.x_m).toBeCloseTo(0.0, 2);
    expect(p180.y_m).toBeCloseTo(-RHO_80S_M, 2);

    // 270°E (Westward, negative X)
    const p270 = latLonToPolarStereo(-80.0, 270.0);
    expect(p270.rho_m).toBeCloseTo(RHO_80S_M, 2);
    expect(p270.x_m).toBeCloseTo(-RHO_80S_M, 2);
    expect(p270.y_m).toBeCloseTo(0.0, 2);
  });

  it('preserves millimeter-level round-trip accuracy on random polar points', () => {
    const testCases = [
      { lat: -89.44, lon: 138.0 }, // Connecting Ridge
      { lat: -88.50, lon: 271.7 }, // de Gerlache
      { lat: -84.90, lon: 12.9 },  // Malapert Mountain
      { lat: -87.40, lon: 354.9 }, // Haworth
      { lat: -85.28, lon: 53.26 }, // Nobile
    ];

    for (const { lat, lon } of testCases) {
      const proj = latLonToPolarStereo(lat, lon);
      const reconstructed = polarStereoToLatLon(proj.x_m, proj.y_m);

      expect(reconstructed.lat_deg).toBeCloseTo(lat, 5);
      expect(reconstructed.lon_deg).toBeCloseTo(lon, 4);

      // Metric round-trip
      const secondProj = latLonToPolarStereo(reconstructed.lat_deg, reconstructed.lon_deg);
      expect(Math.abs(secondProj.x_m - proj.x_m)).toBeLessThan(0.01);
      expect(Math.abs(secondProj.y_m - proj.y_m)).toBeLessThan(0.01);
    }
  });

  it('accurately maps South Pole to PDS center-registered pixel offset (15199.5, 15199.5)', () => {
    const polePix = polarStereoToPixel(0.0, 0.0);
    expect(polePix.col_0).toBe(15199.5);
    expect(polePix.row_0).toBe(15199.5);
    expect(polePix.sample_1).toBe(15200.5);
    expect(polePix.line_1).toBe(15200.5);
    expect(polePix.is_in_raster).toBe(true);

    const inversePole = pixelToPolarStereo(15199.5, 15199.5);
    expect(inversePole.x_m).toBe(0.0);
    expect(inversePole.y_m).toBe(0.0);
  });

  it('correctly assesses geographic coverage boundary and raster storage limits', () => {
    expect(isWithinDeclaredCoverage(-80.0)).toBe(true);
    expect(isWithinDeclaredCoverage(-85.0)).toBe(true);
    expect(isWithinDeclaredCoverage(-90.0)).toBe(true);
    expect(isWithinDeclaredCoverage(-79.99)).toBe(false);

    expect(isWithinRasterStorage(0, 0)).toBe(true);
    expect(isWithinRasterStorage(30399, 30399)).toBe(true);
    expect(isWithinRasterStorage(-0.5, -0.5)).toBe(true);
    expect(isWithinRasterStorage(30399.5, 30399.5)).toBe(true);
    expect(isWithinRasterStorage(-0.51, 15000)).toBe(false);
    expect(isWithinRasterStorage(15000, 30399.6)).toBe(false);
  });

  it('calculates exact Haversine great-circle and straight-line chord distances', () => {
    // Distance from South Pole (-90°S) to -80°S along meridian
    const result = calculateGreatCircleDistance(-90.0, 0.0, -80.0, 0.0);
    const expectedArcKm = (R_MOON_SPHERE_M * (10.0 * (Math.PI / 180.0))) / 1000.0;
    const expectedChordKm = (2.0 * R_MOON_SPHERE_M * Math.sin((5.0 * Math.PI) / 180.0)) / 1000.0;

    expect(result.distance_km).toBeCloseTo(expectedArcKm, 2);
    expect(result.chord_km).toBeCloseTo(expectedChordKm, 2);
    expect(result.chord_km).toBeLessThanOrEqual(result.distance_km);

    // Distance to self is zero
    const selfDist = calculateGreatCircleDistance(-85.0, 45.0, -85.0, 45.0);
    expect(selfDist.distance_km).toBe(0.0);
    expect(selfDist.chord_km).toBe(0.0);
  });

  it('round-trips SVG screen coordinates consistently', () => {
    const x = 50000.0;
    const y = -75000.0;
    const svg = polarStereoToSvg(x, y, 350.0);
    const roundTrip = svgToPolarStereo(svg.svgX, svg.svgY, 350.0);

    expect(roundTrip.x_m).toBeCloseTo(x, 1);
    expect(roundTrip.y_m).toBeCloseTo(y, 1);
  });
});

describe('Lunar Atlas South Polar Landmarks Dataset', () => {
  it('contains at least 14 curated features within the South Polar domain', () => {
    expect(LUNAR_SOUTH_POLAR_LANDMARKS.length).toBeGreaterThanOrEqual(14);

    for (const lm of LUNAR_SOUTH_POLAR_LANDMARKS) {
      expect(lm.latitude_deg).toBeLessThanOrEqual(-80.0);
      expect(lm.latitude_deg).toBeGreaterThanOrEqual(-90.0);
      expect(lm.longitude_deg).toBeGreaterThanOrEqual(-180.0);
      expect(lm.longitude_deg).toBeLessThanOrEqual(360.0);
      expect(lm.name.length).toBeGreaterThan(0);
      expect(lm.description.length).toBeGreaterThan(0);
    }
  });

  it('correctly includes primary landmark features and PSR cold-traps', () => {
    const shackleton = LUNAR_SOUTH_POLAR_LANDMARKS.find((lm) => lm.id === 'shackleton_crater');
    expect(shackleton).toBeDefined();
    expect(shackleton?.is_psr).toBe(true);
    expect(shackleton?.diameter_km).toBe(21.0);

    const malapert = LUNAR_SOUTH_POLAR_LANDMARKS.find((lm) => lm.id === 'malapert_mountain');
    expect(malapert).toBeDefined();
    expect(malapert?.type).toBe('MOUNTAIN');
    expect(malapert?.elevation_m).toBe(5000.0);

    const cabeus = LUNAR_SOUTH_POLAR_LANDMARKS.find((lm) => lm.id === 'cabeus_crater');
    expect(cabeus).toBeDefined();
    expect(cabeus?.type).toBe('HISTORIC_SITE');
    expect(cabeus?.is_psr).toBe(true);

    const psrLandmarks = LUNAR_SOUTH_POLAR_LANDMARKS.filter((lm) => lm.is_psr);
    expect(psrLandmarks.length).toBeGreaterThanOrEqual(5);
  });
});
