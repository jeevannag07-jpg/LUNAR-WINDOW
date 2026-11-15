import React, { useState } from 'react';
import { CalendarDays, Clock, Play, AlertTriangle, ShieldCheck, Sun, Radio, Compass } from 'lucide-react';
import type { LunarSite } from '../types/api';
import { ScientificCallout } from '../components/common/ScientificCallout';
import { StatCard } from '../components/common/StatCard';

interface MissionPlannerProps {
  activeSite: LunarSite;
  onNavigateToWorkspace: () => void;
}

export const MissionPlanner: React.FC<MissionPlannerProps> = ({
  activeSite,
  onNavigateToWorkspace,
}) => {
  const [missionMode, setMissionMode] = useState<'STATIONARY_LANDER' | 'ROVER_SORTIE'>('STATIONARY_LANDER');
  const [startDate, setStartDate] = useState<string>('2027-01-01T00:00:00Z');
  const [endDate, setEndDate] = useState<string>('2027-01-14T00:00:00Z');
  const [samplingInterval, setSamplingInterval] = useState<number>(60);
  const [minSolarEl, setMinSolarEl] = useState<number>(0.0);
  const [minEarthEl, setMinEarthEl] = useState<number>(0.0);

  // Compute duration in days
  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  const durationDays = !isNaN(startMs) && !isNaN(endMs) ? Math.max(0, (endMs - startMs) / (1000 * 86400)) : 0;
  const isDurationValid = durationDays > 0 && durationDays <= 180;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Mission Timeline & Operational Window Planner
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Multi-Day Topocentric Visibility Window Synthesis & Exploration Constraints
        </div>
      </div>

      {/* Mode Selection */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setMissionMode('STATIONARY_LANDER')}
          style={{
            flex: 1,
            backgroundColor: missionMode === 'STATIONARY_LANDER' ? 'var(--accent-cyan-glow)' : 'var(--bg-card)',
            border: missionMode === 'STATIONARY_LANDER' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '4px' }}>
            <Compass size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Stationary Surface Lander Mode</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
            Evaluates continuous topocentric horizon visibility at fixed coordinate site ({activeSite.name}).
          </div>
        </button>

        <button
          onClick={() => setMissionMode('ROVER_SORTIE')}
          style={{
            flex: 1,
            backgroundColor: missionMode === 'ROVER_SORTIE' ? 'var(--accent-cyan-glow)' : 'var(--bg-card)',
            border: missionMode === 'ROVER_SORTIE' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '4px' }}>
            <CalendarDays size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Rover Traverse Sortie Mode</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
            Waypoint transit mode with dynamic solar illumination and terrain masking envelope along path.
          </div>
        </button>
      </div>

      {/* Mission Timing & Constraint Configuration Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Mission Epoch & Sampling Configuration
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              START TIME (UTC, ISO 8601)
            </label>
            <input
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-shell)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              END TIME (UTC, ISO 8601)
            </label>
            <input
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-shell)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              SAMPLING INTERVAL (MINUTES, [1, 1440])
            </label>
            <input
              type="number"
              min="1"
              max="1440"
              value={samplingInterval}
              onChange={(e) => setSamplingInterval(parseInt(e.target.value) || 60)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-shell)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
              }}
            />
          </div>
        </div>

        {/* Validation Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            backgroundColor: isDurationValid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: `1px solid ${isDurationValid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            borderRadius: 'var(--radius-md)',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ color: isDurationValid ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
            Requested Span: {durationDays.toFixed(2)} days (Max Allowed: 180.00 days)
          </div>
          <button
            onClick={onNavigateToWorkspace}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--accent-cyan)',
              color: '#070A0F',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <Play size={14} />
            Transfer to Execution Workspace
          </button>
        </div>
      </div>

      {/* Combined Opportunity Concept Explanation */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
          Operational Window Classification Standards
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-amber)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              <Sun size={15} /> SUNLIGHT WINDOW
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              Contiguous interval where topocentric solar disk elevation exceeds cutoff threshold (&ge; {minSolarEl.toFixed(1)}°).
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-indigo)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              <Radio size={15} /> EARTH LINE-OF-SIGHT
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              Contiguous interval where Earth center clears the local terrain horizon (&ge; {minEarthEl.toFixed(1)}°).
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              <ShieldCheck size={15} /> COMBINED OPPORTUNITY
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              Simultaneous Sunlight AND Earth Line-of-Sight. The gold standard for EVA and high-bandwidth surface ops.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
