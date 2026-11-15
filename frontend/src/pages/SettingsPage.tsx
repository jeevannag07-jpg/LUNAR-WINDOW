import React, { useState } from 'react';
import { Settings as SettingsIcon, Server, ShieldCheck, RefreshCw, Database, Activity, CheckCircle2, AlertOctagon, Layers } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { ReadinessResponse } from '../types/api';
import { ScientificCallout } from '../components/common/ScientificCallout';

export const SettingsPage: React.FC = () => {
  const [apiUrl, setApiUrl] = useState<string>(apiClient.getBaseUrl() || 'http://localhost:8000');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [readinessData, setReadinessData] = useState<ReadinessResponse | null>(null);
  const [isReadyTesting, setIsReadyTesting] = useState<boolean>(false);
  const [readyError, setReadyError] = useState<string | null>(null);

  const handleApplyUrl = () => {
    apiClient.setBaseUrl(apiUrl);
    setTestResult(`BASE URL UPDATED: Client base URL set to '${apiUrl}'`);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      apiClient.setBaseUrl(apiUrl);
      const health = await apiClient.getHealth();
      setTestResult(`SUCCESS: Connected to ${health.project} (Status: ${health.status})`);
    } catch (err) {
      setTestResult(`ERROR: ${(err as Error).message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestReadiness = async () => {
    setIsReadyTesting(true);
    setReadyError(null);
    try {
      apiClient.setBaseUrl(apiUrl);
      const ready = await apiClient.getReady();
      setReadinessData(ready);
    } catch (err) {
      setReadyError(`Readiness probe failed: ${(err as Error).message}`);
      setReadinessData(null);
    } finally {
      setIsReadyTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          System Configuration & Preferences
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Backend API Connection Settings, SPICE Environment & Unit Conventions
        </div>
      </div>

      {/* Backend API Configuration */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '14px' }}>
          <Server size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Backend Service Connection (FastAPI)</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '700px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
              FASTAPI BACKEND BASE URL (Leave empty for Vite proxy or specify absolute host)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000"
                style={{
                  flex: 1,
                  minWidth: '220px',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                }}
              />
              <button
                onClick={handleApplyUrl}
                style={{
                  backgroundColor: 'var(--bg-shell)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                Apply URL
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--accent-cyan-glow)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: isTesting ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                Health Probe (/health)
              </button>
              <button
                onClick={handleTestReadiness}
                disabled={isReadyTesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--accent-emerald-glow)',
                  color: 'var(--accent-emerald)',
                  border: '1px solid var(--accent-emerald)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: isReadyTesting ? 'not-allowed' : 'pointer',
                }}
              >
                <Activity size={14} className={isReadyTesting ? 'animate-spin' : ''} />
                Readiness Probe (/ready)
              </button>
            </div>
            {testResult && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: testResult.startsWith('SUCCESS') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  border: `1px solid ${testResult.startsWith('SUCCESS') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  color: testResult.startsWith('SUCCESS') ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                }}
              >
                {testResult}
              </div>
            )}
            {readyError && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: 'var(--accent-rose)',
                }}
              >
                {readyError}
              </div>
            )}
          </div>

          {/* Sub-Services Inspection Grid */}
          {readinessData && (
            <div
              style={{
                marginTop: '12px',
                backgroundColor: 'var(--bg-shell)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                  LUNAR WINDOW BACKEND READY (v{readinessData.version || '0.1.0'})
                </span>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                  STATUS: {readinessData.status.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                {Object.entries(readinessData.service_status || readinessData.services || {}).map(([srv, st]) => (
                  <div
                    key={srv}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-card)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{srv.toUpperCase()}</span>
                    <span style={{ color: st === 'operational' || st === 'ready' || st === 'ok' ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontWeight: 600 }}>
                      {st.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geodetic Standard Reference Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
          Authoritative Geodetic Standards & Scientific Units in Effect
        </h3>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>&bull; <strong>Coordinate System:</strong> Mean Earth / Polar Axis (<code>MOON_ME</code>), right-handed orthonormal IAU convention.</div>
          <div>&bull; <strong>Reference Lunar Radius:</strong> R0 = 1,737,400.000 m (mean volumetric reference sphere).</div>
          <div>&bull; <strong>Time Standard:</strong> Coordinated Universal Time (UTC) normalized to Ephemeris Time (ET / TDB) via NAIF LSK (<code>naif0012.tls</code>).</div>
          <div>&bull; <strong>DEM Projection:</strong> Polar Stereographic, 20.0 m/pixel, centered at South Pole (-90.0&deg;S).</div>
          <div>&bull; <strong>Angular Units:</strong> Decimal degrees (&deg;) for topocentric azimuth and elevation.</div>
          <div>&bull; <strong>Linear Distance Units:</strong> Meters (m) for local terrain elevation and kilometers (km) for radial scan distances.</div>
        </div>
      </div>
    </div>
  );
};
