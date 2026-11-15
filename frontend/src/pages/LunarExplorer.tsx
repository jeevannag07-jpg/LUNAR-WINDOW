import React, { useState } from 'react';
import { Compass, MapPin, Layers, CheckCircle2, AlertOctagon } from 'lucide-react';
import type { LunarSite } from '../types/api';
import { CANDIDATE_LUNAR_SITES } from '../data/candidateSites';
import { ScientificCallout } from '../components/common/ScientificCallout';

interface LunarExplorerProps {
  activeSite: LunarSite;
  onSelectSite: (site: LunarSite) => void;
}

export const LunarExplorer: React.FC<LunarExplorerProps> = ({
  activeSite,
  onSelectSite,
}) => {
  const [inputLat, setInputLat] = useState<number>(activeSite.coordinates.latitude_deg);
  const [inputLon, setInputLon] = useState<number>(activeSite.coordinates.longitude_deg);

  const R0 = 1737400.0;
  const colatitudeRad = (90.0 + inputLat) * (Math.PI / 180.0);
  const rho = 2.0 * R0 * Math.tan(colatitudeRad / 2.0);
  const lonRad = inputLon * (Math.PI / 180.0);
  const X_proj = rho * Math.sin(lonRad);
  const Y_proj = rho * Math.cos(lonRad);
  const col = 15199.5 + X_proj / 20.0;
  const row = 15199.5 - Y_proj / 20.0;

  const rhoMax = 304005.608; // -80 deg boundary
  const isInsideDeclaredCoverage = rho <= rhoMax && inputLat <= -80.0;
  const isInsideRasterStorage = col >= 0 && col < 30400 && row >= 0 && row < 30400;

  // Inverse projection test
  const denom = 4.0 * R0 * R0 + rho * rho;
  const X_ME = (4.0 * R0 * R0 * Y_proj) / denom;
  const Y_ME = (4.0 * R0 * R0 * X_proj) / denom;
  const Z_ME = (R0 * (rho * rho - 4.0 * R0 * R0)) / denom;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Lunar Polar Explorer & Coordinate Engine
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Authoritative South Polar Stereographic Projection (NASA PDS LDEM_80S_20M Standard)
        </div>
      </div>

      {/* Main Grid: Visual Map Viewport & Coordinate Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px' }}>
        {/* Left: Interactive Projection SVG Viewport */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontWeight: 600 }}>
              POLAR STEREOGRAPHIC DISK (φ &le; -80°S)
            </span>
            <span style={{ fontSize: '0.72rem', color: isInsideDeclaredCoverage ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {isInsideDeclaredCoverage ? 'COVERAGE CERTIFIED' : 'OUTSIDE COVERAGE'}
            </span>
          </div>

          <svg
            viewBox="-160 -160 320 320"
            style={{
              width: '100%',
              maxWidth: '340px',
              height: 'auto',
              backgroundColor: '#05080E',
              borderRadius: '50%',
              border: '2px solid var(--border-card)',
              boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.8)',
            }}
          >
            {/* Outer Storage Boundary Guide */}
            <circle cx="0" cy="0" r="150" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
            
            {/* -80°S Geographic Product Coverage Circle */}
            <circle cx="0" cy="0" r="140" fill="rgba(56, 189, 248, 0.03)" stroke="var(--accent-cyan)" strokeWidth="1.5" />
            <text x="0" y="-143" fill="var(--accent-cyan)" fontSize="7" textAnchor="middle" fontFamily="var(--font-mono)">
              -80°S Coverage Boundary (ρ = 304,006 m)
            </text>

            {/* -85°S Latitude Circle */}
            <circle cx="0" cy="0" r="70" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
            <text x="0" y="-72" fill="var(--text-dim)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">
              -85°S
            </text>

            {/* Meridians */}
            <line x1="0" y1="-140" x2="0" y2="140" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
            <line x1="-140" y1="0" x2="140" y2="0" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />

            {/* Meridian Labels */}
            <text x="0" y="148" fill="var(--text-dim)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">0°E (Prime Meridian)</text>
            <text x="0" y="-148" fill="var(--text-dim)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">180°E</text>
            <text x="148" y="2" fill="var(--text-dim)" fontSize="6" textAnchor="start" fontFamily="var(--font-mono)">90°E</text>
            <text x="-148" y="2" fill="var(--text-dim)" fontSize="6" textAnchor="end" fontFamily="var(--font-mono)">270°E / 90°W</text>

            {/* South Pole Center */}
            <circle cx="0" cy="0" r="2.5" fill="var(--accent-cyan)" />
            <text x="4" y="8" fill="var(--text-primary)" fontSize="6" fontWeight="bold" fontFamily="var(--font-mono)">
              South Pole (-90°S)
            </text>

            {/* Active Candidate Sites Pins */}
            {CANDIDATE_LUNAR_SITES.map((site) => {
              const sColat = (90.0 + site.coordinates.latitude_deg) * (Math.PI / 180.0);
              const sRho = 2.0 * R0 * Math.tan(sColat / 2.0);
              const sScale = (sRho / rhoMax) * 140.0;
              const sLon = site.coordinates.longitude_deg * (Math.PI / 180.0);
              const px = sScale * Math.sin(sLon);
              const py = -sScale * Math.cos(sLon); // SVG y inverted
              const isSelected = site.site_id === activeSite.site_id;

              return (
                <g key={site.site_id} onClick={() => onSelectSite(site)} style={{ cursor: 'pointer' }}>
                  <circle
                    cx={px}
                    cy={py}
                    r={isSelected ? 4.5 : 2.5}
                    fill={isSelected ? 'var(--accent-rose)' : 'var(--accent-amber)'}
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? 1.5 : 0.5}
                  />
                  {isSelected && (
                    <text x={px + 6} y={py + 3} fill="var(--accent-rose)" fontSize="7" fontWeight="bold" fontFamily="var(--font-ui)">
                      {site.name.split(' ')[0]}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Custom Input Pin if Different */}
            {(() => {
              const curScale = (rho / rhoMax) * 140.0;
              const curPx = curScale * Math.sin(lonRad);
              const curPy = -curScale * Math.cos(lonRad);
              return (
                <circle cx={curPx} cy={curPy} r={3} fill="none" stroke="var(--accent-emerald)" strokeWidth="1.5" />
              );
            })()}
          </svg>

          <div style={{ marginTop: '14px', fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.4 }}>
            Click any crater pin on the polar disk to load site context. Outer circle defines PDS product boundary (&phi; &le; -80.0&deg;S).
          </div>
        </div>

        {/* Right: Coordinate Calculator & Geodetic Transformation Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Coordinate Projection Inspector
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  LATITUDE (φ, [-90.0° to -80.0°])
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="-90.0"
                  max="-80.0"
                  value={inputLat}
                  onChange={(e) => setInputLat(parseFloat(e.target.value) || -90.0)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-shell)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  LONGITUDE (λ, [-180.0° to +180.0°])
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="-180.0"
                  max="180.0"
                  value={inputLon}
                  onChange={(e) => setInputLon(parseFloat(e.target.value) || 0.0)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-shell)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>
            </div>

            {/* Computed Results Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                backgroundColor: 'var(--bg-shell)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>POLAR DISTANCE (ρ)</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  {rho.toFixed(2)} m
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>PROJECTED X</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {X_proj.toFixed(2)} m
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>PROJECTED Y</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {Y_proj.toFixed(2)} m
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>RASTER PIXEL (COL, ROW)</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                  [{col.toFixed(2)}, {row.toFixed(2)}]
                </div>
              </div>
            </div>

            {/* Coverage Check Banners */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <div
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isInsideDeclaredCoverage ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  border: `1px solid ${isInsideDeclaredCoverage ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isInsideDeclaredCoverage ? (
                  <CheckCircle2 size={14} color="var(--accent-emerald)" />
                ) : (
                  <AlertOctagon size={14} color="var(--accent-rose)" />
                )}
                <span style={{ color: isInsideDeclaredCoverage ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  Declared LOLA Coverage: {isInsideDeclaredCoverage ? 'VALID (φ &le; -80°)' : 'EXCEEDED (φ > -80°)'}
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isInsideRasterStorage ? 'rgba(56, 189, 248, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  border: `1px solid ${isInsideRasterStorage ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={14} color={isInsideRasterStorage ? 'var(--accent-cyan)' : 'var(--accent-rose)'} />
                <span style={{ color: isInsideRasterStorage ? 'var(--accent-cyan)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  Storage Matrix: {isInsideRasterStorage ? 'INSIDE 30400² ARRAY' : 'OUTSIDE BOUNDS'}
                </span>
              </div>
            </div>
          </div>

          {/* Inverse Projection Consistency Check */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
              RECONCILED RIGHT-HANDED MOON_ME RECONSTRUCTION
            </div>
            <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              X_ME: <span style={{ color: 'var(--text-primary)' }}>{X_ME.toFixed(3)} m</span> &bull; Y_ME: <span style={{ color: 'var(--text-primary)' }}>{Y_ME.toFixed(3)} m</span> &bull; Z_ME: <span style={{ color: 'var(--text-primary)' }}>{Z_ME.toFixed(3)} m</span>
              <br />
              Radius Check: <span style={{ color: 'var(--accent-emerald)' }}>{Math.sqrt(X_ME*X_ME + Y_ME*Y_ME + Z_ME*Z_ME).toFixed(3)} m</span> (Target R0 = 1,737,400.000 m)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
