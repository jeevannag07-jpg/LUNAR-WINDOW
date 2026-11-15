import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { LunarLandmark } from '../../data/lunarLandmarks';

interface AtlasLandmarkDossierProps {
  landmark: LunarLandmark;
  onViewDetails?: () => void;
}

export const AtlasLandmarkDossier: React.FC<AtlasLandmarkDossierProps> = ({
  landmark,
  onViewDetails,
}) => {
  const photoUrl = landmark.closeup_url || landmark.thumbnail_url || '/assets/basemaps/shackleton_crater_closeup.png';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {landmark.name}
          </h3>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Key Lunar Landmark
          </div>
        </div>
        <ExternalLink size={15} color="var(--accent-cyan)" style={{ cursor: 'pointer' }} />
      </div>

      {/* Photo and Coordinates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '12px', alignItems: 'center' }}>
        <img
          src={photoUrl}
          alt={landmark.name}
          style={{
            width: '70px',
            height: '70px',
            borderRadius: 'var(--radius-sm)',
            objectFit: 'cover',
            border: '1px solid var(--border-subtle)',
            backgroundColor: '#050811',
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/basemaps/shackleton_crater_closeup.png';
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Coordinates (MOON_ME)
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            Lat: {landmark.latitude_deg.toFixed(2)}°
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            Lon: {landmark.longitude_deg.toFixed(2)}°
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            Elev: {landmark.elevation_m ? `${(landmark.elevation_m / 1000).toFixed(1)} km` : landmark.depth_km ? `-${landmark.depth_km.toFixed(1)} km` : '4.8 km'}
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
          Description
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.35 }}>
          {landmark.description}
        </p>
      </div>

      {/* Data Source & Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          Data Source: <strong style={{ color: 'var(--text-secondary)' }}>LRO / LOLA</strong>
        </span>
        <button
          onClick={onViewDetails}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-cyan)',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          View Details &rarr;
        </button>
      </div>
    </div>
  );
};
