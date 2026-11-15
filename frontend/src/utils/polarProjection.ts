/**
 * Lunar South Polar Stereographic Map Projection Engine.
 * 
 * Implements high-precision forward and inverse map projection transformations
 * in strict accordance with NASA PDS LDEM_80S_20M and Snyder (1987) cartographic specifications.
 * Reference Sphere Radius: R_0 = 1,737,400.0 m (LOLA/PDS reference).
 */

export const R_MOON_SPHERE_M = 1737400.0;
export const LAT_BOUNDARY_DEG = -80.0;
export const RHO_80S_M = 304005.6080198808; // 2 * R_0 * tan(5 deg)
export const MAX_GRID_HALF_WIDTH_M = 304000.0; // 15200 pixels * 20 m/pixel
export const MAP_SCALE_M = 20.0;
export const OFFSET_0_BASED = 15199.5;
export const RASTER_DIMENSION = 30400;

export interface PolarStereoResult {
  x_m: number;
  y_m: number;
  rho_m: number;
}

export interface SelenographicCoord {
  lat_deg: number;
  lon_deg: number;
}

export interface PixelCoordResult {
  col_0: number;
  row_0: number;
  sample_1: number;
  line_1: number;
  is_in_raster: boolean;
}

export interface GeodesicResult {
  central_angle_rad: number;
  distance_km: number;
  chord_km: number;
}

/**
 * Forward South Polar Stereographic projection: (lat, lon) -> (X, Y) in meters.
 * - Center of projection: South Pole (lat = -90°).
 * - Y axis: 0° longitude (Earthward/prime meridian) points in +Y.
 * - X axis: 90° East longitude points in +X.
 * - Radial distance rho = 2 * R_0 * tan((90 + lat) / 2).
 */
export function latLonToPolarStereo(lat_deg: number, lon_deg: number): PolarStereoResult {
  if (!Number.isFinite(lat_deg) || !Number.isFinite(lon_deg)) {
    throw new Error(`Non-finite coordinates provided: lat=${lat_deg}, lon=${lon_deg}`);
  }

  // South Pole singularity
  if (lat_deg <= -90.0) {
    return { x_m: 0.0, y_m: 0.0, rho_m: 0.0 };
  }

  // Colatitude = 90 - |lat| = 90 + lat (since lat is negative)
  const colat_deg = 90.0 + lat_deg;
  const half_colat_rad = (colat_deg / 2.0) * (Math.PI / 180.0);
  const rho_m = 2.0 * R_MOON_SPHERE_M * Math.tan(half_colat_rad);

  const lon_rad = lon_deg * (Math.PI / 180.0);
  const x_m = rho_m * Math.sin(lon_rad);
  const y_m = rho_m * Math.cos(lon_rad);

  return { x_m, y_m, rho_m };
}

/**
 * Inverse South Polar Stereographic projection: (X, Y) in meters -> (lat, lon) in degrees.
 */
export function polarStereoToLatLon(x_m: number, y_m: number): SelenographicCoord {
  if (!Number.isFinite(x_m) || !Number.isFinite(y_m)) {
    throw new Error(`Non-finite projection coordinates provided: x=${x_m}, y=${y_m}`);
  }

  const rho_m = Math.sqrt(x_m * x_m + y_m * y_m);
  if (rho_m === 0.0) {
    return { lat_deg: -90.0, lon_deg: 0.0 };
  }

  const half_colat_rad = Math.atan(rho_m / (2.0 * R_MOON_SPHERE_M));
  const colat_deg = (2.0 * half_colat_rad) * (180.0 / Math.PI);
  const lat_deg = -(90.0 - colat_deg);

  let lon_deg = Math.atan2(x_m, y_m) * (180.0 / Math.PI);
  lon_deg = ((lon_deg % 360.0) + 360.0) % 360.0;

  return { lat_deg, lon_deg };
}

/**
 * Convert projected metric coordinates to continuous 0-based and Fortran 1-based DEM pixel coordinates.
 */
