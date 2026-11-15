import React from 'react';
import { Layers, ChevronUp, ChevronDown, ShieldAlert, Sparkles, Star } from 'lucide-react';

export interface AtlasLayerConfig {
  baseImagery: boolean;
  baseOpacity: number;
  elevation: boolean;
  elevationOpacity: number;
  craterBoundaries: boolean;
  candidateSites: boolean;
  slopeMap: boolean;
  illumination: boolean;
  graticule: boolean;
}

interface AtlasLayerControlProps {
  layers: AtlasLayerConfig;
  onChangeLayers: (layers: AtlasLayerConfig) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const AtlasLayerControl: React.FC<AtlasLayerControlProps> = ({
  layers,
  onChangeLayers,
  isOpen,
  onToggleOpen,
}) => {
  const toggle = (key: keyof Omit<AtlasLayerConfig, 'baseOpacity' | 'elevationOpacity'>) => {
    onChangeLayers({
      ...layers,
      [key]: !layers[key],
    });
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div
        onClick={onToggleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          backgroundColor: 'rgba(56, 189, 248, 0.05)',
          borderBottom: isOpen ? '1px solid var(--border-card)' : 'none',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          LAYER CONTROLS
        </span>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: 0 }}
        >
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {isOpen && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Layer 1: Base Imagery (LRO) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={layers.baseImagery}
                onChange={() => toggle('baseImagery')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Base Imagery (LRO)
              </span>
            </label>
            <img
              src="/assets/basemaps/icon_layer_base.png"
              alt="LRO Basemap"
              style={{ width: '20px', height: '20px', borderRadius: '3px', border: '1px solid var(--border-subtle)' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Layer 2: Elevation (LOLA) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={layers.elevation}
                onChange={() => toggle('elevation')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Elevation (LOLA)
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>High</span>
              <img
                src="/assets/basemaps/icon_layer_elevation.png"
                alt="LOLA Elevation"
                style={{ width: '20px', height: '20px', borderRadius: '3px', border: '1px solid var(--border-subtle)' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Low</span>
            </div>
          </div>

          {/* Layer 3: Crater Boundaries */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={layers.craterBoundaries}
                onChange={() => toggle('craterBoundaries')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Crater Boundaries
              </span>
            </label>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>IAU Rims</span>
          </div>

          {/* Layer 4: Candidate Sites */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={layers.candidateSites}
                onChange={() => toggle('candidateSites')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Candidate Sites
              </span>
            </label>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
          </div>

          {/* Layer 5: Slope Map */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={layers.slopeMap}
                onChange={() => toggle('slopeMap')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Slope Map
              </span>
            </label>
            <img
              src="/assets/basemaps/icon_layer_slope.png"
              alt="Slope Map"
              style={{ width: '20px', height: '20px', borderRadius: '3px', border: '1px solid var(--border-subtle)' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Layer 6: Illumination (Sunlight) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={layers.illumination}
                onChange={() => toggle('illumination')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Illumination (Sunlight)
              </span>
            </label>
            <img
              src="/assets/basemaps/icon_layer_sunlight.png"
              alt="Sunlight Map"
              style={{ width: '20px', height: '20px', borderRadius: '3px', border: '1px solid var(--border-subtle)' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Coordinate Graticule Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={layers.graticule}
                onChange={() => toggle('graticule')}
                style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Grid &amp; Coordinate Axes
              </span>
            </label>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>0°/90°/180°</span>
          </div>

          {/* Provenance Disclosure */}
          <div
            style={{
              padding: '6px 8px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.65rem',
              color: 'var(--accent-amber)',
              lineHeight: 1.3,
            }}
          >
            <strong>DATA PROVENANCE:</strong> Base imagery uses verified NASA LROC WAC/NAC South Polar mosaics. LOLA elevation overlay uses SVS 5127. Live trajectory queries utilize verified <code>SPHERICAL_DATUM_ONLY</code> fallback until the 1.85 GB binary DEM is mounted.
          </div>
        </div>
      )}
    </div>
  );
};
