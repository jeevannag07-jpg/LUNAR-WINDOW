/**
 * Authoritative Synthetic Benchmark Fixtures (F01–F14)
 * Certified by Stage 6B.4S/T Computational Geometry Audit.
 * 
 * NOTICE: Every fixture here is explicitly labelled:
 * [SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA]
 * Used for offline verification and UI regression validation only.
 */

export interface TestFixture {
  id: string;
  name: string;
  observer: {
    lat: number;
    lon: number;
    height: number;
  };
  pointing: {
    azimuth: number;
    elevation: number;
  };
  physicalDistance_m: number;
  surfaceArc_m: number;
  projectedCoords: {
    x: number;
    y: number;
  };
  rasterCoords: {
    col: number;
    row: number;
  };
  coverageStatus: 'IN_COVERAGE' | 'OUT_OF_COVERAGE' | 'BOUNDARY_EXIT';
  terminationState: string;
  description: string;
}

export const SYNTHETIC_FIXTURES: TestFixture[] = [
  {
    id: 'F01',
    name: 'Tangential East Ray at Coverage Boundary',
    observer: { lat: -80.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 90.0, elevation: 0.0 },
    physicalDistance_m: 100000.0,
    surfaceArc_m: 99889.791,
    projectedCoords: { x: 100681.472, y: 303752.321 },
    rasterCoords: { col: 20233.574, row: 11.884 },
    coverageStatus: 'OUT_OF_COVERAGE',
    terminationState: 'IMMEDIATE_DECLARED_COVERAGE_EXIT',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Ray heading East from -80°S immediately exits the declared geographic boundary (φ > -80°S for all s > 0).',
  },
  {
    id: 'F02',
    name: 'Due North Meridian Ray from -80°S',
    observer: { lat: -80.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 0.0, elevation: 0.0 },
    physicalDistance_m: 0.0,
    surfaceArc_m: 0.0,
    projectedCoords: { x: 0.0, y: 304005.608 },
    rasterCoords: { col: 15199.5, row: -0.78 },
    coverageStatus: 'BOUNDARY_EXIT',
    terminationState: 'BOUNDARY_EXIT_GEOGRAPHIC',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Immediate northward exit at geographic parallel φ = -80.0°S.',
  },
  {
    id: 'F03',
    name: 'Due South Meridian Ray to South Pole',
    observer: { lat: -85.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 180.0, elevation: 0.0 },
    physicalDistance_m: 152002.804,
    surfaceArc_m: 151616.752,
    projectedCoords: { x: 0.0, y: 0.0 },
    rasterCoords: { col: 15199.5, row: 15199.5 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'POLE_TRANSIT_POINT',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Southward line along X=0 reaching the exact South Pole (col=15199.5, row=15199.5).',
  },
  {
    id: 'F04',
    name: 'Due North Meridian Ray to Boundary',
    observer: { lat: -85.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 0.0, elevation: 0.0 },
    physicalDistance_m: 152002.804,
    surfaceArc_m: 151616.752,
    projectedCoords: { x: 0.0, y: 304005.608 },
    rasterCoords: { col: 15199.5, row: -0.78 },
    coverageStatus: 'BOUNDARY_EXIT',
    terminationState: 'BOUNDARY_EXIT_GEOGRAPHIC',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Straight northward meridian ray traversing to the -80°S circular boundary.',
  },
  {
    id: 'F05',
    name: 'Meridian Ray along 90°E to South Pole',
    observer: { lat: -88.0, lon: 90.0, height: 0.0 },
    pointing: { azimuth: 180.0, elevation: 0.0 },
    physicalDistance_m: 60671.345,
    surfaceArc_m: 60646.701,
    projectedCoords: { x: 0.0, y: 0.0 },
    rasterCoords: { col: 15199.5, row: 15199.5 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'POLE_TRANSIT_POINT',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Ray along 90°E meridian reaching South Pole across 2° latitude.',
  },
  {
    id: 'F06',
    name: 'Trans-Polar Anti-Meridian Crossing',
    observer: { lat: -88.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 180.0, elevation: 0.0 },
    physicalDistance_m: 121490.843,
    surfaceArc_m: 121293.402,
    projectedCoords: { x: 0.0, y: -60652.86 },
    rasterCoords: { col: 15199.5, row: 18232.143 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'MAX_RANGE_REACHED',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] 4° trans-polar crossing passing South Pole into the 180°E anti-meridian.',
  },
  {
    id: 'F07',
    name: 'Synthetic Crater Rim Obstacle Entry',
    observer: { lat: -90.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 90.0, elevation: 0.0 },
    physicalDistance_m: 990.0,
    surfaceArc_m: 989.999893,
    projectedCoords: { x: 990.0, y: 0.0 },
    rasterCoords: { col: 149.5, row: 100.0 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'DEM_MODEL_OCCULTED',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Ray enters obstacle cell at exactly t=990 m (boundary) with ray altitude 0.282 m < 500 m.',
  },
  {
    id: 'F08',
    name: 'Skyward High-Elevation Ray (+45°)',
    observer: { lat: -85.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 90.0, elevation: 45.0 },
    physicalDistance_m: 50000.0,
    surfaceArc_m: 34645.629,
    projectedCoords: { x: 34712.817, y: 151697.933 },
    rasterCoords: { col: 16935.141, row: 7614.603 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'GEOMETRY_BENCHMARK_VALIDATED',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Geometry-only altitude benchmark: ray altitude reaches 35,707.863 m above surface.',
  },
  {
    id: 'F09',
    name: 'Downward Negative-Elevation Ray (-5°)',
    observer: { lat: -85.0, lon: 0.0, height: 100.0 },
    pointing: { azimuth: 90.0, elevation: -5.0 },
    physicalDistance_m: 1151.718,
    surfaceArc_m: 1147.335,
    projectedCoords: { x: 1149.523, y: 151713.028 },
    rasterCoords: { col: 15256.976, row: 7613.849 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'SPHERE_IMPACT',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Elevated observer at 100 m mast strikes reference sphere at first quadratic root t1=1,151.718 m.',
  },
  {
    id: 'F10',
    name: 'Exact Grid Vertex Crossing (4-Cell Corner)',
    observer: { lat: -90.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 45.0, elevation: 0.0 },
    physicalDistance_m: 14.142,
    surfaceArc_m: 14.142,
    projectedCoords: { x: 20.0, y: 20.0 },
    rasterCoords: { col: 1.0, row: 1.0 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'VERTEX_TRANSIT_PROCESSED',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Ray strikes exact grid vertex (20, 20) querying all 4 meeting cells under closed supercover.',
  },
  {
    id: 'F11',
    name: 'Tangent Point-Only Contact',
    observer: { lat: -90.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 0.0, elevation: 0.0 },
    physicalDistance_m: 100.0,
    surfaceArc_m: 100.0,
    projectedCoords: { x: 40.0, y: 40.0 },
    rasterCoords: { col: 2.0, row: 2.0 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'TANGENT_GRAZE_SUPERCOVER',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Circle touches boundary line at isolated point (40, 40) querying both adjacent cells.',
  },
  {
    id: 'F12',
    name: 'Step-Response Obstruction Entry (Row 7113)',
    observer: { lat: -85.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 0.0, elevation: 0.0 },
    physicalDistance_m: 9986.745,
    surfaceArc_m: 9986.635,
    projectedCoords: { x: 0.0, y: 161720.0 },
    rasterCoords: { col: 15199.5, row: 7113.5 },
    coverageStatus: 'IN_COVERAGE',
    terminationState: 'DEM_MODEL_OCCULTED',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Ray enters row 7113 at southern boundary Y=161,720 m where altitude 28.702 m < 500 m step.',
  },
  {
    id: 'F13',
    name: 'Long-Range Eastward Ray (300 km)',
    observer: { lat: -85.0, lon: 0.0, height: 0.0 },
    pointing: { azimuth: 90.0, elevation: 0.0 },
    physicalDistance_m: 264968.641,
    surfaceArc_m: 262942.548,
    projectedCoords: { x: 263944.89, y: 150839.334 },
    rasterCoords: { col: 28396.745, row: 7657.533 },
    coverageStatus: 'BOUNDARY_EXIT',
    terminationState: 'BOUNDARY_EXIT_GEOGRAPHIC',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Eastward ray crosses geographic coverage boundary φ = -80.0°S at t=264.97 km.',
  },
  {
    id: 'F14',
    name: 'Oblique Due North Boundary Exit',
    observer: { lat: -80.5, lon: 45.0, height: 0.0 },
    pointing: { azimuth: 0.0, elevation: 0.0 },
    physicalDistance_m: 15162.06,
    surfaceArc_m: 15161.675,
    projectedCoords: { x: 214964.427, y: 214964.427 },
    rasterCoords: { col: 25947.721, row: 4451.279 },
    coverageStatus: 'BOUNDARY_EXIT',
    terminationState: 'BOUNDARY_EXIT_GEOGRAPHIC',
    description: '[SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Northward ray crosses φ = -80.0°S boundary circle at ρ = 304,005.608 m.',
  },
];