export function polarStereoToPixel(
  x_m: number,
  y_m: number,
  mapScale_m: number = MAP_SCALE_M,
  offset_0_based: number = OFFSET_0_BASED
): PixelCoordResult {
  const col_0 = offset_0_based + x_m / mapScale_m;
  const row_0 = offset_0_based - y_m / mapScale_m;
  const sample_1 = col_0 + 1.0;
  const line_1 = row_0 + 1.0;

  const is_in_raster =
    col_0 >= -0.5 &&
    col_0 <= RASTER_DIMENSION - 0.5 &&
    row_0 >= -0.5 &&
    row_0 <= RASTER_DIMENSION - 0.5;

  return { col_0, row_0, sample_1, line_1, is_in_raster };
}

/**
 * Convert continuous 0-based DEM pixel coordinates to projected metric coordinates.
 */
export function pixelToPolarStereo(
  col_0: number,
  row_0: number,
  mapScale_m: number = MAP_SCALE_M,
  offset_0_based: number = OFFSET_0_BASED
): PolarStereoResult {
  const x_m = (col_0 - offset_0_based) * mapScale_m;
  const y_m = (offset_0_based - row_0) * mapScale_m;
  const rho_m = Math.sqrt(x_m * x_m + y_m * y_m);

  return { x_m, y_m, rho_m };
}

/**
 * Check whether coordinates are within the geographic product coverage (latitude <= -80.0°S).
 */
export function isWithinDeclaredCoverage(lat_deg: number): boolean {
  return lat_deg <= LAT_BOUNDARY_DEG + 1e-7;
}

/**
 * Check whether continuous pixel coordinates fall within the physical 30400x30400 raster footprint.
 */
export function isWithinRasterStorage(col_0: number, row_0: number): boolean {
  return (
    col_0 >= -0.5 &&
    col_0 <= RASTER_DIMENSION - 0.5 &&
    row_0 >= -0.5 &&
    row_0 <= RASTER_DIMENSION - 0.5
  );
}

/**
 * Calculate the great-circle surface distance and 3D straight-line chord length between two selenographic points.
 * Uses high-precision Haversine formula for spherical lunar datum (R_0 = 1,737.4 km).
 */
export function calculateGreatCircleDistance(
  lat1_deg: number,
  lon1_deg: number,
  lat2_deg: number,
  lon2_deg: number
): GeodesicResult {
  const phi1 = lat1_deg * (Math.PI / 180.0);
  const phi2 = lat2_deg * (Math.PI / 180.0);
  const dPhi = (lat2_deg - lat1_deg) * (Math.PI / 180.0);
  const dLambda = (lon2_deg - lon1_deg) * (Math.PI / 180.0);

  const sinHalfDPhi = Math.sin(dPhi / 2.0);
  const sinHalfDLambda = Math.sin(dLambda / 2.0);

  const a =
    sinHalfDPhi * sinHalfDPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfDLambda * sinHalfDLambda;

  const clampedA = Math.max(0.0, Math.min(1.0, a));
  const central_angle_rad = 2.0 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1.0 - clampedA));

  const distance_m = R_MOON_SPHERE_M * central_angle_rad;
  const distance_km = distance_m / 1000.0;

  // 3D Euclidean straight-line chord distance through lunar sphere
  const chord_m = 2.0 * R_MOON_SPHERE_M * Math.sin(central_angle_rad / 2.0);
  const chord_km = chord_m / 1000.0;

  return {
    central_angle_rad,
    distance_km,
    chord_km,
  };
}

/**
 * Convert projected metric coordinates (X, Y) to normalized viewport SVG coordinates [-viewBoxRadius, viewBoxRadius].
 * In SVG, +Y is downward, so svgY = -Y_m * scale.
 */
export function polarStereoToSvg(
  x_m: number,
  y_m: number,
  svgRadius: number = 300,
  maxRho_m: number = RHO_80S_M
): { svgX: number; svgY: number } {
  const scale = svgRadius / maxRho_m;
  return {
    svgX: x_m * scale,
    svgY: -y_m * scale, // Inverted Y for screen coordinates
  };
}

/**
 * Convert SVG coordinates [-viewBoxRadius, viewBoxRadius] to projected metric coordinates (X, Y).
 */
export function svgToPolarStereo(
  svgX: number,
  svgY: number,
  svgRadius: number = 300,
  maxRho_m: number = RHO_80S_M
): PolarStereoResult {
  const scale = maxRho_m / svgRadius;
  const x_m = svgX * scale;
  const y_m = -svgY * scale; // Inverted back from screen coordinates
  const rho_m = Math.sqrt(x_m * x_m + y_m * y_m);
  return { x_m, y_m, rho_m };
}
