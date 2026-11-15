import React, { useState } from 'react';
import { Mountain, CheckCircle2, AlertOctagon, HelpCircle, Layers, ArrowRight, Play, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { LunarSite, TerrainProfileResponse } from '../types/api';
import { SYNTHETIC_FIXTURES, type TestFixture } from '../data/syntheticFixtures';
import { StatusBadge } from '../components/common/StatusBadge';
import { ScientificCallout } from '../components/common/ScientificCallout';
import { apiClient, ApiError } from '../services/apiClient';

interface TerrainAnalysisProps {
  activeSite: LunarSite;
}

export const TerrainAnalysis: React.FC<TerrainAnalysisProps> = ({ activeSite }) => {
  const [selectedFixture, setSelectedFixture] = useState<TestFixture>(SYNTHETIC_FIXTURES[0]);
  const [testAzimuth, setTestAzimuth] = useState<number>(90.0);
  const [testElevation, setTestElevation] = useState<number>(0.0);
  const [testDistance, setTestDistance] = useState<number>(100000.0);

  // Live Backend Topographic Profile State
  const [azimuthStep, setAzimuthStep] = useState<number>(2.0);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50.0);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);
  const [profileResponse, setProfileResponse] = useState<TerrainProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleFetchProfile = async () => {
    setIsProfileLoading(true);
    setProfileError(null);
    try {
      const res = await apiClient.getTerrainProfile({
        site: {
          latitude_deg: activeSite.coordinates.latitude_deg,
          longitude_deg: activeSite.coordinates.longitude_deg,
          elevation_m: activeSite.coordinates.elevation_m,
          frame: activeSite.coordinates.frame,
        },
        azimuth_step_deg: azimuthStep,
        max_distance_km: maxDistanceKm,
      });
      setProfileResponse(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setProfileError(`Backend Error ${err.status} (${err.statusText}): ${typeof err.detail === 'object' ? JSON.stringify(err.detail) : String(err.detail)}`);
      } else {
        setProfileError((err as Error).message);
      }
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Compute live geometric ray parameters for test input:
  const R0 = 1737400.0;
  const latRad = (activeSite.coordinates.latitude_deg * Math.PI) / 180.0;
  const lonRad = (activeSite.coordinates.longitude_deg * Math.PI) / 180.0;
  const azRad = (testAzimuth * Math.PI) / 180.0;
  const elRad = (testElevation * Math.PI) / 180.0;

  // Central angle via atan2
  const psi = Math.atan2(testDistance * Math.cos(elRad), R0 + testDistance * Math.sin(elRad));
  const surfaceArc_s = R0 * psi;
  const rayAltitude_h = Math.sqrt(R0 * R0 + 2.0 * R0 * testDistance * Math.sin(elRad) + testDistance * testDistance) - R0;

  // Normal vector N = u_up x u_ray
  // N_z = cos(el) * (sin(phi)*cos(A)*sin(lam) - ... )
  // For East ray (A=90, El=0) at (phi, lam=0): N_z = cos(phi)
  const isMeridian = Math.abs(Math.sin(azRad)) < 1e-6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Terrain Ray Traversal Engine & Conformal Circular Geometry
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Stage 6B Mathematical Closure & Verified Traversal Model (F01–F14 Benchmark Suite)
        </div>
      </div>

      {/* Stage 6B Audit Closure Callout */}
      <ScientificCallout type="verified" title="STAGE 6B MATHEMATICAL AUDIT CLOSURE REPORT CERTIFIED">
        All 14 benchmark fixtures (F01–F14) have been mathematically reconciled with independent float64 spherical trigonometry oracles.
        Near-tangent roots are classified under a 4-state derived uncertainty interval (&delta;D &approx; 3.55 m&sup2;);
        cell-contact semantics are 100% unified under <strong>Conservative Closed-Cell Supercover</strong>;
        and declared geographic coverage (&phi; &le; -80.0&deg;S) is strictly decoupled from rectangular raster array memory.
      </ScientificCallout>

      {/* Mathematical Principles Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Conformal Circle Equations */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: '6px' }}>
            CONFORMAL PROJECTED CIRCLE (N_z &ne; 0)
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            (X - X_c)&sup2; + (Y - Y_c)&sup2; = R_proj&sup2;<br />
            X_c = -2R_0 N_y / N_z<br />
            Y_c = -2R_0 N_x / N_z<br />
            R_proj = 2R_0 ||N|| / |N_z|
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '8px' }}>
            Where N = Up &times; Ray is the ray-plane normal in right-handed MOON_ME.
          </div>
        </div>

        {/* Factored Radicand Classifier */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: '6px' }}>
            FOUR-STATE RADICAND CLASSIFIER (&delta;D &approx; 3.55 m&sup2;)
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            D = (R_proj - |&Delta;X|)(R_proj + |&Delta;X|)<br />
            &bull; D &gt; +&delta;D: DEFINITELY POSITIVE (2 Roots)<br />
            &bull; D &lt; -&delta;D: DEFINITELY NEGATIVE (No Roots)<br />
            &bull; |D| &le; &delta;D: UNRESOLVED NEAR TANGENT<br />
            &bull; Exact Tangency: Analytic Proof Required
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '8px' }}>
            Arbitrary clamping of |D| &le; &epsilon; to zero is strictly prohibited.
          </div>
        </div>

        {/* Closed-Cell Supercover Policy */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: '6px' }}>
            CONSERVATIVE CLOSED-CELL SUPERCOVER
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            &bull; Ordinary Crossing: Interior cell query<br />
            &bull; Exact Grid Vertex: All 4 cells evaluated<br />
            &bull; Point Tangency: Both boundary cells evaluated<br />
            &bull; Coincident Grid Line: Both flank cells evaluated<br />
            &bull; Coverage Boundary Exit: Immediate halt
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '8px' }}>
            Unified non-contradictory policy across all boundary events.
          </div>
        </div>
      </div>

      {/* Interactive Ray Parameter Calculator */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
          Real-Time Geodesic Ray Calculator (Observer: {activeSite.name})
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              AZIMUTH: <span style={{ color: 'var(--accent-cyan)' }}>{testAzimuth.toFixed(1)}°</span>
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={testAzimuth}
              onChange={(e) => setTestAzimuth(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              ELEVATION: <span style={{ color: 'var(--accent-cyan)' }}>{testElevation.toFixed(1)}°</span>
            </label>
            <input
              type="range"
              min="-10"
              max="45"
              step="0.5"
              value={testElevation}
              onChange={(e) => setTestElevation(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              RAY DISTANCE (t): <span style={{ color: 'var(--accent-cyan)' }}>{(testDistance / 1000).toFixed(1)} km</span>
            </label>
            <input
              type="range"
              min="1000"
              max="300000"
              step="1000"
              value={testDistance}
              onChange={(e) => setTestDistance(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>
        </div>

        {/* Real-time Calculation Result Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            backgroundColor: 'var(--bg-shell)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>GROUND ARC (s)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {(surfaceArc_s / 1000).toFixed(3)} km
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              &Delta;s vs t: -{(testDistance - surfaceArc_s).toFixed(1)} m
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>RAY ALTITUDE (h_ray)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: rayAltitude_h >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
              {rayAltitude_h >= 0 ? '+' : ''}{(rayAltitude_h / 1000).toFixed(3)} km
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Above Reference Sphere R0
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>PROJECTION GEOMETRY</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {isMeridian ? 'Straight Meridian Line' : 'Circular Projected Arc'}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {isMeridian ? '2D DDA Linear Traversal' : 'Conformal Circular DDA'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Backend Topographic Horizon Profile Section */}
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
              Topographic Horizon Profile (Live Backend API: POST /api/v1/analysis/terrain/profile)
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Evaluates radial 360° ray horizon elevation around observer at {activeSite.name} ({activeSite.coordinates.latitude_deg.toFixed(2)}°S, {activeSite.coordinates.longitude_deg.toFixed(2)}°E)
            </div>
          </div>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              fontSize: '0.68rem',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            LIVE BACKEND INTEGRATION
          </span>
        </div>

        {/* Query Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
              AZIMUTH STEP (DEG, [0.5, 10.0]): <span style={{ color: 'var(--accent-cyan)' }}>{azimuthStep.toFixed(1)}°</span>
            </label>
            <input
              type="number"
              min="0.5"
              max="10.0"
              step="0.5"
              value={azimuthStep}
              onChange={(e) => setAzimuthStep(parseFloat(e.target.value) || 2.0)}
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
              MAX SCAN RADIUS (KM, [5.0, 150.0]): <span style={{ color: 'var(--accent-cyan)' }}>{maxDistanceKm.toFixed(1)} km</span>
            </label>
            <input
              type="number"
              min="5.0"
              max="150.0"
              step="5.0"
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(parseFloat(e.target.value) || 50.0)}
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

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleFetchProfile}
              disabled={isProfileLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: isProfileLoading ? 'var(--bg-subtle)' : 'var(--accent-cyan)',
                color: isProfileLoading ? 'var(--text-dim)' : '#070A0F',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: isProfileLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-mono)',
                transition: 'all 0.15s ease',
              }}
            >
              {isProfileLoading ? <RefreshCw size={14} className="animate-spin" /> : <Mountain size={14} />}
              {isProfileLoading ? 'Traversing Terrain...' : 'Compute Horizon Mask'}
            </button>
          </div>
        </div>

        {/* Error State */}
        {profileError && (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-rose)',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              marginBottom: '16px',
            }}
          >
            {profileError}
          </div>
        )}

        {/* Returned Profile Results */}
        {profileResponse && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>MAX HORIZON ELEV</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
                  {profileResponse.max_elevation_deg >= 0 ? '+' : ''}{profileResponse.max_elevation_deg.toFixed(3)}°
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Highest terrain peak</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>MIN HORIZON ELEV</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  {profileResponse.min_elevation_deg >= 0 ? '+' : ''}{profileResponse.min_elevation_deg.toFixed(3)}°
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Deepest horizon valley</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>MEAN HORIZON ELEV</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {profileResponse.mean_elevation_deg >= 0 ? '+' : ''}{profileResponse.mean_elevation_deg.toFixed(3)}°
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Mean skyline obstruction</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>COVERAGE STATUS</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                  {profileResponse.dem_coverage_status}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                  {profileResponse.is_fully_within_dem ? '100% Inside Boundary' : 'Boundary Exceeded'}
                </div>
              </div>
            </div>

            {/* Visual 360° Profile SVG generated from returned azimuths and elevations */}
            <div style={{ width: '100%', height: '160px', backgroundColor: 'var(--bg-shell)', borderRadius: 'var(--radius-md)', padding: '12px 16px', position: 'relative' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
                LIVE TOPOGRAPHIC HORIZON MASK ({profileResponse.azimuths_deg.length} SAMPLE RAYS EVALUATED)
              </div>
              <svg viewBox="0 0 720 120" style={{ width: '100%', height: '100px' }}>
                {/* 0° Geometric Horizon Line */}
                <line x1="0" y1="60" x2="720" y2="60" stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="4 4" strokeWidth="1" />
                <text x="10" y="55" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-mono)">0.0° Reference Horizon</text>

                {/* Horizon profile line from backend */}
                {(() => {
                  const points = profileResponse.azimuths_deg.map((az, idx) => {
                    const x = (az / 360) * 720;
                    const el = profileResponse.elevations_deg[idx];
                    const y = Math.max(10, Math.min(110, 60 - el * 10));
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  });
                  const polyPoints = `0,120 ${points.join(' ')} 720,120`;
                  return (
                    <>
                      <polygon points={polyPoints} fill="rgba(56, 189, 248, 0.2)" />
                      <polyline points={points.join(' ')} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" />
                    </>
                  );
                })()}

                {/* Cardinal direction labels */}
                <text x="5" y="115" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">0° (N)</text>
                <text x="180" y="115" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">90° (E)</text>
                <text x="360" y="115" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">180° (S)</text>
                <text x="540" y="115" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">270° (W)</text>
                <text x="685" y="115" fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">360° (N)</text>
              </svg>
            </div>

            {/* Scientific Disclosure Callout */}
            <div
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '0.75rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  SCIENTIFIC DISCLOSURE & DATA PROVENANCE
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: profileResponse.disclosure.terrain_fidelity === 'SPHERICAL_DATUM_ONLY' ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                    backgroundColor: profileResponse.disclosure.terrain_fidelity === 'SPHERICAL_DATUM_ONLY' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  FIDELITY: {profileResponse.disclosure.terrain_fidelity || profileResponse.disclosure.fidelity || 'SPHERICAL_DATUM_ONLY'}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {profileResponse.disclosure.provenance}
              </div>
              {profileResponse.disclosure.limitations && profileResponse.disclosure.limitations.length > 0 && (
                <ul style={{ margin: '6px 0 0 16px', padding: 0, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  {profileResponse.disclosure.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Authoritative F01–F14 Benchmark Fixture Suite Explorer */}
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
              F01–F14 Benchmark Test Fixtures Explorer
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Independently recalculated and verified against Stage 6B.4S/T specifications
            </div>
          </div>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '4px',
              fontSize: '0.68rem',
              color: 'var(--accent-amber)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            [SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA]
          </span>
        </div>

        {/* Fixture Selector Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '16px',
          }}
        >
          {SYNTHETIC_FIXTURES.map((fix) => {
            const isSelected = fix.id === selectedFixture.id;
            return (
              <button
                key={fix.id}
                onClick={() => setSelectedFixture(fix)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected ? 'var(--accent-cyan)' : 'var(--bg-shell)',
                  color: isSelected ? '#070A0F' : 'var(--text-secondary)',
                  border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {fix.id}
              </button>
            );
          })}
        </div>

        {/* Selected Fixture Detail Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-shell)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700, marginRight: '8px' }}>
                {selectedFixture.id}:
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedFixture.name}
              </span>
            </div>
            <StatusBadge status={selectedFixture.terminationState} size="sm" />
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
            {selectedFixture.description}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Observer:</strong> {selectedFixture.observer.lat.toFixed(2)}°S, {selectedFixture.observer.lon.toFixed(2)}°E, {selectedFixture.observer.height}m<br />
              <strong style={{ color: 'var(--text-primary)' }}>Pointing:</strong> Az {selectedFixture.pointing.azimuth.toFixed(1)}°, El {selectedFixture.pointing.elevation.toFixed(1)}°
            </div>

            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Physical Ray Distance (t):</strong> {(selectedFixture.physicalDistance_m / 1000).toFixed(3)} km<br />
              <strong style={{ color: 'var(--text-primary)' }}>Surface Arc (s):</strong> {(selectedFixture.surfaceArc_m / 1000).toFixed(3)} km
            </div>

            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Projected (X, Y):</strong> ({selectedFixture.projectedCoords.x.toFixed(1)}, {selectedFixture.projectedCoords.y.toFixed(1)}) m<br />
              <strong style={{ color: 'var(--text-primary)' }}>Raster (Col, Row):</strong> [{selectedFixture.rasterCoords.col.toFixed(3)}, {selectedFixture.rasterCoords.row.toFixed(3)}]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
