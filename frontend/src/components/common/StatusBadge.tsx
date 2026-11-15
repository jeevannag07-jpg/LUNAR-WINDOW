import React from 'react';
import type { TerrainVisibilityStatus } from '../../types/api';

interface StatusBadgeProps {
  status: TerrainVisibilityStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let bg = '#1E293B';
  let color = '#94A3B8';
  let border = '#334155';
  let label = status;

  switch (status) {
    case 'DEM_MODEL_CLEAR':
      bg = 'rgba(16, 185, 129, 0.15)';
      color = '#34D399';
      border = 'rgba(16, 185, 129, 0.3)';
      label = 'DEM MODEL CLEAR';
      break;
    case 'DEM_MODEL_OCCULTED':
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#F87171';
      border = 'rgba(239, 68, 68, 0.3)';
      label = 'DEM MODEL OCCULTED';
      break;
    case 'UNRESOLVED_NEAR_TANGENT':
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#FBBF24';
      border = 'rgba(245, 158, 11, 0.3)';
      label = 'UNRESOLVED (NEAR TANGENT)';
      break;
    case 'UNRESOLVED_COVERAGE':
    case 'PARTIAL_COVERAGE_EXIT_CELL':
      bg = 'rgba(129, 140, 248, 0.15)';
      color = '#A5B4FC';
      border = 'rgba(129, 140, 248, 0.3)';
      label = 'UNRESOLVED (PARTIAL COVERAGE)';
      break;
    case 'BOUNDARY_EXIT_GEOGRAPHIC':
      bg = 'rgba(56, 189, 248, 0.15)';
      color = '#38BDF8';
      border = 'rgba(56, 189, 248, 0.3)';
      label = 'BOUNDARY EXIT (GEOGRAPHIC)';
      break;
    case 'OUT_OF_COVERAGE':
      bg = 'rgba(100, 116, 139, 0.15)';
      color = '#94A3B8';
      border = 'rgba(100, 116, 139, 0.3)';
      label = 'OUT OF COVERAGE';
      break;
    case 'PENDING':
    case 'CALCULATING':
      bg = 'rgba(6, 182, 212, 0.15)';
      color = '#22D3EE';
      border = 'rgba(6, 182, 212, 0.3)';
      label = 'PENDING ANALYSIS';
      break;
    case 'NOT_IMPLEMENTED':
      bg = 'rgba(148, 163, 184, 0.15)';
      color = '#CBD5E1';
      border = 'rgba(148, 163, 184, 0.3)';
      label = 'STAGE CONTRACT STUB (501)';
      break;
    default:
      break;
  }

  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? '0.7rem' : size === 'lg' ? '0.85rem' : '0.75rem';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: '9999px',
        fontSize,
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
      {label}
    </span>
  );
};
