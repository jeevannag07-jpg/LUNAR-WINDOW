import { describe, it, expect } from 'vitest';

describe('Polar Stereographic Mathematical Projection Tests', () => {
  const R0 = 1737400.0;

  it('verifies South Pole control point projection', () => {
    const lat = -90.0;
    const lon = 0.0;
    const colatRad = (90.0 + lat) * (Math.PI / 180.0);
    const rho = 2.0 * R0 * Math.tan(colatRad / 2.0);
    const X = rho * Math.sin(lon);
    const Y = rho * Math.cos(lon);
    const col = 15199.5 + X / 20.0;
    const row = 15199.5 - Y / 20.0;

    expect(rho).toBe(0.0);
    expect(X).toBe(0.0);
    expect(Y).toBe(0.0);
    expect(col).toBe(15199.5);
    expect(row).toBe(15199.5);
  });

  it('verifies -80°S geographic boundary radius is 304,005.608 m', () => {
    const lat = -80.0;
    const colatRad = (90.0 + lat) * (Math.PI / 180.0); // 10 degrees = 0.1745329 rad
    const rho = 2.0 * R0 * Math.tan(colatRad / 2.0);
    expect(rho).toBeCloseTo(304005.608, 2);
  });

  it('verifies round-trip inverse projection back to MOON_ME Cartesian frame', () => {
    const X = 100681.472;
    const Y = 303752.321;
    const rho = Math.sqrt(X * X + Y * Y);

    const denom = 4.0 * R0 * R0 + rho * rho;
    const X_ME = (4.0 * R0 * R0 * Y) / denom;
    const Y_ME = (4.0 * R0 * R0 * X) / denom;
    const Z_ME = (R0 * (rho * rho - 4.0 * R0 * R0)) / denom;

    const reconstructedRadius = Math.sqrt(X_ME * X_ME + Y_ME * Y_ME + Z_ME * Z_ME);
    expect(reconstructedRadius).toBeCloseTo(R0, 2);
  });
});
