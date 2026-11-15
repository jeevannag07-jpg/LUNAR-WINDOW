import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  Layers,
  Camera,
  Compass,
  Play,
  Pause,
  Sun,
  Shield,
  Activity,
  MapPin,
} from 'lucide-react';
import type { AtlasViewMode } from './AtlasViewport';
import type { AtlasLayerConfig } from './AtlasLayerControl';

interface AtlasLeftCatalogueProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  viewMode: AtlasViewMode;
  onSelectViewMode: (mode: AtlasViewMode) => void;
  layers: AtlasLayerConfig;
  onToggleLayer: (layerKey: keyof AtlasLayerConfig) => void;
  onSetLayerOpacity: (layerKey: keyof AtlasLayerConfig, opacity: number) => void;
  isRotating: boolean;
  onToggleRotation: () => void;
  activeRegion: 'south-pole' | 'global' | 'north-pole' | 'equator' | 'surface';
  onSelectRegion: (region: 'south-pole' | 'global' | 'north-pole' | 'equator' | 'surface') => void;
}

export const AtlasLeftCatalogue: React.FC<AtlasLeftCatalogueProps> = ({
  isOpen,
  onToggleOpen,
  viewMode,
  onSelectViewMode,
  layers,
  onToggleLayer,
  onSetLayerOpacity,
  isRotating,
  onToggleRotation,
  activeRegion,
  onSelectRegion,
}) => {
  const [selectedObsFilter, setSelectedObsFilter] = useState<'ALL' | 'LROC' | 'LOLA'>('ALL');

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        style={{
          position: 'absolute',
          top: '52px',
          left: '12px',
          zIndex: 30,
          backgroundColor: 'rgba(7, 13, 24, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '4px',
          padding: '8px 10px',
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}
        title="Open Mission Data Catalogue"
      >
        <Layers size={13} color="var(--accent-cyan)" />
        <span>DATA CATALOGUE</span>
        <ChevronRight size={14} />
      </button>
    );
  }

  return (
    <aside
      style={{
        position: 'absolute',
        top: '52px',
        left: '16px',
        bottom: '44px',
        width: '280px',
        backgroundColor: 'rgba(7, 13, 24, 0.94)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '6px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={14} color="var(--accent-cyan)" />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--text-primary)',
            }}
          >
            MISSION DATA CATALOGUE
          </span>
        </div>
        <button
          onClick={onToggleOpen}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Collapse Panel"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* SECTION 1: Camera & Region Selector */}
        <div>
          <div
            style={{
              fontSize: '0.66rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Camera size={11} color="var(--accent-cyan)" />
            <span>CAMERA &amp; REGION SELECTION</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { id: 'south-pole', label: 'South Pole (80°S-90°S)', mode: 'south-polar' },
              { id: 'global', label: 'Global 3D Sphere', mode: 'global-moon' },
              { id: 'surface', label: 'Surface Close-Up', mode: 'south-polar' },
              { id: 'north-pole', label: 'North Pole (80°N)', mode: 'global-moon' },
            ].map((reg) => {
              const isSelected = activeRegion === reg.id;
              return (
                <button
                  key={reg.id}
                  onClick={() => {
                    onSelectRegion(reg.id as any);
                    onSelectViewMode(reg.mode as AtlasViewMode);
                  }}
                  style={{
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ color: isSelected ? '#FACC15' : 'inherit' }}>{reg.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: Available Imagery Datasets */}
        <div>
          <div
            style={{
              fontSize: '0.66rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Eye size={11} color="var(--accent-cyan)" />
            <span>AVAILABLE IMAGERY DATASETS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* LROC WAC Base */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    LROC WAC Polar Nadir Mosaic
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    NASA LRO • 100 m/px • Optical Albedo
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={layers.baseImagery}
                  onChange={() => onToggleLayer('baseImagery')}
                  style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* High-Contrast LROC Targeting */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    LROC NAC Sub-Meter Targeting
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    ASU / NASA • 0.5-2 m/px • Close-up Rims
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.58rem',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent-emerald)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                  }}
                >
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Available Terrain Datasets */}
        <div>
          <div
            style={{
              fontSize: '0.66rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sliders size={11} color="var(--accent-cyan)" />
            <span>AVAILABLE TERRAIN DATASETS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* LOLA Elevation Topography */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    LOLA False-Color Elevation
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    NASA SVS 5127 • Topography
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={layers.elevation}
                  onChange={() => onToggleLayer('elevation')}
                  style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                />
              </div>
              {layers.elevation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    Opacity:
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={layers.elevationOpacity}
                    onChange={(e) => onSetLayerOpacity('elevationOpacity', parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent-cyan)', height: '3px' }}
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(layers.elevationOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Slope Gradient Relief */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Slope Gradient Relief
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    Derived Landing Hazard Gradient
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={layers.slopeMap}
                  onChange={() => onToggleLayer('slopeMap')}
                  style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Solar Illumination Exposure */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Solar Illumination Exposure
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    Grazing Sunlight Simulation
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={layers.illumination}
                  onChange={() => onToggleLayer('illumination')}
                  style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Scientific Display Options (Yellow Overlays) */}
        <div>
          <div
            style={{
              fontSize: '0.66rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Compass size={11} color="var(--accent-cyan)" />
            <span>DISPLAY &amp; OVERLAY OPTIONS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Yellow Crater Boundaries */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FACC15' }} />
                <span>Yellow Crater Boundaries</span>
              </div>
              <input
                type="checkbox"
                checked={layers.craterBoundaries}
                onChange={() => onToggleLayer('craterBoundaries')}
                style={{ accentColor: '#FACC15', cursor: 'pointer' }}
              />
            </label>

            {/* Yellow Landmark Markers */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={11} color="#FACC15" />
                <span>Landmark Reticle Markers</span>
              </div>
              <input
                type="checkbox"
                checked={true}
                readOnly
                style={{ accentColor: '#FACC15', cursor: 'pointer' }}
              />
            </label>

            {/* Coordinate Graticule Grid */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', border: '1px solid var(--accent-cyan)' }} />
                <span>Coordinate Grid &amp; Meridians</span>
              </div>
              <input
                type="checkbox"
                checked={layers.graticule}
                onChange={() => onToggleLayer('graticule')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
            </label>

            {/* Candidate Landing Sites */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#F59E0B', fontSize: '0.75rem' }}>★</span>
                <span>Candidate Landing Sites</span>
              </div>
              <input
                type="checkbox"
                checked={layers.candidateSites}
                onChange={() => onToggleLayer('candidateSites')}
                style={{ accentColor: '#F59E0B', cursor: 'pointer' }}
              />
            </label>

            {/* 3D Planetary Slow Motion Rotation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '4px',
                marginTop: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                <Activity size={11} color="var(--accent-cyan)" />
                <span>3D Slow Motion Rotation</span>
              </div>
              <button
                onClick={onToggleRotation}
                style={{
                  background: isRotating ? 'rgba(56, 189, 248, 0.15)' : 'none',
                  border: isRotating ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.1)',
                  color: isRotating ? 'var(--accent-cyan)' : 'var(--text-dim)',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '0.62rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {isRotating ? <Pause size={10} /> : <Play size={10} />}
                <span>{isRotating ? 'ACTIVE' : 'PAUSED'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 5: Observation Catalogue Swaths */}
        <div>
          <div
            style={{
              fontSize: '0.66rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>OBSERVATION CATALOGUE</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['ALL', 'LROC', 'LOLA'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedObsFilter(filter)}
                  style={{
                    background: selectedObsFilter === filter ? 'rgba(56, 189, 248, 0.25)' : 'none',
                    border: 'none',
                    color: selectedObsFilter === filter ? 'var(--accent-cyan)' : 'var(--text-dim)',
                    fontSize: '0.58rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    padding: '1px 4px',
                    borderRadius: '2px',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.64rem', fontFamily: 'var(--font-mono)' }}>
            {[
              { id: 'NAC_M119827392_80S', inst: 'LROC', type: 'High-Res Strip', res: '0.8 m' },
              { id: 'LOLA_GDR_POLE_44S', inst: 'LOLA', type: 'Altimeter Track', res: '100 m' },
              { id: 'NAC_M130981774_90S', inst: 'LROC', type: 'Polar Pass', res: '1.2 m' },
            ].map((obs) => {
              if (selectedObsFilter !== 'ALL' && obs.inst !== selectedObsFilter) return null;
              return (
                <div
                  key={obs.id}
                  style={{
                    padding: '5px 8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    borderLeft: '2px solid #FACC15',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{obs.id}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.58rem' }}>{obs.type}</div>
                  </div>
                  <div style={{ color: 'var(--accent-cyan)' }}>{obs.res}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
