import React from 'react';
import { Database, FileCheck, ExternalLink, HardDrive, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ScientificCallout } from '../components/common/ScientificCallout';

export const DataSources: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Data Sources, Ephemeris Kernels & Provenance Registry
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Authoritative Provenance Audit: NASA JPL Horizons, NAIF SPICE & PDS LOLA Datasets
        </div>
      </div>

      <ScientificCallout type="verified" title="STRICT DATA PROVENANCE MANDATE">
        In strict adherence to LUNAR WINDOW core quality guidelines, zero synthetic data is presented as real lunar observations, and zero DEM metadata or NoData values are fabricated. All datasets maintain explicit cryptographic and bibliographic provenance.
      </ScientificCallout>

      {/* SPICE Kernels Registry Table */}
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
              NASA NAIF SPICE Planetary & Orientation Kernels
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Transactionally loaded and verified under <code>SPICE_LOCK</code> in the backend
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 600 }}>
            SHA-256 VERIFIED
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px' }}>KERNEL FILE</th>
              <th style={{ padding: '8px' }}>TYPE</th>
              <th style={{ padding: '8px' }}>PURPOSE & ACCURACY</th>
              <th style={{ padding: '8px' }}>SOURCE</th>
            </tr>
          </thead>
          <tbody style={{ color: 'var(--text-secondary)' }}>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '8px', color: 'var(--accent-cyan)' }}>naif0012.tls</td>
              <td style={{ padding: '8px' }}>LSK (Leapseconds)</td>
              <td style={{ padding: '8px' }}>UTC to TDB/ET epoch conversion (37 leap seconds)</td>
              <td style={{ padding: '8px' }}>NAIF Generic Kernels</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '8px', color: 'var(--accent-cyan)' }}>de440.bsp</td>
              <td style={{ padding: '8px' }}>SPK (Ephemeris)</td>
              <td style={{ padding: '8px' }}>JPL DE440 high-precision planetary and lunar positions</td>
              <td style={{ padding: '8px' }}>NASA JPL Planetary Ephemeris</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '8px', color: 'var(--accent-cyan)' }}>moon_pa_de440_200628.bpc</td>
              <td style={{ padding: '8px' }}>Binary PCK</td>
              <td style={{ padding: '8px' }}>Sub-milliradian DE440 lunar mantle orientation (MOON_PA)</td>
              <td style={{ padding: '8px' }}>NAIF LRO Mission Kernels</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', color: 'var(--accent-cyan)' }}>pck00010.tpc</td>
              <td style={{ padding: '8px' }}>Text PCK</td>
              <td style={{ padding: '8px' }}>IAU triaxial reference dimensions and planetary constants</td>
              <td style={{ padding: '8px' }}>IAU/IAG Working Group</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PDS LOLA DEM Metadata Table */}
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
              NASA PDS LOLA South Polar Digital Elevation Model
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Product: <code>LDEM_80S_20M.IMG</code> with label <code>LDEM_80S_20M.LBL</code>
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            20 m / Pixel Resolution
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginBottom: '4px' }}>PROJECTION SPECIFICATION</div>
            Projection: Polar Stereographic<br />
            Reference Radius (A_AXIS): 1,737,400.0 m<br />
            Center Latitude: -90.0°S<br />
            Center Longitude: 0.0°E
          </div>

          <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginBottom: '4px' }}>RASTER ARRAY DIMENSIONS</div>
            Rows: 30,400 pixels<br />
            Columns: 30,400 pixels<br />
            Sample Type: LSB_INTEGER (16-bit)<br />
            Scaling: Elevation [m] = Value &times; 0.5 m
          </div>

          <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginBottom: '4px' }}>COVERAGE & SENTINEL POLICY</div>
            Declared Lat Range: [-90.0°, -80.0°]<br />
            Offset: 15,199.5 px (0-based)<br />
            NoData Sentinel: None documented in label<br />
            Null Policy: Parameterized caller override
          </div>
        </div>
      </div>
    </div>
  );
};
