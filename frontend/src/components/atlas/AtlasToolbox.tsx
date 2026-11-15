import React from 'react';
import { Crosshair, Ruler, Info, ZoomIn, ZoomOut, RotateCcw, Target } from 'lucide-react';

export type AtlasToolMode = 'INSPECT' | 'MEASURE' | 'LANDMARK';

interface AtlasToolboxProps {
  activeMode: AtlasToolMode;
  onChangeMode: (mode: AtlasToolMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onCenterActiveSite: () => void;
}

export const AtlasToolbox: React.FC<AtlasToolboxProps> = ({
  activeMode,
  onChangeMode,
  onZoomIn,
  onZoomOut,
  onResetView,
  onCenterActiveSite,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '6px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        zIndex: 20,
      }}
    >
      {/* Mode 1: Inspect */}
      <button
        onClick={() => onChangeMode('INSPECT')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid',
          borderColor: activeMode === 'INSPECT' ? 'var(--accent-cyan)' : 'transparent',
          backgroundColor: activeMode === 'INSPECT' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeMode === 'INSPECT' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          transition: 'all 0.15s ease',
        }}
        title="Inspector Mode: Click anywhere to inspect coordinates and Dem pixels"
      >
        <Crosshair size={14} />
        <span>INSPECT</span>
      </button>

      {/* Mode 2: Measure Geodesic */}
      <button
        onClick={() => onChangeMode('MEASURE')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid',
          borderColor: activeMode === 'MEASURE' ? 'var(--accent-cyan)' : 'transparent',
          backgroundColor: activeMode === 'MEASURE' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeMode === 'MEASURE' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          transition: 'all 0.15s ease',
        }}
        title="Geodesic Ruler: Click two points to measure surface distance and 3D chord"
      >
        <Ruler size={14} />
        <span>MEASURE</span>
      </button>

      {/* Mode 3: Landmark Dossier */}
      <button
        onClick={() => onChangeMode('LANDMARK')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid',
          borderColor: activeMode === 'LANDMARK' ? 'var(--accent-cyan)' : 'transparent',
          backgroundColor: activeMode === 'LANDMARK' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
          color: activeMode === 'LANDMARK' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          transition: 'all 0.15s ease',
        }}
        title="Landmark Dossier: Select impact craters and topographic features"
      >
        <Info size={14} />
        <span>LANDMARKS</span>
      </button>

      <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

      {/* View Navigation Buttons */}
      <button
        onClick={onZoomIn}
        style={{
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Zoom In"
      >
        <ZoomIn size={14} />
      </button>

      <button
        onClick={onZoomOut}
        style={{
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Zoom Out"
      >
        <ZoomOut size={14} />
      </button>

      <button
        onClick={onCenterActiveSite}
        style={{
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'transparent',
          color: 'var(--accent-emerald)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Center View on Active Site"
      >
        <Target size={14} />
      </button>

      <button
        onClick={onResetView}
        style={{
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'transparent',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Reset Polar Disk View"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
};
