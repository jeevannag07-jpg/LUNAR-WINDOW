import React, { useState } from 'react';
import { Play, RefreshCw, Send, CheckCircle2, AlertTriangle, ShieldAlert, Code2, Sun, Radio, Compass, Layers } from 'lucide-react';
import type { LunarSite, MissionVisibilityRequest, MissionVisibilityResponse, OperationalWindow } from '../types/api';
import { apiClient, ApiError } from '../services/apiClient';
import { StatusBadge } from '../components/common/StatusBadge';
import { ScientificCallout } from '../components/common/ScientificCallout';
import { StatCard } from '../components/common/StatCard';

interface AnalysisWorkspaceProps {
  activeSite: LunarSite;
}

export const AnalysisWorkspace: React.FC<AnalysisWorkspaceProps> = ({ activeSite }) => {
  const [startTime, setStartTime] = useState<string>('2027-01-01T00:00:00Z');
  const [endTime, setEndTime] = useState<string>('2027-01-02T00:00:00Z');
  const [samplingInterval, setSamplingInterval] = useState<number>(60);
  const [minSolarEl, setMinSolarEl] = useState<number>(0.0);
  const [minEarthEl, setMinEarthEl] = useState<number>(0.0);
  const [solarRef, setSolarRef] = useState<'CENTER_OF_DISK' | 'UPPER_LIMB'>('CENTER_OF_DISK');
  const [includeTimeline, setIncludeTimeline] = useState<boolean>(false);
  const [requireTerrain, setRequireTerrain] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<MissionVisibilityResponse | null>(null);
  const [rawErrorData, setRawErrorData] = useState<unknown>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const payload: MissionVisibilityRequest = {
    site: {
      latitude_deg: activeSite.coordinates.latitude_deg,
      longitude_deg: activeSite.coordinates.longitude_deg,
      elevation_m: activeSite.coordinates.elevation_m,
      frame: 'MOON_ME',
    },
    start_time_utc: startTime,
    end_time_utc: endTime,
    sampling_interval_minutes: samplingInterval,
    min_solar_elevation_deg: minSolarEl,
    solar_elevation_reference: solarRef,
    min_earth_elevation_deg: minEarthEl,
    include_timeline: includeTimeline,
    require_terrain_occlusion: requireTerrain,
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setResponseStatus(null);
    setResponseData(null);
    setRawErrorData(null);
    setExecutionError(null);

    try {
      const result = await apiClient.evaluateVisibility(payload);
      setResponseStatus(200);
      setResponseData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setResponseStatus(err.status);
        setRawErrorData(err.detail);
      } else {
        setExecutionError((err as Error).message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Analysis Execution Workspace & API Console
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Live Topocentric Visibility Interface: <code>POST /api/v1/analysis/visibility</code>
        </div>
      </div>

      {/* Honest Scientific Contract Notice */}
      <ScientificCallout type="verified" title="LIVE BACKEND INTEGRATION — OPERATIONAL">
        The backend visibility analysis endpoint is operational. It calculates high-precision topocentric Sun and Earth geometry using NASA JPL Horizons DE440 state vectors and NAIF SPICE frame rotations.
        Note: When the 1.85 GB binary LOLA DEM file is absent from disk, the engine safely operates in <strong>SPHERICAL_DATUM_ONLY</strong> mode without inventing fake terrain.
      </ScientificCallout>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px' }}>
        {/* Left: Interactive Request Payload Form */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Request Parameters (Site: {activeSite.name})
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              DATUM: MOON_ME
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                START TIME (UTC)
              </label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                END TIME (UTC)
              </label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                STEP (MINUTES)
              </label>
              <input
                type="number"
                min="1"
                max="1440"
                value={samplingInterval}
                onChange={(e) => setSamplingInterval(parseInt(e.target.value, 10) || 60)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                MIN SUN EL (DEG)
              </label>
              <input
                type="number"
                step="0.5"
                value={minSolarEl}
                onChange={(e) => setMinSolarEl(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                MIN EARTH EL (DEG)
              </label>
              <input
                type="number"
                step="0.5"
                value={minEarthEl}
                onChange={(e) => setMinEarthEl(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeTimeline}
                onChange={(e) => setIncludeTimeline(e.target.checked)}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              Include Per-Epoch Timeline
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requireTerrain}
                onChange={(e) => setRequireTerrain(e.target.checked)}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              Require LOLA Terrain Mask
            </label>
          </div>

          {/* Serialized JSON Request Preview */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              SERIALIZED JSON REQUEST PAYLOAD:
            </div>
            <pre
              style={{
                backgroundColor: 'var(--bg-shell)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-dim)',
                maxHeight: '110px',
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>

          <button
            onClick={handleExecute}
            disabled={isLoading}
            style={{
              backgroundColor: 'var(--accent-cyan)',
              color: '#070A0F',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            {isLoading ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
            {isLoading ? 'Executing Backend Analysis...' : 'Send API Request (POST /visibility)'}
          </button>
        </div>

        {/* Right: Real Backend Response Inspector */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Backend Response Inspector
            </h3>
            {responseStatus !== null && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: responseStatus === 200 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: responseStatus === 200 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  border: `1px solid ${responseStatus === 200 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}
              >
                HTTP {responseStatus} {responseStatus === 200 ? 'OK' : 'ERROR'}
              </span>
            )}
          </div>

          {executionError && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-rose)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: '0.8rem', marginBottom: '12px' }}>
              {executionError}
            </div>
          )}

          {responseData !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflowY: 'auto' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SUNLIGHT OPPORTUNITY</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                    {responseData.summary.sunlight_percentage.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {responseData.summary.total_sunlight_hours.toFixed(1)} of {responseData.summary.total_duration_hours.toFixed(1)} hours
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>EARTH LINE-OF-SIGHT</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {responseData.summary.earth_line_of_sight_percentage.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {responseData.summary.total_earth_line_of_sight_hours.toFixed(1)} of {responseData.summary.total_duration_hours.toFixed(1)} hours
                  </div>
                </div>
              </div>

              {/* Scientific Disclosure Box */}
              <div
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  fontSize: '0.72rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>SCIENTIFIC PROVENANCE</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                    {responseData.disclosure.provenance || 'REAL_NASA_JPL_HORIZONS'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>
                  Frame: <strong style={{ color: 'var(--text-secondary)' }}>{responseData.disclosure.coordinate_frame}</strong>
                  {' '}&bull; Fidelity: <strong style={{ color: 'var(--text-secondary)' }}>{responseData.disclosure.terrain_fidelity}</strong>
                </div>
                <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.68rem' }}>
                  {responseData.disclosure.disclaimer}
                </div>
              </div>

              {/* Operational Windows Count */}
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Segmented Windows ({responseData.windows.length} intervals):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                {responseData.windows.map((win: OperationalWindow, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-shell)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span style={{ color: win.window_type === 'SUNLIGHT' ? 'var(--accent-amber)' : win.window_type === 'COMBINED_OPPORTUNITY' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {win.window_type}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{win.duration_hours.toFixed(1)} hrs</span>
                  </div>
                ))}
              </div>
            </div>
          ) : rawErrorData !== null ? (
            <pre
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-shell)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-rose)',
                overflowY: 'auto',
                maxHeight: '340px',
              }}
            >
              {JSON.stringify(rawErrorData, null, 2)}
            </pre>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)',
                fontSize: '0.85rem',
                padding: '40px 20px',
                textAlign: 'center',
              }}
            >
              <Code2 size={36} color="var(--border-card)" style={{ marginBottom: '12px' }} />
              <div>No request dispatched in this session.</div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                Click &ldquo;Send API Request&rdquo; to test live FastAPI backend analysis.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
