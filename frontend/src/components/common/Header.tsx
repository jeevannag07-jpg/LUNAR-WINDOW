import React, { useState, useEffect } from 'react';
import { Moon, Orbit, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import type { LunarSite } from '../../types/api';
import { CANDIDATE_LUNAR_SITES } from '../../data/candidateSites';

interface HeaderProps {
  activeSite: LunarSite;
  onSelectSite: (site: LunarSite) => void;
  onToggleSidebar?: () => void;
  backendStatus?: 'ready' | 'healthy' | 'offline' | 'checking';
}

export const Header: React.FC<HeaderProps> = ({
  activeSite,
  onSelectSite,
  backendStatus = 'ready',
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-shell)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Brand & Project Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--accent-cyan)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-cyan-glow)',
              border: '1px solid var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Moon size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.04em', lineHeight: 1.2 }}>
              LUNAR WINDOW
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              OBSERVATORY PLATFORM
            </div>
          </div>
        </div>

        <div
          style={{
            height: '24px',
            width: '1px',
            backgroundColor: 'var(--border-subtle)',
            margin: '0 4px',
          }}
        />

        {/* Site Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Site:
          </span>
          <select
            value={activeSite.site_id}
            onChange={(e) => {
              const selected = CANDIDATE_LUNAR_SITES.find((s) => s.site_id === e.target.value);
              if (selected) onSelectSite(selected);
            }}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 10px',
              fontSize: '0.82rem',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {CANDIDATE_LUNAR_SITES.map((site) => (
              <option key={site.site_id} value={site.site_id}>
                {site.name} ({site.coordinates.latitude_deg.toFixed(2)}°, {site.coordinates.longitude_deg.toFixed(2)}°)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center Status Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          padding: '4px 12px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.72rem',
          color: 'var(--accent-cyan)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <Orbit size={13} />
        <span>IAU MOON_ME &bull; R₀ = 1,737,400 m &bull; DE440 / LOLA</span>
      </div>

      {/* Right Controls: Clock & Service Health */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Authoritative Time Standard Display */}
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            {currentTime.toISOString().replace('T', ' ').substring(0, 19)} <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>UTC</span>
          </div>
          <div
            title="Ephemeris Time (ET / TDB) evaluated dynamically per epoch via NAIF SPICE LSK (naif0012.tls)"
            style={{ fontSize: '0.66rem', color: 'var(--text-dim)', letterSpacing: '0.02em' }}
          >
            NAIF SPICE LSK (naif0012.tls) &bull; TDB/ET Standard
          </div>
        </div>

        {/* Backend State Indicator */}
        <div
          title="Backend API Connectivity Status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {backendStatus === 'ready' && (
            <>
              <ShieldCheck size={14} color="var(--accent-emerald)" />
              <span style={{ color: 'var(--accent-emerald)' }}>BACKEND ONLINE</span>
            </>
          )}
          {backendStatus === 'healthy' && (
            <>
              <ShieldCheck size={14} color="var(--accent-cyan)" />
              <span style={{ color: 'var(--accent-cyan)' }}>CORE ACTIVE</span>
            </>
          )}
          {backendStatus === 'checking' && (
            <>
              <RefreshCw size={14} className="spin" color="var(--accent-amber)" />
              <span style={{ color: 'var(--accent-amber)' }}>PROBING</span>
            </>
          )}
          {backendStatus === 'offline' && (
            <>
              <AlertCircle size={14} color="var(--accent-rose)" />
              <span style={{ color: 'var(--accent-rose)' }}>OFFLINE</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
