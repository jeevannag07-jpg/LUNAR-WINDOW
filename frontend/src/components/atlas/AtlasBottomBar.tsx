import React from 'react';
import { Ruler, Layers, Eye, Compass, Activity } from 'lucide-react';
import type { AtlasViewMode } from './AtlasViewport';

interface AtlasBottomBarProps {
  hoverCoords: { lat_deg: number; lon_deg: number; elev_km?: number } | null;
  measureDistanceKm: number | null;
  activeDatasetName: string;
  viewMode: AtlasViewMode;
  zoom: number;
}

export const AtlasBottomBar: React.FC<AtlasBottomBarProps> = ({
  hoverCoords,
  measureDistanceKm,
  activeDatasetName,
  viewMode,
  zoom,
}) => {
  const lat = hoverCoords?.lat_deg ?? -89.24;
  const lon = hoverCoords?.lon_deg ?? 138.0;
  const elev = hoverCoords?.elev_km !== undefined ? `+${hoverCoords.elev_km.toFixed(2)} km` : 'DATUM: 1,737.40 km (SPHERICAL)';

  const altitudeEstimateKm = Math.round(Math.max(25, 450 / zoom));

  return (
    <footer
      style={{
        height: '32px',
        backgroundColor: 'rgba(5, 9, 17, 0.96)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(56, 189, 248, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 20,
        position: 'relative',
        userSelect: 'none',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.68rem',
        color: 'var(--text-secondary)',
      }}
    >
      {/* Left: Real-Time Cursor Coordinates & Elevation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={12} color="var(--accent-cyan)" />
          <span>CURSOR:</span>
          <span style={{ color: '#FACC15', fontWeight: 700 }}>
            LAT: {lat >= 0 ? `+${lat.toFixed(4)}°` : `${lat.toFixed(4)}°`} &nbsp;
            LON: {lon >= 0 ? `+${lon.toFixed(4)}°` : `${lon.toFixed(4)}°`}
          </span>
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />

        <div>
          <span>ELEV: </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{elev}</span>
        </div>
      </div>

      {/* Center: Dynamic Metric Scale & Geodesic Distance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {measureDistanceKm !== null ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              borderRadius: '3px',
              padding: '1px 8px',
              color: '#FACC15',
              fontWeight: 700,
            }}
          >
            <Ruler size={11} color="#FACC15" />
            <span>MEASURED DISTANCE: {measureDistanceKm.toFixed(2)} km (Geodesic Arc)</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-dim)' }}>SCALE:</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderBottom: '2px solid var(--accent-cyan)',
                paddingBottom: '2px',
                width: '90px',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>0</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {Math.round(100 / zoom)} km
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Active Dataset, CRS & Camera Telemetry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>DATASET: </span>
          <span style={{ color: 'var(--accent-cyan)' }}>{activeDatasetName}</span>
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />

        <div>
          <span style={{ color: 'var(--text-dim)' }}>CRS: </span>
          <span style={{ color: 'var(--text-primary)' }}>IAU_MOON_ME</span>
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />

        <div style={{ color: 'var(--text-dim)' }}>
          CAM: <strong style={{ color: 'var(--text-primary)' }}>{viewMode === 'south-polar' ? 'POLAR NADIR' : 'GLOBAL 3D'}</strong> (ALT: {altitudeEstimateKm} km, ZOOM: {zoom.toFixed(1)}x)
        </div>
      </div>
    </footer>
  );
};
