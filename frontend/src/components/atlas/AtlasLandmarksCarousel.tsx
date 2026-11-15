import React from 'react';
import { ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import type { LunarLandmark } from '../../data/lunarLandmarks';
import { LUNAR_SOUTH_POLAR_LANDMARKS } from '../../data/lunarLandmarks';

interface AtlasLandmarksCarouselProps {
  selectedLandmark: LunarLandmark | null;
  onSelectLandmark: (landmark: LunarLandmark) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const AtlasLandmarksCarousel: React.FC<AtlasLandmarksCarouselProps> = ({
  selectedLandmark,
  onSelectLandmark,
  isOpen,
  onToggleOpen,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        onClick={onToggleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          KEY LUNAR LANDMARKS
        </span>
        <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          {LUNAR_SOUTH_POLAR_LANDMARKS.slice(0, 6).map((lm) => {
            const isSelected = selectedLandmark?.id === lm.id;
            const thumb = lm.thumbnail_url || '/assets/basemaps/thumb_shackleton.png';

            return (
              <div
                key={lm.id}
                onClick={() => onSelectLandmark(lm)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-shell)',
                  border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  minWidth: '190px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <img
                  src={thumb}
                  alt={lm.name}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                    backgroundColor: '#050811',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/basemaps/thumb_shackleton.png';
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {lm.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    ({lm.latitude_deg.toFixed(2)}°, {lm.longitude_deg.toFixed(2)}°)
                  </div>
                </div>

                <ChevronRight size={14} color="var(--text-dim)" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
