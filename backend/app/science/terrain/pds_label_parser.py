"""Parser for NASA PDS3 label files (.LBL) accompanying LOLA DEM products."""

from __future__ import annotations

from pathlib import Path
import re
from typing import Any

from app.science.terrain.models import PDSLabelMetadata


class PDSLabelParser:
    """Robust parser for NASA PDS3 label files (.LBL).

    Extracts projection, grid dimension, scaling, and offset parameters from ODL text.
    Validates required fields strictly against planetary cartographic standards and rejects
    malformed or contradictory metadata.
    """

    @staticmethod
    def _strip_comments(text: str) -> str:
        """Strip C-style block comments /* ... */ from PDS label text."""
        return re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)

    @classmethod
    def parse_text(cls, label_text: str) -> PDSLabelMetadata:
        """Parse raw PDS3 label text and return a strictly validated PDSLabelMetadata instance.

        Raises:
            ValueError: If metadata is malformed, missing required fields, or contradictory.
        """
        clean_text = cls._strip_comments(label_text)
        kv_pairs: dict[str, str] = {}

        pattern = re.compile(
            r"^\s*([A-Za-z0-9_:\^]+)\s*=\s*(.*?)\s*$",
            re.MULTILINE
        )

        for match in pattern.finditer(clean_text):
            key = match.group(1).strip()
            val_raw = match.group(2).strip()

            # Remove trailing units e.g. <PIX/DEG>, <M/PIX>, <DEG>, <KM>
            val_clean = re.sub(r"<[^>]+>", "", val_raw).strip()

            # Remove enclosing quotes if present
            if (val_clean.startswith('"') and val_clean.endswith('"')) or (
                val_clean.startswith("'") and val_clean.endswith("'")
            ):
                val_clean = val_clean[1:-1].strip()

            kv_pairs[key] = val_clean

        # Mandatory Field Extraction and Validation
        def get_required(key: str) -> str:
            if key not in kv_pairs or not kv_pairs[key] or kv_pairs[key] == "N/A":
                raise ValueError(f"Missing mandatory PDS keyword: {key}")
            return kv_pairs[key]

        def get_float(key: str) -> float:
            val_str = get_required(key)
            try:
                return float(val_str)
            except ValueError as e:
                raise ValueError(f"Non-numeric value for {key}: '{val_str}'") from e

        def get_int(key: str) -> int:
            val_str = get_required(key)
            try:
                return int(val_str)
            except ValueError as e:
                raise ValueError(f"Non-integer value for {key}: '{val_str}'") from e

        # 1. Product Identifier
        file_name = kv_pairs.get("FILE_NAME", "")
        product_id = Path(file_name).stem if file_name else kv_pairs.get("PRODUCT_ID", "")
        if not product_id:
            product_id = "LDEM_80S_20M"

        # 2. Map Projection Validation
        proj_type = get_required("MAP_PROJECTION_TYPE").upper()
        if proj_type != "POLAR STEREOGRAPHIC":
            raise ValueError(f"Unsupported MAP_PROJECTION_TYPE: '{proj_type}' (expected 'POLAR STEREOGRAPHIC')")

        coord_system = get_required("COORDINATE_SYSTEM_NAME")
        coord_sys_type = kv_pairs.get("COORDINATE_SYSTEM_TYPE", "BODY-FIXED ROTATING")

        # 3. Reference Radii Validation
        a_radius = get_float("A_AXIS_RADIUS")
        b_radius = get_float("B_AXIS_RADIUS")
        c_radius = get_float("C_AXIS_RADIUS")
        if a_radius <= 0 or b_radius <= 0 or c_radius <= 0:
            raise ValueError(f"Invalid reference radii: A={a_radius}, B={b_radius}, C={c_radius}")

        # 4. Projection Center & Extent
        center_lat = get_float("CENTER_LATITUDE")
        center_lon = get_float("CENTER_LONGITUDE")
        if center_lat != -90.0:
            raise ValueError(f"Unsupported CENTER_LATITUDE: {center_lat}° (expected -90° for South Polar DEM)")

        max_lat = get_float("MAXIMUM_LATITUDE")
        min_lat = get_float("MINIMUM_LATITUDE")
        if min_lat > max_lat:
            raise ValueError(f"Contradictory latitude bounds: MINIMUM_LATITUDE ({min_lat}) > MAXIMUM_LATITUDE ({max_lat})")
        if min_lat < -90.0 or max_lat > 0.0:
            raise ValueError(f"Latitude coverage out of range for south polar DEM: [{min_lat}, {max_lat}]")

        # 5. Grid Resolution and Dimensions
        lines = get_int("LINES")
        samples = get_int("LINE_SAMPLES")
        if lines <= 0 or samples <= 0:
            raise ValueError(f"Invalid raster dimensions: LINES={lines}, LINE_SAMPLES={samples}")

        map_scale = get_float("MAP_SCALE")
        map_res = get_float("MAP_RESOLUTION")
        if map_scale <= 0 or map_res <= 0:
            raise ValueError(f"Invalid scale or resolution: MAP_SCALE={map_scale}, MAP_RESOLUTION={map_res}")

        # 6. Projection Offsets
        line_proj_offset = get_float("LINE_PROJECTION_OFFSET")
        sample_proj_offset = get_float("SAMPLE_PROJECTION_OFFSET")

        # 7. Sample Encoding and Byte Order
        sample_type = get_required("SAMPLE_TYPE").upper()
        if sample_type != "LSB_INTEGER":
            raise ValueError(f"Unsupported SAMPLE_TYPE: '{sample_type}' (only LSB_INTEGER / little-endian supported)")

        sample_bits = get_int("SAMPLE_BITS")
        if sample_bits != 16:
            raise ValueError(f"Unsupported SAMPLE_BITS: {sample_bits} (expected 16-bit integer)")

        # 8. Elevation Scaling and Reference Radius
        scaling_factor = get_float("SCALING_FACTOR")
        offset_m = get_float("OFFSET")
        if scaling_factor <= 0:
            raise ValueError(f"Invalid SCALING_FACTOR: {scaling_factor}")
        if offset_m <= 0:
            raise ValueError(f"Invalid planetary OFFSET: {offset_m}")

        # Optional derived bounds (descriptive statistical observations, not validity thresholds)
        derived_min = int(kv_pairs["DERIVED_MINIMUM"]) if "DERIVED_MINIMUM" in kv_pairs else None
        derived_max = int(kv_pairs["DERIVED_MAXIMUM"]) if "DERIVED_MAXIMUM" in kv_pairs else None
        if derived_min is not None and derived_max is not None and derived_min > derived_max:
            raise ValueError(f"Contradictory derived bounds: DERIVED_MINIMUM ({derived_min}) > DERIVED_MAXIMUM ({derived_max})")

        # Explicit NoData sentinel detection (NULL or MISSING_CONSTANT keywords)
        # Note: In LDEM_80S_20M.LBL, neither keyword exists. The sentinel is therefore None (unresolved).
        nodata_val: int | None = None
        if "NULL" in kv_pairs and kv_pairs["NULL"] != "N/A":
            try:
                nodata_val = int(kv_pairs["NULL"])
            except ValueError:
                pass
        elif "MISSING_CONSTANT" in kv_pairs and kv_pairs["MISSING_CONSTANT"] != "N/A":
            try:
                nodata_val = int(kv_pairs["MISSING_CONSTANT"])
            except ValueError:
                pass

        return PDSLabelMetadata(
            product_id=product_id,
            map_projection_type=proj_type,
            coordinate_system_name=coord_system,
            coordinate_system_type=coord_sys_type,
            a_axis_radius_km=a_radius,
            b_axis_radius_km=b_radius,
            c_axis_radius_km=c_radius,
            center_latitude_deg=center_lat,
            center_longitude_deg=center_lon,
            maximum_latitude_deg=max_lat,
            minimum_latitude_deg=min_lat,
            map_resolution_pix_deg=map_res,
            map_scale_m_pix=map_scale,
            lines=lines,
            line_samples=samples,
            line_projection_offset=line_proj_offset,
            sample_projection_offset=sample_proj_offset,
            sample_type=sample_type,
            sample_bits=sample_bits,
            unit=kv_pairs.get("UNIT", "METER"),
            scaling_factor=scaling_factor,
            offset_m=offset_m,
            derived_minimum=derived_min,
            derived_maximum=derived_max,
            nodata_value=nodata_val,
        )

    @classmethod
    def parse_file(cls, file_path: Path | str) -> PDSLabelMetadata:
        """Read a PDS label file from disk and parse its metadata."""
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"PDS label file not found: {path}")
        content = path.read_text(encoding="utf-8", errors="ignore")
        return cls.parse_text(content)
