import React from 'react';
import { Check, Plus } from 'lucide-react';
import type { LunarSite } from '../../types/api';

interface AtlasTerrainInsightsProps {
  activeSite: LunarSite;
  onAddToMissionPlan?: () => void;
}

export const AtlasTerrainInsights: React.FC<AtlasTerrainInsightsProps> = ({
  activeSite,
  onAddToMissionPlan,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* CARD 1: Terrain Insights */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          TERRAIN INSIGHTS
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.72rem' }}>
          <div style={{ color: 'var(--text-dim)' }}>
            Surface Type: <strong style={{ color: 'var(--text-secondary)' }}>Highland Terrain</strong>
          </div>
          <div style={{ color: 'var(--text-dim)' }}>
            Slope: <strong style={{ color: 'var(--text-secondary)' }}>12.4°</strong>
          </div>
          <div style={{ color: 'var(--text-dim)' }}>
            Illumination: <strong style={{ color: 'var(--text-secondary)' }}>87.3%</strong>
          </div>
          <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Data Confidence:{' '}
            <strong style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              High <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)', display: 'inline-block' }} />
            </strong>
          </div>
        </div>

        {/* Mini Elevation Profile Graph */}
        <div style={{ marginTop: '4px', backgroundColor: 'var(--bg-shell)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '36px', position: 'relative' }}>
            {/* Ticks on left */}
            <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.55rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              <span>6 km</span>
              <span>3 km</span>
              <span>0 km</span>
            </div>

            {/* SVG Profile line */}
            <svg style={{ width: '100%', height: '100%', paddingLeft: '28px' }} viewBox="0 0 100 30" preserveAspectRatio="none">
              <path
                d="M 0,25 Q 25,20 40,15 T 70,8 T 100,20"
                fill="none"
                stroke="var(--accent-cyan)"
                strokeWidth="1.8"
              />
              <path
                d="M 0,25 Q 25,20 40,15 T 70,8 T 100,20 L 100,30 L 0,30 Z"
                fill="rgba(56, 189, 248, 0.1)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* CARD 2: Mission Opportunity */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Radial progress ring 92% */}
          <div style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="4" />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="var(--accent-emerald)"
                strokeWidth="4"
                strokeDasharray="125.6"
                strokeDashoffset="10.0"
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
              />
            </svg>
            <span style={{ position: 'absolute', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              92%
            </span>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              Excellent Site
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={11} color="var(--accent-emerald)" /> High Illumination
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={11} color="var(--accent-emerald)" /> Good Visibility
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={11} color="var(--accent-emerald)" /> Stable Terrain
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onAddToMissionPlan}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            color: 'var(--accent-cyan)',
            fontWeight: 600,
            fontSize: '0.72rem',
            cursor: 'pointer',
          }}
        >
          <span>Add to Mission Plan</span>
          <span>&rarr;</span>
        </button>
      </div>
    </div>
  );
};
