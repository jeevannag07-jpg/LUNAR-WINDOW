import React from 'react';
import { FileText, Printer, Download, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { LunarSite } from '../types/api';
import { ScientificCallout } from '../components/common/ScientificCallout';

interface ReportsProps {
  activeSite: LunarSite;
}

export const Reports: React.FC<ReportsProps> = ({ activeSite }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Scientific Mission Evaluation Report
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Certified Scientific Disclosure, Provenance Audit & Operational Decision Document
          </div>
        </div>

        <button
          onClick={() => window.print()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          <Printer size={15} />
          Print / Export PDF
        </button>
      </div>

      {/* Printable Report Document Container */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          boxShadow: 'var(--shadow-card)',
          lineHeight: 1.6,
        }}
      >
        {/* Document Header */}
        <div style={{ borderBottom: '2px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em' }}>
                LUNAR WINDOW SCIENCE DOCUMENTATION &bull; STAGE 6B
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                Site Visibility Evaluation & Scientific Disclosure
              </h1>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Target Site: <strong style={{ color: 'var(--text-primary)' }}>{activeSite.name}</strong> ({activeSite.region})
              </div>
            </div>

            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              <div>Document ID: LW-SR-20261115</div>
              <div>Datum: IAU MOON_ME</div>
              <div>Status: STAGE 6B AUDIT CERTIFIED</div>
            </div>
          </div>
        </div>

        {/* Section 1: Executive Geodetic Profile */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            1. Site Geodetic Position & Topocentric Datum
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            The evaluation target is situated at selenographic latitude <code>{activeSite.coordinates.latitude_deg.toFixed(4)}°</code> and longitude <code>{activeSite.coordinates.longitude_deg.toFixed(4)}°</code> in the IAU standard Mean Earth / Polar Axis (<code>MOON_ME</code>) right-handed Cartesian frame, with elevation <code>{activeSite.coordinates.elevation_m} m</code> above the reference lunar datum sphere (R0 = 1,737,400.0 m).
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 8px' }}>PARAMETER</th>
                <th style={{ padding: '6px 8px' }}>AUTHORITATIVE VALUE</th>
                <th style={{ padding: '6px 8px' }}>PROVENANCE & METADATA</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--text-secondary)' }}>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '6px 8px' }}>Reference Sphere Datum (R0)</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>1,737,400.000 m</td>
                <td style={{ padding: '6px 8px' }}>NASA PDS LOLA DSMAP_POLAR.CAT</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '6px 8px' }}>Polar Stereographic Resolution</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>20.0 m/pixel</td>
                <td style={{ padding: '6px 8px' }}>PDS Label: LDEM_80S_20M.LBL</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '6px 8px' }}>Raster Array Storage Matrix</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>30,400 &times; 30,400 cells</td>
                <td style={{ padding: '6px 8px' }}>16-bit signed integer DEM</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>Declared Geographic Boundary</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>&phi; &le; -80.0°S (&rho; &le; 304,005.6 m)</td>
                <td style={{ padding: '6px 8px' }}>Certified LOLA Observation Footprint</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Mandatory Scientific Disclosure */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            2. Mandatory Scientific Disclosure & Provenance Registry
          </h3>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              &bull; <strong>Ephemeris Provider:</strong> NAIF SPICE DE440 planetary ephemeris (<code>de440.bsp</code>) and official leapseconds kernel (<code>naif0012.tls</code>).
            </div>
            <div>
              &bull; <strong>Lunar Orientation Model:</strong> High-precision sub-milliradian binary PCK (<code>moon_pa_de440_200628.bpc</code>), transformed to the IAU MOON_ME frame.
            </div>
            <div>
              &bull; <strong>Terrain Elevation Model:</strong> Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) <code>LDEM_80S_20M</code> product.
            </div>
            <div>
              &bull; <strong>Reconstruction Model:</strong> Piecewise-constant cell model (<code>PIECEWISE_CONSTANT_CELL</code>).
            </div>
          </div>
        </div>

        {/* Section 3: Assumptions & Physical Limitations */}
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            3. Documented Assumptions & Physical Constraints
          </h3>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>
              1. <strong>Sub-Pixel Micro-Topography:</strong> Clearance declared under <code>DEM_MODEL_CLEAR</code> guarantees line-of-sight clearance against the 20 m discrete DEM model only. Unresolved micro-craters, boulders, and regolith roughness smaller than 20 m are not modeled.
            </div>
            <div>
              2. <strong>RF Line-of-Sight vs Communication:</strong> Geometric visibility to Earth does not guarantee an active RF communication link. Link margin, antenna gain, multi-path reflections, and DSN ground station scheduling are outside this kinematic line-of-sight scope.
            </div>
            <div>
              3. <strong>Apparent Solar Disk:</strong> Solar visibility accounts for finite solar angular diameter (~0.533°), tracking center-of-disk and upper-limb grazing conditions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
