import { describe, it, expect } from 'vitest';
import { SYNTHETIC_FIXTURES } from '../data/syntheticFixtures';

describe('Synthetic Test Fixtures (F01–F14) Verification', () => {
  it('contains all fourteen certified benchmark fixtures', () => {
    expect(SYNTHETIC_FIXTURES.length).toBe(14);
    const ids = SYNTHETIC_FIXTURES.map((f) => f.id);
    for (let i = 1; i <= 14; i++) {
      const id = `F${i.toString().padStart(2, '0')}`;
      expect(ids).toContain(id);
    }
  });

  it('verifies explicit labelling on all synthetic fixtures', () => {
    for (const fix of SYNTHETIC_FIXTURES) {
      expect(fix.description).toContain('[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA]');
    }
  });

  it('verifies F01 departure from declared -80°S coverage', () => {
    const f01 = SYNTHETIC_FIXTURES.find((f) => f.id === 'F01');
    expect(f01).toBeDefined();
    expect(f01?.coverageStatus).toBe('OUT_OF_COVERAGE');
    expect(f01?.terminationState).toBe('IMMEDIATE_DECLARED_COVERAGE_EXIT');
    expect(f01?.surfaceArc_m).toBeCloseTo(99889.791, 2);
  });

  it('verifies F03 polar transit point', () => {
    const f03 = SYNTHETIC_FIXTURES.find((f) => f.id === 'F03');
    expect(f03).toBeDefined();
    expect(f03?.rasterCoords.col).toBe(15199.5);
    expect(f03?.rasterCoords.row).toBe(15199.5);
    expect(f03?.surfaceArc_m).toBeCloseTo(151616.752, 2);
    expect(f03?.physicalDistance_m).toBeCloseTo(152002.804, 2);
  });

  it('verifies F07 crater rim first entry event at 990m', () => {
    const f07 = SYNTHETIC_FIXTURES.find((f) => f.id === 'F07');
    expect(f07).toBeDefined();
    expect(f07?.physicalDistance_m).toBe(990.0);
    expect(f07?.terminationState).toBe('DEM_MODEL_OCCULTED');
  });

  it('verifies F12 first row entry event at row 7113 boundary', () => {
    const f12 = SYNTHETIC_FIXTURES.find((f) => f.id === 'F12');
    expect(f12).toBeDefined();
    expect(f12?.physicalDistance_m).toBeCloseTo(9986.745, 2);
    expect(f12?.projectedCoords.y).toBe(161720.0);
    expect(f12?.rasterCoords.row).toBe(7113.5);
    expect(f12?.terminationState).toBe('DEM_MODEL_OCCULTED');
  });
});
