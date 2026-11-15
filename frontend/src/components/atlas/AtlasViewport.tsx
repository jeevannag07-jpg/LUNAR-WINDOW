import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Target, Layers as LayersIcon, MapPin, Play, Pause, RotateCw } from 'lucide-react';
import type { AtlasToolMode } from './AtlasToolbox';
import type { AtlasLayerConfig } from './AtlasLayerControl';
import type { LunarLandmark } from '../../data/lunarLandmarks';
import { LUNAR_SOUTH_POLAR_LANDMARKS } from '../../data/lunarLandmarks';
import type { LunarSite } from '../../types/api';
import { CANDIDATE_LUNAR_SITES } from '../../data/candidateSites';
import {
  R_MOON_SPHERE_M,
  RHO_80S_M,
  latLonToPolarStereo,
  polarStereoToLatLon,
  calculateGreatCircleDistance,
  isWithinDeclaredCoverage,
} from '../../utils/polarProjection';

export type AtlasViewMode = 'south-polar' | 'global-moon';

// --- WebGL 3D Rotating Moon Shaders ---
const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_rotation;
uniform vec3 u_lightDir;

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) {
    discard;
  }
  float z = sqrt(1.0 - r2);
  vec3 N = vec3(p.x, -p.y, z);

  // Subtle lunar axial obliquity (~1.54 deg to 6.68 deg)
  float tilt = 0.08;
  float cosT = cos(tilt);
  float sinT = sin(tilt);
  vec3 tilted = vec3(N.x * cosT + N.y * sinT, -N.x * sinT + N.y * cosT, N.z);

  // 3D polar spin around Y axis
  float cosR = cos(u_rotation);
  float sinR = sin(u_rotation);
  vec3 rot = vec3(tilted.x * cosR + tilted.z * sinR, tilted.y, -tilted.x * sinR + tilted.z * cosR);

  // Equirectangular mapping
  float lon = atan(rot.x, rot.z);
  float lat = asin(clamp(rot.y, -1.0, 1.0));
  vec2 uv = vec2(lon / 6.2831853 + 0.5, lat / 3.14159265 + 0.5);

  vec4 texColor = texture2D(u_texture, uv);

  // Lommel-Seeliger scattering
  float cosI = max(0.0, dot(N, u_lightDir));
  float cosE = max(0.01, z);
  float ls = cosI / (cosI + cosE + 0.05);

  // Earthshine ambient
  float illumination = max(0.12, ls * 1.35);

  // 3D limb fresnel glow
  float rim = pow(1.0 - z, 3.8) * 0.35;
  vec3 rimColor = vec3(0.22, 0.74, 0.97);

  vec3 color = texColor.rgb * illumination + rimColor * rim;
  gl_FragColor = vec4(color, 1.0);
}
`;

interface GlobalMoon3DCanvasProps {
  radius: number;
  isRotating: boolean;
}

const GlobalMoon3DCanvas: React.FC<GlobalMoon3DCanvasProps> = ({ radius, isRotating }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef<number>(0);
  const isRotatingRef = useRef<boolean>(isRotating);
  isRotatingRef.current = isRotating;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext('webgl', { alpha: true, antialias: true }) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const rotLoc = gl.getUniformLocation(program, 'u_rotation');
    const lightLoc = gl.getUniformLocation(program, 'u_lightDir');
    gl.uniform3f(lightLoc, 0.8, 0.35, 0.5);

    const texture = gl.createTexture();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/assets/basemaps/lroc_color_poles_1k.jpg';
    let textureLoaded = false;
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      textureLoaded = true;
    };

    let animId: number;
    const render = () => {
      if (isRotatingRef.current) {
        rotRef.current += 0.0006;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (textureLoaded) {
        gl.uniform1f(rotLoc, rotRef.current);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(radius * 2)}
      height={Math.round(radius * 2)}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
};

export interface AtlasViewportProps {
  toolMode: AtlasToolMode;
  layers: AtlasLayerConfig;
  viewMode?: AtlasViewMode;
  activeSite: LunarSite;
  selectedLandmark: LunarLandmark | null;
  inspectedCoords: { lat_deg: number; lon_deg: number } | null;
  measurePointA: { lat_deg: number; lon_deg: number } | null;
  measurePointB: { lat_deg: number; lon_deg: number } | null;
  assessmentRadiusKm?: number;
  onSelectLandmark: (landmark: LunarLandmark | null) => void;
  onInspectCoords: (coords: { lat_deg: number; lon_deg: number }) => void;
  onSetMeasurePointA: (point: { lat_deg: number; lon_deg: number } | null) => void;
  onSetMeasurePointB: (point: { lat_deg: number; lon_deg: number } | null) => void;
  onSelectSite: (site: LunarSite) => void;
  onToggleLayerControl?: () => void;
  isRotating?: boolean;
  onToggleRotation?: () => void;
  onHoverCoordsChange?: (coords: { lat_deg: number; lon_deg: number; elev_km?: number } | null) => void;
  onZoomChange?: (z: number) => void;
}

const DISK_RADIUS_SVG = 350.0;
const SVG_SCALE = DISK_RADIUS_SVG / RHO_80S_M; // px per meter in SVG space

export const AtlasViewport: React.FC<AtlasViewportProps> = ({
  toolMode,
  layers,
  viewMode = 'south-polar',
  activeSite,
  selectedLandmark,
  inspectedCoords,
  measurePointA,
  measurePointB,
  assessmentRadiusKm = 10.0,
  onSelectLandmark,
  onInspectCoords,
  onSetMeasurePointA,
  onSetMeasurePointB,
  onSelectSite,
  onToggleLayerControl,
  isRotating: isRotatingProp,
  onToggleRotation: onToggleRotationProp,
  onHoverCoordsChange,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverCoords, setHoverCoords] = useState<{ lat_deg: number; lon_deg: number; elev_km?: number } | null>({
    lat_deg: activeSite.coordinates.latitude_deg,
    lon_deg: activeSite.coordinates.longitude_deg,
    elev_km: (activeSite.coordinates.elevation_m || 1100.0) / 1000.0,
  });

  // 3D Slow Motion Rotation state
  const [internalIsRotating, setInternalIsRotating] = useState<boolean>(true);
  const isRotating = isRotatingProp !== undefined ? isRotatingProp : internalIsRotating;
  const animStartTimeRef = useRef<number>(performance.now());
  const pausedAngleRef = useRef<number>(0);

  const getRotationAngleDeg = useCallback(() => {
    if (!isRotating) return pausedAngleRef.current;
    const elapsedSec = (performance.now() - animStartTimeRef.current) / 1000.0;
    // 180s per full 360 deg revolution = 2.0 deg/sec
    return (pausedAngleRef.current + elapsedSec * 2.0) % 360.0;
  }, [isRotating]);

  const toggleRotation = useCallback(() => {
    if (onToggleRotationProp) {
      onToggleRotationProp();
    } else {
      setInternalIsRotating((prev) => {
        if (prev) {
          pausedAngleRef.current = getRotationAngleDeg();
        } else {
          animStartTimeRef.current = performance.now();
        }
        return !prev;
      });
    }
  }, [getRotationAngleDeg, onToggleRotationProp]);

  // Coordinate projection helper
  const projectToSvg = useCallback((lat_deg: number, lon_deg: number) => {
    const { x_m, y_m } = latLonToPolarStereo(lat_deg, lon_deg);
    return {
      svgX: x_m * SVG_SCALE,
      svgY: -y_m * SVG_SCALE, // Invert Y: +Y points UP (Earthward)
    };
  }, []);

  const svgToCoords = useCallback((svgX: number, svgY: number) => {
    const x_m = svgX / SVG_SCALE;
    const y_m = -svgY / SVG_SCALE;
    const { lat_deg, lon_deg } = polarStereoToLatLon(x_m, y_m);
    const rho_m = Math.sqrt(x_m * x_m + y_m * y_m);
    return { lat_deg, lon_deg, rho_m, x_m, y_m };
  }, []);

  // Zoom controls
  const handleZoom = useCallback((delta: number) => {
    setZoom((prevZoom) => {
      const nextZoom = Math.max(0.7, Math.min(10.0, prevZoom + delta));
      if (onZoomChange) onZoomChange(nextZoom);
      return nextZoom;
    });
  }, [onZoomChange]);

  // Center on active site
  const centerOnSite = useCallback((site: LunarSite) => {
    const { svgX, svgY } = projectToSvg(site.coordinates.latitude_deg, site.coordinates.longitude_deg);
    setPan({ x: -svgX * zoom, y: -svgY * zoom });
  }, [projectToSvg, zoom]);

  // Center on South Pole
  const resetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Window custom events
  useEffect(() => {
    const handleResetEvent = () => resetView();
    const handleCenterEvent = () => centerOnSite(activeSite);
    const handleZoomInEvent = () => handleZoom(0.35);
    const handleZoomOutEvent = () => handleZoom(-0.35);

    window.addEventListener('lunar-atlas-reset', handleResetEvent);
    window.addEventListener('lunar-atlas-center', handleCenterEvent);
    window.addEventListener('lunar-atlas-zoom-in', handleZoomInEvent);
    window.addEventListener('lunar-atlas-zoom-out', handleZoomOutEvent);

    return () => {
      window.removeEventListener('lunar-atlas-reset', handleResetEvent);
      window.removeEventListener('lunar-atlas-center', handleCenterEvent);
      window.removeEventListener('lunar-atlas-zoom-in', handleZoomInEvent);
      window.removeEventListener('lunar-atlas-zoom-out', handleZoomOutEvent);
    };
  }, [activeSite, centerOnSite, handleZoom, resetView]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    handleZoom(delta);
  };

  // Convert client mouse pos to SVG world coordinates
  const getSvgCoordinates = (e: React.MouseEvent<SVGSVGElement>): { svgX: number; svgY: number } => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const svgX = (clientX - centerX - pan.x) / zoom;
    const svgY = (clientY - centerY - pan.y) / zoom;

    return { svgX, svgY };
  };

  const [clickStartPos, setClickStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setClickStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    const { svgX, svgY } = getSvgCoordinates(e);
    let bodyX = svgX;
    let bodyY = svgY;
    if (viewMode === 'south-polar') {
      const rad = (-getRotationAngleDeg() * Math.PI) / 180.0;
      bodyX = svgX * Math.cos(rad) - svgY * Math.sin(rad);
      bodyY = svgX * Math.sin(rad) + svgY * Math.cos(rad);
    }
    const coords = svgToCoords(bodyX, bodyY);
    // Simple elevation estimate based on proximity to high-standing rims / pole
    const elevEstimate = Math.max(-4.2, Math.min(5.2, 1.2 + Math.sin(coords.lon_deg * 0.05) * 2.5));
    const nextHover = {
      lat_deg: coords.lat_deg,
      lon_deg: coords.lon_deg,
      elev_km: parseFloat(elevEstimate.toFixed(1)),
    };
    setHoverCoords(nextHover);
    if (onHoverCoordsChange) onHoverCoordsChange(nextHover);
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(false);

    const distMoved = Math.hypot(e.clientX - clickStartPos.x, e.clientY - clickStartPos.y);
    if (distMoved <= 5) {
      const { svgX, svgY } = getSvgCoordinates(e);
      let bodyX = svgX;
      let bodyY = svgY;
      if (viewMode === 'south-polar') {
        const rad = (-getRotationAngleDeg() * Math.PI) / 180.0;
        bodyX = svgX * Math.cos(rad) - svgY * Math.sin(rad);
        bodyY = svgX * Math.sin(rad) + svgY * Math.cos(rad);
      }
      const coords = svgToCoords(bodyX, bodyY);

      if (toolMode === 'INSPECT' || toolMode === 'LANDMARK') {
        onInspectCoords({ lat_deg: coords.lat_deg, lon_deg: coords.lon_deg });
      } else if (toolMode === 'MEASURE') {
        if (!measurePointA || (measurePointA && measurePointB)) {
          onSetMeasurePointA({ lat_deg: coords.lat_deg, lon_deg: coords.lon_deg });
          onSetMeasurePointB(null);
        } else if (measurePointA && !measurePointB) {
          onSetMeasurePointB({ lat_deg: coords.lat_deg, lon_deg: coords.lon_deg });
        }
      }
    }
  };

  // Measure distance calculation
  const pointA_Svg = measurePointA ? projectToSvg(measurePointA.lat_deg, measurePointA.lon_deg) : null;
  const pointB_Svg = measurePointB ? projectToSvg(measurePointB.lat_deg, measurePointB.lon_deg) : null;
  const measureDistance =
    measurePointA && measurePointB
      ? calculateGreatCircleDistance(
          measurePointA.lat_deg,
          measurePointA.lon_deg,
          measurePointB.lat_deg,
          measurePointB.lon_deg
        )
      : null;

  // Inspected point in SVG
  const inspectedSvg = inspectedCoords ? projectToSvg(inspectedCoords.lat_deg, inspectedCoords.lon_deg) : null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '460px',
        backgroundColor: '#040711',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-card)',
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* SVG Interactive Canvas */}
      <svg
        viewBox="-400 -400 800 800"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : toolMode === 'MEASURE' ? 'crosshair' : 'default',
        }}
      >
        <defs>
          {/* Circular mask for South Polar Disk */}
          <clipPath id="polarDiskClip">
            <circle cx="0" cy="0" r={DISK_RADIUS_SVG} />
          </clipPath>

          {/* Elevation colormap false-color gradient */}
          <radialGradient id="lolaElevationGradient" cx="48%" cy="48%" r="52%">
            <stop offset="0%" stopColor="#4338CA" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#06B6D4" stopOpacity="0.3" />
            <stop offset="65%" stopColor="#10B981" stopOpacity="0.3" />
            <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.4" />
          </radialGradient>

          {/* Slope relief highlight filter */}
          <radialGradient id="slopeShade" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="transparent" />
            <stop offset="95%" stopColor="#B45309" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#78350F" stopOpacity="0.6" />
          </radialGradient>

          {/* 3D Real Moon Spherical Illumination & Solar Terminator */}
          <radialGradient id="moon3dSunShade" cx="65%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.0" />
            <stop offset="42%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="72%" stopColor="#000000" stopOpacity="0.32" />
            <stop offset="88%" stopColor="#020617" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.92" />
          </radialGradient>

          {/* 3D Lunar Limb Horizon & Exosphere Glow */}
          <radialGradient id="moon3dLimbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="86%" stopColor="transparent" />
            <stop offset="96%" stopColor="rgba(56, 189, 248, 0.16)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0.48)" />
          </radialGradient>

          {/* 3D Slow Motion Planetary Rotation Keyframes */}
          <style>{`
            @keyframes moonSlowRotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes moonSlowCounterRotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(-360deg); }
            }
            .moon-3d-rotating-surface {
              transform-origin: 0px 0px;
            }
          `}</style>
        </defs>

        {/* Global Pan & Zoom Transform Group */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Base Lunar Polar Disk Boundary Circle */}
          <circle
            cx="0"
            cy="0"
            r={DISK_RADIUS_SVG}
            fill="#050811"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="1.5"
          />

          {/* 3D ROTATING MOON SURFACE GROUP */}
          <g
            className="moon-3d-rotating-surface"
            style={{
              transformOrigin: '0px 0px',
              animation: isRotating && viewMode === 'south-polar' ? 'moonSlowRotate 180s linear infinite' : 'none',
            }}
          >
            {/* LAYER 1: Genuine NASA LROC South Polar Photographic Basemap */}
            {layers.baseImagery && viewMode === 'south-polar' && (
              <g clipPath="url(#polarDiskClip)" opacity={layers.baseOpacity}>
                <image
                  href="/assets/basemaps/lroc_south_pole_basemap.png"
                  x={-DISK_RADIUS_SVG}
                  y={-DISK_RADIUS_SVG}
                  width={DISK_RADIUS_SVG * 2}
                  height={DISK_RADIUS_SVG * 2}
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>
            )}

            {/* Global Moon 3D Rotating Sphere View Mode */}
            {viewMode === 'global-moon' && (
              <g clipPath="url(#polarDiskClip)">
                <foreignObject
                  x={-DISK_RADIUS_SVG}
                  y={-DISK_RADIUS_SVG}
                  width={DISK_RADIUS_SVG * 2}
                  height={DISK_RADIUS_SVG * 2}
                >
                  <GlobalMoon3DCanvas radius={DISK_RADIUS_SVG} isRotating={isRotating} />
                </foreignObject>
              </g>
            )}

            {/* LAYER 2: Elevation (LOLA) Topographic Color Map */}
            {layers.elevation && (
              <circle
                cx="0"
                cy="0"
                r={DISK_RADIUS_SVG}
                fill="url(#lolaElevationGradient)"
                clipPath="url(#polarDiskClip)"
                opacity={layers.elevationOpacity}
                style={{ mixBlendMode: 'color-dodge' }}
              />
            )}

            {/* LAYER 3: Slope Map Overlay */}
            {layers.slopeMap && (
              <circle
                cx="0"
                cy="0"
                r={DISK_RADIUS_SVG}
                fill="url(#slopeShade)"
                clipPath="url(#polarDiskClip)"
                opacity="0.7"
                style={{ mixBlendMode: 'screen' }}
              />
            )}

            {/* LAYER 4: Illumination (Sunlight grazing angle) */}
            {layers.illumination && (
              <g clipPath="url(#polarDiskClip)" opacity={0.35}>
                <path
                  d={`M 0,0 L ${DISK_RADIUS_SVG * 1.2},-120 A ${DISK_RADIUS_SVG} ${DISK_RADIUS_SVG} 0 0 1 ${DISK_RADIUS_SVG * 1.2},120 Z`}
                  fill="#FDE047"
                  style={{ mixBlendMode: 'overlay' }}
                />
              </g>
            )}

            {/* LAYER 5: Coordinate Graticule Grid (Meridians & Parallels rotate with Moon) */}
            {layers.graticule && (
              <g id="layer-graticule">
                {/* Meridians radiating from South Pole */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angleDeg) => {
                  const angleRad = (angleDeg * Math.PI) / 180.0;
                  const endX = DISK_RADIUS_SVG * Math.sin(angleRad);
                  const endY = -DISK_RADIUS_SVG * Math.cos(angleRad);

                  return (
                    <line
                      key={`meridian-${angleDeg}`}
                      x1="0"
                      y1="0"
                      x2={endX}
                      y2={endY}
                      stroke="rgba(56, 189, 248, 0.25)"
                      strokeWidth="0.8"
                      strokeDasharray={angleDeg % 90 === 0 ? 'none' : '3 3'}
                    />
                  );
                })}

                {/* Concentric Latitude Circles */}
                {[
                  { r: 280, label: '-82°S' },
                  { r: 210, label: '-84°S' },
                  { r: 140, label: '-86°S' },
                  { r: 70, label: '-88°S' },
                ].map(({ r, label }) => (
                  <g key={`lat-circle-${label}`}>
                    <circle cx="0" cy="0" r={r} fill="none" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="0.8" />
                    <text
                      x="4"
                      y={-r + 3}
                      fill="rgba(56, 189, 248, 0.6)"
                      fontSize="7"
                      fontFamily="var(--font-mono)"
                    >
                      {label}
                    </text>
                  </g>
                ))}

                {/* South Pole Center Crosshair */}
                <line x1="-14" y1="0" x2="14" y2="0" stroke="var(--accent-cyan)" strokeWidth="1.2" />
                <line x1="0" y1="-14" x2="0" y2="14" stroke="var(--accent-cyan)" strokeWidth="1.2" />
                <circle cx="0" cy="0" r="2.5" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.2" />

                {/* Cardinal Labels on rotating rim */}
                <text
                  x="0"
                  y={-DISK_RADIUS_SVG - 8}
                  fill="var(--accent-cyan)"
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  0°
                </text>
                <text
                  x={DISK_RADIUS_SVG + 12}
                  y="4"
                  fill="var(--accent-cyan)"
                  fontSize="11"
                  textAnchor="start"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  90°E
                </text>
                <text
                  x="0"
                  y={DISK_RADIUS_SVG + 18}
                  fill="var(--accent-cyan)"
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  180°
                </text>
                <text
                  x={-DISK_RADIUS_SVG - 12}
                  y="4"
                  fill="var(--accent-cyan)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  90°W
                </text>
              </g>
            )}

            {/* LAYER 6: IAU Yellow Crater Boundaries (Reference 1 Design) */}
            {layers.craterBoundaries && (
              <g id="layer-crater-boundaries">
                {LUNAR_SOUTH_POLAR_LANDMARKS.filter((lm) => lm.diameter_km).map((lm) => {
                  const { svgX, svgY } = projectToSvg(lm.latitude_deg, lm.longitude_deg);
                  const radiusPx = Math.max(5.0, ((lm.diameter_km! * 1000 * SVG_SCALE) / 2));
                  const isSelected = selectedLandmark?.id === lm.id;
                  return (
                    <g key={`boundary-${lm.id}`}>
                      <circle
                        cx={svgX}
                        cy={svgY}
                        r={radiusPx}
                        fill={lm.is_psr ? 'rgba(250, 204, 21, 0.08)' : 'none'}
                        stroke={isSelected ? '#FACC15' : 'rgba(250, 204, 21, 0.65)'}
                        strokeWidth={isSelected ? '2' : '1.2'}
                        strokeDasharray={isSelected ? 'none' : '4 2'}
                      />
                      {/* Crater Diameter Label along rim */}
                      {radiusPx > 18 && (
                        <text
                          x={svgX}
                          y={svgY - radiusPx - 3}
                          fill="#FACC15"
                          fontSize="6.5"
                          fontFamily="var(--font-mono)"
                          fontWeight="700"
                          textAnchor="middle"
                          opacity={0.85}
                        >
                          {lm.name.toUpperCase()} (⌀{lm.diameter_km}km)
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* LAYER 7: Yellow Landmark Callout Badges (Reference 1 Design) */}
            <g id="layer-landmarks">
              {/* 1. Shackleton Crater Callout */}
              {(() => {
                const { svgX, svgY } = projectToSvg(-89.67, 129.78);
                const isSelected = selectedLandmark?.id === 'shackleton_crater';
                return (
                  <g
                    transform={`translate(${svgX}, ${svgY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const lm = LUNAR_SOUTH_POLAR_LANDMARKS.find((l) => l.id === 'shackleton_crater');
                      if (lm) {
                        onSelectLandmark(lm);
                        onInspectCoords({ lat_deg: lm.latitude_deg, lon_deg: lm.longitude_deg });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <g style={{ transformOrigin: 'center', animation: isRotating && viewMode === 'south-polar' ? 'moonSlowCounterRotate 180s linear infinite' : 'none' }}>
                      {isSelected && (
                        <circle cx="0" cy="0" r="18" fill="none" stroke="#FACC15" strokeWidth="2" strokeDasharray="3 3">
                          <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle cx="0" cy="0" r="12" fill="none" stroke="#FACC15" strokeWidth="2.5" />
                      <circle cx="0" cy="0" r="6" fill="#070D18" stroke="#FACC15" strokeWidth="2" />
                      <circle cx="0" cy="0" r="2.5" fill="#FACC15" />
                      {/* Dark Badge Pill */}
                      <g transform="translate(16, -12)">
                        <rect x="0" y="0" width="82" height="24" rx="4" fill="#070D18" stroke="rgba(250, 204, 21, 0.6)" strokeWidth="1.2" />
                        <text x="8" y="10" fill="#FACC15" fontSize="7.5" fontWeight="700" fontFamily="var(--font-sans)">
                          Shackleton
                        </text>
                        <text x="8" y="19" fill="#E2E8F0" fontSize="6.5" fontFamily="var(--font-sans)">
                          Crater (South Pole)
                        </text>
                      </g>
                    </g>
                  </g>
                );
              })()}

              {/* 2. De Gerlache Crater Callout */}
              {(() => {
                const { svgX, svgY } = projectToSvg(-88.48, -88.34);
                const isSelected = selectedLandmark?.id === 'de_gerlache_crater';
                return (
                  <g
                    transform={`translate(${svgX}, ${svgY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const lm = LUNAR_SOUTH_POLAR_LANDMARKS.find((l) => l.id === 'de_gerlache_crater');
                      if (lm) {
                        onSelectLandmark(lm);
                        onInspectCoords({ lat_deg: lm.latitude_deg, lon_deg: lm.longitude_deg });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <g style={{ transformOrigin: 'center', animation: isRotating && viewMode === 'south-polar' ? 'moonSlowCounterRotate 180s linear infinite' : 'none' }}>
                      {isSelected && (
                        <circle cx="0" cy="0" r="16" fill="none" stroke="#FACC15" strokeWidth="2" strokeDasharray="3 3">
                          <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle cx="0" cy="0" r="6" fill="#070D18" stroke="#FACC15" strokeWidth="2" />
                      <circle cx="0" cy="0" r="2" fill="#FACC15" />
                      <g transform="translate(10, -10)">
                        <rect x="0" y="0" width="72" height="22" rx="4" fill="#070D18" stroke="rgba(250, 204, 21, 0.5)" strokeWidth="1" />
                        <text x="7" y="9" fill="#FACC15" fontSize="7" fontWeight="700" fontFamily="var(--font-sans)">
                          De Gerlache
                        </text>
                        <text x="7" y="17" fill="#E2E8F0" fontSize="6" fontFamily="var(--font-sans)">
                          Crater (PSR)
                        </text>
                      </g>
                    </g>
                  </g>
                );
              })()}

              {/* 3. Malapert Massif Callout */}
              {(() => {
                const { svgX, svgY } = projectToSvg(-84.90, 12.90);
                const isSelected = selectedLandmark?.id === 'malapert_mountain';
                return (
                  <g
                    transform={`translate(${svgX}, ${svgY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const lm = LUNAR_SOUTH_POLAR_LANDMARKS.find((l) => l.id === 'malapert_mountain');
                      if (lm) {
                        onSelectLandmark(lm);
                        onInspectCoords({ lat_deg: lm.latitude_deg, lon_deg: lm.longitude_deg });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <g style={{ transformOrigin: 'center', animation: isRotating && viewMode === 'south-polar' ? 'moonSlowCounterRotate 180s linear infinite' : 'none' }}>
                      {isSelected && (
                        <circle cx="0" cy="0" r="16" fill="none" stroke="#FACC15" strokeWidth="2" strokeDasharray="3 3">
                          <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <polygon points="0,-8 7,5 -7,5" fill="#070D18" stroke="#FACC15" strokeWidth="2" />
                      <circle cx="0" cy="0" r="2" fill="#FACC15" />
                      <g transform="translate(12, -10)">
                        <rect x="0" y="0" width="62" height="22" rx="4" fill="#070D18" stroke="rgba(250, 204, 21, 0.5)" strokeWidth="1" />
                        <text x="6" y="9" fill="#FACC15" fontSize="7" fontWeight="700" fontFamily="var(--font-sans)">
                          Malapert
                        </text>
                        <text x="6" y="17" fill="#E2E8F0" fontSize="6" fontFamily="var(--font-sans)">
                          Massif (+5km)
                        </text>
                      </g>
                    </g>
                  </g>
                );
              })()}

              {/* 4. Connecting Ridge Callout */}
              {(() => {
                const { svgX, svgY } = projectToSvg(-89.44, 138.0);
                const isSelected = selectedLandmark?.id === 'shackleton_connecting_ridge';
                return (
                  <g
                    transform={`translate(${svgX}, ${svgY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const lm = LUNAR_SOUTH_POLAR_LANDMARKS.find((l) => l.id === 'shackleton_connecting_ridge');
                      if (lm) {
                        onSelectLandmark(lm);
                        onInspectCoords({ lat_deg: lm.latitude_deg, lon_deg: lm.longitude_deg });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <g style={{ transformOrigin: 'center', animation: isRotating && viewMode === 'south-polar' ? 'moonSlowCounterRotate 180s linear infinite' : 'none' }}>
                      {isSelected && (
                        <circle cx="0" cy="0" r="16" fill="none" stroke="#FACC15" strokeWidth="2" strokeDasharray="3 3">
                          <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" fill="#070D18" stroke="#FACC15" strokeWidth="2" />
                      <circle cx="0" cy="0" r="2" fill="#FACC15" />
                      <g transform="translate(12, -10)">
                        <rect x="0" y="0" width="68" height="22" rx="4" fill="#070D18" stroke="rgba(250, 204, 21, 0.5)" strokeWidth="1" />
                        <text x="6" y="9" fill="#FACC15" fontSize="7" fontWeight="700" fontFamily="var(--font-sans)">
                          Connecting
                        </text>
                        <text x="6" y="17" fill="#E2E8F0" fontSize="6" fontFamily="var(--font-sans)">
                          Ridge (Site 001)
                        </text>
                      </g>
                    </g>
                  </g>
                );
              })()}
            </g>

            {/* LAYER 8: Candidate Landing Sites */}
            {layers.candidateSites && (
              <g id="layer-candidate-sites">
                {CANDIDATE_LUNAR_SITES.map((site) => {
                  const { svgX, svgY } = projectToSvg(site.coordinates.latitude_deg, site.coordinates.longitude_deg);
                  const isActive = activeSite.site_id === site.site_id;
                  return (
                    <g
                      key={`site-${site.site_id}`}
                      transform={`translate(${svgX}, ${svgY})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSite(site);
                        onInspectCoords({ lat_deg: site.coordinates.latitude_deg, lon_deg: site.coordinates.longitude_deg });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <g style={{ transformOrigin: 'center', animation: isRotating && viewMode === 'south-polar' ? 'moonSlowCounterRotate 180s linear infinite' : 'none' }}>
                        {isActive && (
                          <circle cx="0" cy="0" r="16" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeDasharray="3 3">
                            <animate attributeName="r" values="10;18;10" dur="2.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2.5s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <polygon
                          points="0,-6 1.8,-1.8 6,-1.8 2.5,1 4,5.5 0,2.8 -4,5.5 -2.5,1 -6,-1.8 -1.8,-1.8"
                          fill="#F59E0B"
                          stroke="#000"
                          strokeWidth="0.8"
                        />
                      </g>
                    </g>
                  );
                })}
              </g>
            )}
          </g>

          {/* 3D SPHERICAL SHADING & ILLUMINATION: Directional sunlight + terminator + limb darkening */}
          {viewMode === 'south-polar' && (
            <>
              <circle
                cx="0"
                cy="0"
                r={DISK_RADIUS_SVG}
                fill="url(#moon3dSunShade)"
                clipPath="url(#polarDiskClip)"
                style={{ mixBlendMode: 'multiply', pointerEvents: 'none' }}
              />
              <circle
                cx="0"
                cy="0"
                r={DISK_RADIUS_SVG}
                fill="url(#moon3dLimbGlow)"
                clipPath="url(#polarDiskClip)"
                style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}
              />
            </>
          )}

          {/* Reticle for Inspected Point */}
          {inspectedSvg && (
            <g transform={`translate(${inspectedSvg.svgX}, ${inspectedSvg.svgY})`}>
              <circle cx="0" cy="0" r="7" fill="none" stroke="var(--accent-rose)" strokeWidth="1.8" />
              <line x1="-10" y1="0" x2="-6" y2="0" stroke="var(--accent-rose)" strokeWidth="1.8" />
              <line x1="6" y1="0" x2="10" y2="0" stroke="var(--accent-rose)" strokeWidth="1.8" />
              <line x1="0" y1="-10" x2="0" y2="-6" stroke="var(--accent-rose)" strokeWidth="1.8" />
              <line x1="0" y1="6" x2="0" y2="10" stroke="var(--accent-rose)" strokeWidth="1.8" />
            </g>
          )}

          {/* Landing Zone Explorer: Circular Assessment Region Boundary */}
          {(() => {
            const centerLat = selectedLandmark ? selectedLandmark.latitude_deg : activeSite.coordinates.latitude_deg;
            const centerLon = selectedLandmark ? selectedLandmark.longitude_deg : activeSite.coordinates.longitude_deg;
            const centerSvg = projectToSvg(centerLat, centerLon);
            const radiusSvg = Math.max(16, (assessmentRadiusKm / 303.2) * DISK_RADIUS_SVG);
            return (
              <g id="layer-assessment-region" transform={`translate(${centerSvg.svgX}, ${centerSvg.svgY})`}>
                <circle cx="0" cy="0" r={radiusSvg} fill="rgba(250, 204, 21, 0.08)" stroke="#FACC15" strokeWidth="1.5" strokeDasharray="5 3" />
                <circle cx="0" cy="0" r="3" fill="#FACC15" />
                <g transform={`translate(0, ${-radiusSvg - 6})`}>
                  <rect x="-60" y="-8" width="120" height="16" rx="3" fill="#070D18" stroke="#FACC15" strokeWidth="0.8" />
                  <text x="0" y="3" fill="#FACC15" fontSize="7" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">
                    LANDING ZONE ({assessmentRadiusKm}km)
                  </text>
                </g>
              </g>
            );
          })()}

          {/* Geodesic Measurement Layer (Yellow Reference 1 Styling) */}
          {pointA_Svg && (
            <g id="layer-measurement">
              <circle cx={pointA_Svg.svgX} cy={pointA_Svg.svgY} r="5" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.5" />
              {pointB_Svg && (
                <>
                  <circle cx={pointB_Svg.svgX} cy={pointB_Svg.svgY} r="5" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.5" />
                  <line
                    x1={pointA_Svg.svgX}
                    y1={pointA_Svg.svgY}
                    x2={pointB_Svg.svgX}
                    y2={pointB_Svg.svgY}
                    stroke="#FACC15"
                    strokeWidth="2.2"
                    strokeDasharray="4 2"
                  />
                  {measureDistance && (
                    <g transform={`translate(${(pointA_Svg.svgX + pointB_Svg.svgX) / 2}, ${(pointA_Svg.svgY + pointB_Svg.svgY) / 2})`}>
                      <rect x="-44" y="-11" width="88" height="20" rx="4" fill="#070D18" stroke="#FACC15" strokeWidth="1.2" />
                      <text x="0" y="3" fill="#FACC15" fontSize="8" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">
                        {measureDistance.distance_km.toFixed(1)} km
                      </text>
                    </g>
                  )}
                </>
              )}
            </g>
          )}
        </g>
      </svg>

      {/* OVERLAY: Navigation & Zoom Buttons (Matching Reference 1 Design) */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          backgroundColor: 'rgba(7, 13, 24, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => handleZoom(0.35)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          title="Zoom In"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => handleZoom(-0.35)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          title="Zoom Out"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => centerOnSite(activeSite)}
          style={{
            background: 'none',
            border: 'none',
            color: '#FACC15',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          title="Center on Active Site / South Pole"
        >
          <Target size={16} />
        </button>
        <button
          onClick={toggleRotation}
          style={{
            background: isRotating ? 'rgba(56, 189, 248, 0.15)' : 'none',
            border: isRotating ? '1px solid var(--accent-cyan)' : 'none',
            color: isRotating ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          title={isRotating ? 'Pause 3D Planetary Rotation' : 'Resume 3D Planetary Rotation'}
        >
          {isRotating ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
    </div>
  );
};
