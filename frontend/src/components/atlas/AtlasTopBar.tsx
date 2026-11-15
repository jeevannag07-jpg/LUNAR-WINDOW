import React, { useState, useEffect } from 'react';
import { Globe, Search, Maximize2, Minimize2, CheckCircle2, AlertCircle, Compass } from 'lucide-react';
import type { LunarLandmark } from '../../data/lunarLandmarks';
import { LUNAR_SOUTH_POLAR_LANDMARKS } from '../../data/lunarLandmarks';
import type { LunarSite } from '../../types/api';

interface AtlasTopBarProps {
  activeSite: LunarSite;
  selectedLandmark: LunarLandmark | null;
  onSelectLandmark: (lm: LunarLandmark) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const AtlasTopBar: React.FC<AtlasTopBarProps> = ({
  activeSite,
  selectedLandmark,
  onSelectLandmark,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredLandmarks = LUNAR_SOUTH_POLAR_LANDMARKS.filter((lm) =>
    lm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header
      style={{
        height: '42px',
        backgroundColor: 'rgba(6, 11, 20, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 20,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Left: Identity & Search Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Globe size={13} color="var(--accent-cyan)" />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: 'var(--text-primary)',
            }}
          >
            LUNAR ATLAS
          </span>
          <span
            style={{
              fontSize: '0.6rem',
              fontFamily: 'var(--font-mono)',
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              color: '#FACC15',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: '2px',
              padding: '1px 5px',
              fontWeight: 700,
            }}
          >
            3D EXPLORATION
          </span>
        </div>

        {/* Vertical divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

        {/* Location Search / Quick Jump */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              padding: '3px 10px',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Search size={12} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 600, color: '#FACC15' }}>
              {selectedLandmark ? selectedLandmark.name : activeSite.name}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              ({(selectedLandmark ? selectedLandmark.latitude_deg : activeSite.coordinates.latitude_deg).toFixed(2)}°,{' '}
              {(selectedLandmark ? selectedLandmark.longitude_deg : activeSite.coordinates.longitude_deg).toFixed(2)}°)
            </span>
          </button>

          {/* Dropdown Menu */}
          {isSearchOpen && (
            <div
              style={{
                position: 'absolute',
                top: '32px',
                left: 0,
                width: '320px',
                maxHeight: '380px',
                backgroundColor: 'rgba(7, 13, 24, 0.98)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '6px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                zIndex: 50,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <input
                  type="text"
                  placeholder="Search 14 polar landmarks / craters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#FFF',
                    fontSize: '0.75rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ overflowY: 'auto', maxHeight: '320px' }}>
                {filteredLandmarks.map((lm) => {
                  const isCurrent = selectedLandmark?.id === lm.id;
                  return (
                    <div
                      key={lm.id}
                      onClick={() => {
                        onSelectLandmark(lm);
                        setIsSearchOpen(false);
                      }}
                      style={{
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isCurrent ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        borderLeft: isCurrent ? '3px solid #FACC15' : '3px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div>
                        <div style={{ color: isCurrent ? '#FACC15' : 'var(--text-primary)', fontWeight: 600 }}>
                          {lm.name}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {lm.type} {lm.diameter_km ? `• ⌀ ${lm.diameter_km} km` : ''} {lm.is_psr ? '• PSR' : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {lm.latitude_deg.toFixed(2)}°, {lm.longitude_deg.toFixed(2)}°
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Coordinates & Reference Frame Telemetry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Compass size={13} color="var(--accent-cyan)" />
          <span>
            COORD: <strong style={{ color: '#FACC15' }}>{selectedLandmark ? `${selectedLandmark.latitude_deg.toFixed(4)}°S, ${selectedLandmark.longitude_deg.toFixed(4)}°E` : `${activeSite.coordinates.latitude_deg.toFixed(4)}°S, ${activeSite.coordinates.longitude_deg.toFixed(4)}°E`}</strong>
          </span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span>FRAME: <strong style={{ color: 'var(--accent-cyan)' }}>IAU_MOON_ME</strong></span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span>R₀: <strong>1,737.4 km</strong></span>
        </div>
      </div>

      {/* Right: Datasets, UTC Clock & Fullscreen Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Dataset Provenance Pill */}
        <div
          style={{
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '3px',
            padding: '2px 8px',
            color: 'var(--accent-cyan)',
          }}
        >
          NASA LROC WAC/NAC • LOLA PDS
        </div>

        {/* UTC Clock */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {utcTime}
        </div>

        {/* Backend Online Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '3px',
            padding: '2px 7px',
            color: 'var(--accent-emerald)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-emerald)',
              boxShadow: '0 0 6px var(--accent-emerald)',
            }}
          />
          ONLINE
        </div>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={onToggleFullscreen}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </header>
  );
};
