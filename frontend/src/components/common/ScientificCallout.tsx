import React from 'react';
import { Info, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface ScientificCalloutProps {
  type?: 'note' | 'warning' | 'caution' | 'verified';
  title?: string;
  children: React.ReactNode;
}

export const ScientificCallout: React.FC<ScientificCalloutProps> = ({
  type = 'note',
  title,
  children,
}) => {
  let bg = 'rgba(56, 189, 248, 0.08)';
  let border = 'rgba(56, 189, 248, 0.3)';
  let color = 'var(--accent-cyan)';
  let Icon = Info;
  let defaultTitle = 'SCIENTIFIC NOTE & METHODOLOGY';

  switch (type) {
    case 'warning':
      bg = 'rgba(245, 158, 11, 0.08)';
      border = 'rgba(245, 158, 11, 0.3)';
      color = 'var(--accent-amber)';
      Icon = AlertTriangle;
      defaultTitle = 'UNRESOLVED / GEOMETRIC BOUNDARY WARNING';
      break;
    case 'caution':
      bg = 'rgba(244, 63, 94, 0.08)';
      border = 'rgba(244, 63, 94, 0.3)';
      color = 'var(--accent-rose)';
      Icon = AlertOctagon;
      defaultTitle = 'TERRAIN OCCULTATION & FLIGHT SAFETY NOTICE';
      break;
    case 'verified':
      bg = 'rgba(16, 185, 129, 0.08)';
      border = 'rgba(16, 185, 129, 0.3)';
      color = 'var(--accent-emerald)';
      Icon = CheckCircle2;
      defaultTitle = 'MATHEMATICALLY CLOSED & VERIFIED BENCHMARK';
      break;
    default:
      break;
  }

  return (
    <div
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        margin: '12px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color,
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          marginBottom: '6px',
        }}
      >
        <Icon size={16} />
        <span>{title || defaultTitle}</span>
      </div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
};
