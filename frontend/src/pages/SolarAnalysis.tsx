import React, { useState } from 'react';
import { Sun, Clock, Orbit, Info, AlertTriangle, Play, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { LunarSite, MissionVisibilityResponse } from '../types/api';
import { StatCard } from '../components/common/StatCard';
import { ScientificCallout } from '../components/common/ScientificCallout';
import { apiClient, ApiError } from '../services/apiClient';

interface SolarAnalysisProps {
  activeSite: LunarSite;
}

export const SolarAnalysis: React.FC<SolarAnalysisProps> = ({ activeSite }) => {
  const [minElevation, setMinElevation] = useState<number>(0.0);
  const [elevationRef, setElevationRef] = useState<'CENTER_OF_DISK' | 'UPPER_LIMB'>('CENTER_OF_DISK');

  // Live Solar Visibility State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [solarResult, setSolarResult] = useState<MissionVisibilityResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRunSolarAnalysis = async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const res = await apiClient.evaluateVisibility({
        site: {
          latitude_deg: activeSite.coordinates.latitude_deg,
          longitude_deg: activeSite.coordinates.longitude_deg,
          elevation_m: activeSite.coordinates.elevation_m,
          frame: activeSite.coordinates.frame,
        },
        start_time_utc: '2027-01-01T00:00:00Z',
        end_time_utc: '2027-01-14T00:00:00Z',
        sampling_interval_minutes: 60,
        min_solar_elevation_deg: minElevation,
        solar_elevation_reference: elevationRef,
        min_earth_elevation_deg: 0.0,
        require_terrain_occlusion: false,
      });
      setSolarResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setRunError(`Backend Error ${err.status} (${err.statusText}): ${typeof err.detail === 'object' ? JSON.stringify(err.detail) : String(err.detail)}`);
      } else {
        setRunError((err as Error).message);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const sunRadiusDeg = 0.267; // Mean apparent solar radius viewed from Moon

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Solar Illumination Analysis & Horizon Grazing Geometry
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Topocentric Solar Dynamics & Apparent Solar Disk Disk Illumination Modeling
        </div>
      </div>

      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Solar Obliquity to Orbit"
          value="1.54°"
          sublabel="Lunar Equator to Ecliptic Angle"
          icon={Orbit}
          accentColor="var(--accent-amber)"
        />
        <StatCard
          label="Solar Disk Angular Radius"
          value={`~${sunRadiusDeg.toFixed(3)}°`}
          unit="(16.0 arcmin)"
          sublabel="Center to Upper Limb Offset"
          icon={Sun}
          accentColor="var(--accent-amber)"
        />
        <StatCard
          label="Mean Azimuth Rate"
          value="~0.549°"
          unit="/hour"
          sublabel="360° rotation in ~29.53 synodic days"
          icon={Clock}
          accentColor="var(--accent-cyan)"
        />
        <StatCard
          label="Active Site Solar Envelope"
          value="[-1.5°, +1.5°]"
          sublabel="High Latitude Grazing Limits"
          icon={Sun}
          accentColor="var(--accent-amber)"
        />
      </div>

      {/* Solar Disk Geometry Settings & Demonstration Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
          Solar Limb Geometry & Illumination Cutoff Configuration
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
              SOLAR ELEVATION REFERENCE
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['CENTER_OF_DISK', 'UPPER_LIMB'] as const).map((ref) => (
                <button
                  key={ref}
                  onClick={() => setElevationRef(ref)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: elevationRef === ref ? 'var(--accent-cyan-glow)' : 'var(--bg-shell)',
                    border: elevationRef === ref ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    color: elevationRef === ref ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {ref.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px', lineHeight: 1.4 }}>
              {elevationRef === 'CENTER_OF_DISK'
                ? 'Standard geometric definition: visibility declared when the exact center of the solar disk is above horizon.'
                : 'Upper limb definition: visibility declared as soon as the first ray from the top limb of the Sun clears the horizon (+0.267° advantage).'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
              MINIMUM ELEVATION CUTOFF: <span style={{ color: 'var(--accent-cyan)' }}>{minElevation.toFixed(1)}°</span>
            </label>
            <input
              type="range"
              min="-2.0"
              max="10.0"
              step="0.1"
              value={minElevation}
              onChange={(e) => setMinElevation(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              <span>-2.0° (Sub-horizon)</span>
              <span>0.0° (Horizon)</span>
              <span>+10.0° (High)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Synthetic 29.5-Day Diurnal Illumination Waveform */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Simulated Synodic Month Solar Elevation Curve (29.53 Days)
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              [SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Demonstrating polar grazing illumination cycles
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
            Site: {activeSite.name}
          </span>
        </div>

        <div style={{ width: '100%', height: '160px', backgroundColor: 'var(--bg-shell)', borderRadius: 'var(--radius-md)', padding: '10px 16px', position: 'relative' }}>
          <svg viewBox="0 0 720 140" style={{ width: '100%', height: '100%' }}>
            {/* 0° Horizon Line */}
            <line x1="0" y1="70" x2="720" y2="70" stroke="rgba(255, 255, 255, 0.25)" strokeDasharray="4 4" strokeWidth="1" />
            <text x="10" y="65" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">0.0° Geometric Horizon</text>

            {/* Threshold Line */}
            {(() => {
              const ty = 70 - minElevation * 20;
              return (
                <line x1="0" y1={ty} x2="720" y2={ty} stroke="var(--accent-rose)" strokeDasharray="2 2" strokeWidth="1" />
              );
            })()}

            {/* Solar Elevation Waveform */}
            <path
              d="M 0 70 Q 180 20, 360 70 T 720 70"
              fill="none"
              stroke="var(--accent-amber)"
              strokeWidth="2.5"
            />

            {/* Sunlight Area Fill above threshold */}
            <path
              d="M 0 70 Q 180 20, 360 70 Z"
              fill="rgba(245, 158, 11, 0.12)"
            />

            {/* Axis labels */}
            <text x="10" y="132" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">Day 0</text>
            <text x="180" y="132" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">Day 7.4 (First Quarter)</text>
            <text x="360" y="132" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">Day 14.8 (Full Moon / Peak)</text>
            <text x="540" y="132" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">Day 22.2 (Last Quarter)</text>
            <text x="670" y="132" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">Day 29.5</text>
          </svg>
        </div>

        <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
          Golden shaded area denotes contiguous sunlight windows exceeding the selected elevation threshold of {minElevation.toFixed(1)}°.
          At South Polar latitudes (&phi; &approx; -89.4°), solar elevation never exceeds ~1.5°, creating extreme horizontal shadows across local craters.
        </div>
      </div>

      {/* Live Backend Solar Run Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Live Backend Solar Illumination Run (POST /api/v1/analysis/visibility)
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Calculates 14-day high-precision solar visibility using active site ({activeSite.name}) and selected cutoff ({minElevation.toFixed(1)}°, {elevationRef})
            </div>
          </div>
          <button
            onClick={handleRunSolarAnalysis}
            disabled={isRunning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: isRunning ? 'var(--bg-subtle)' : 'var(--accent-amber)',
              color: isRunning ? 'var(--text-dim)' : '#070A0F',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.15s ease',
            }}
          >
            {isRunning ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? 'Calculating Ephemeris...' : 'Run 14-Day Solar Analysis'}
          </button>
        </div>

        {runError && (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-rose)',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              marginBottom: '14px',
            }}
          >
            {runError}
          </div>
        )}

        {solarResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SUNLIGHT PERCENTAGE</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
                  {solarResult.summary.sunlight_percentage.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                  Total: {solarResult.summary.total_sunlight_hours.toFixed(1)} hrs
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LONGEST SUNLIGHT STREAK</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                  {solarResult.summary.longest_continuous_sunlight_hours.toFixed(1)} hrs
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Unbroken illumination</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LONGEST DARKNESS STREAK</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-rose)' }}>
                  {solarResult.summary.longest_continuous_darkness_hours.toFixed(1)} hrs
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Battery survival requirement</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>IDENTIFIED WINDOWS</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  {solarResult.windows.filter((w) => w.window_type === 'SUNLIGHT').length}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Sunlight intervals</div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--accent-cyan)' }}>Scientific Disclosure: </strong>
              Ephemeris: {solarResult.disclosure.ephemeris_source || 'NASA JPL DE440'} &bull;
              Frame: {solarResult.disclosure.coordinate_frame || 'MOON_ME'} &bull;
              Fidelity: {solarResult.disclosure.terrain_fidelity || 'SPHERICAL_DATUM_ONLY'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
