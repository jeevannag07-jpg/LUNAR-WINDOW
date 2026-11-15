"""Lunar terrain elevation and surface topography engine.

Stage 6: Data Ingestion, PDS Parsing, Sub-raster Memory Mapping, Projections & Ray Tracing.
"""

from app.science.terrain.dem_raster import DEMRasterReader
from app.science.terrain.dem_service import DEMService
from app.science.terrain.horizon import generate_horizon_profile
from app.science.terrain.models import (
    ComputationState,
    DataCompletenessState,
    DEMCoverageState,
    DEMPixelCoord,
    DirectionalRayResult,
    DirectionalVisibilityStatus,
    GeographicCoverageState,
    HorizonProfile,
    MeasurementSupportStatus,
    PDSLabelMetadata,
    PolarStereoCoord,
    RayObstructionResult,
    SubRasterWindow,
    TerrainPatch,
    TerrainSampleResult,
)
from app.science.terrain.pds_label_parser import PDSLabelParser
from app.science.terrain.projection import (
    LAT_BOUNDARY_DEG,
    LAT_CARDINAL_EDGE_BOUNDARY_DEG,
    LAT_CARDINAL_PIXEL_CENTER_DEG,
    LAT_CORNER_BOUNDARY_DEG,
    MAX_GRID_HALF_WIDTH_M,
    RHO_80S_M,
    R_MOON_SPHERE_M,
    is_within_pixel_center_hull,
    is_within_raster_footprint,
    latlon_to_pixel,
    latlon_to_polar_stereo,
    pixel_to_latlon,
    pixel_to_polar_stereo,
    polar_stereo_to_latlon,
    polar_stereo_to_pixel,
)
from app.science.terrain.ray_traversal import evaluate_ray_obstruction

__all__ = [
    "ComputationState",
    "DataCompletenessState",
    "DEMCoverageState",
    "DEMPixelCoord",
    "DEMRasterReader",
    "DEMService",
    "DirectionalRayResult",
    "DirectionalVisibilityStatus",
    "GeographicCoverageState",
    "HorizonProfile",
    "LAT_BOUNDARY_DEG",
    "LAT_CARDINAL_EDGE_BOUNDARY_DEG",
    "LAT_CARDINAL_PIXEL_CENTER_DEG",
    "LAT_CORNER_BOUNDARY_DEG",
    "MAX_GRID_HALF_WIDTH_M",
    "MeasurementSupportStatus",
    "PDSLabelMetadata",
    "PDSLabelParser",
    "PolarStereoCoord",
    "RHO_80S_M",
    "R_MOON_SPHERE_M",
    "RayObstructionResult",
    "SubRasterWindow",
    "TerrainPatch",
    "TerrainSampleResult",
    "evaluate_ray_obstruction",
    "generate_horizon_profile",
    "is_within_pixel_center_hull",
    "is_within_raster_footprint",
    "latlon_to_pixel",
    "latlon_to_polar_stereo",
    "pixel_to_latlon",
    "pixel_to_polar_stereo",
    "polar_stereo_to_latlon",
    "polar_stereo_to_pixel",
]
