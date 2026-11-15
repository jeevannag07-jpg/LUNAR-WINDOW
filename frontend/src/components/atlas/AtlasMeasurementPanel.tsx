import React, { useState } from 'react';
import { Ruler, Square, Crosshair, Mountain } from 'lucide-react';
import type { GeodesicResult } from '../../utils/polarProjection';

export type MeasurementType = 'distance' | 'area' | 'coords' | 'elevation';

interface AtlasMeasurementPanelProps {
  measurementType: MeasurementType;
  onChangeType: (type: MeasurementType) => void;
  measureDistance: GeodesicResult | null;
  pointA: { lat_deg: number; lon_deg: number } | null;
  pointB: { lat_deg: number; lon_deg: number } | null;
  onClear: () => void;
}

export const AtlasMeasurementPanel: React.FC<AtlasMeasurementPanelProps> = ({
  measurementType,
  onChangeType,
  measureDistance,
  pointA,
  pointB,
  onClear,
}) => {
  const displayDistance = measureDistance ? measureDistance.distance_km.toFixed(1) : '47.6';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          MEASUREMENT TOOLS
        </span>
        {pointA && (
          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '0.65rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Tool Selector Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {[
          { id: 'distance', label: 'Distance', icon: Ruler },
          { id: 'area', label: 'Area', icon: Square },
          { id: 'coords', label: 'Coords', icon: Crosshair },
          { id: 'elevation', label: 'Elevation', icon: Mountain },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = measurementType === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChangeType(t.id as MeasurementType)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                backgroundColor: isActive ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-shell)',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Icon size={13} color={isActive ? 'var(--accent-cyan)' : 'currentColor'} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Instructions */}
      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center' }}>
        Click two points on the map to measure distance.
      </div>

      {/* Distance Display Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Distance:</span>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
          {displayDistance} km
        </span>
      </div>
    </div>
  );
};
