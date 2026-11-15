import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  sublabel,
  badge,
  badgeColor = 'var(--accent-cyan)',
  icon: Icon,
  accentColor = 'var(--accent-cyan)',
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        position: 'relative',
        boxShadow: 'var(--shadow-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {Icon && <Icon size={18} color={accentColor} />}
        {badge && (
          <span
            style={{
              fontSize: '0.62rem',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              color: badgeColor,
              border: `1px solid ${badgeColor}33`,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {unit}
          </span>
        )}
      </div>

      {sublabel && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};
