import React from 'react';
import {
  LayoutDashboard,
  Map,
  Compass,
  Crosshair,
  Sun,
  Radio,
  Mountain,
  CalendarDays,
  SlidersHorizontal,
  FileText,
  Database,
  Settings as SettingsIcon,
} from 'lucide-react';

export type PageId =
  | 'mission-control'
  | 'lunar-atlas'
  | 'landing-site-intelligence'
  | 'lunar-explorer'
  | 'site-intelligence'
  | 'solar-analysis'
  | 'earth-visibility'
  | 'terrain-analysis'
  | 'mission-planner'
  | 'analysis-workspace'
  | 'reports'
  | 'data-sources'
  | 'settings';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  badge?: string;
  category: 'OPERATIONS' | 'SCIENTIFIC ANALYSIS' | 'SYSTEM & METADATA';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'mission-control', label: 'Mission Control', icon: LayoutDashboard, category: 'OPERATIONS' },
  { id: 'lunar-atlas', label: 'Lunar Atlas', icon: Map, badge: 'Flagship', category: 'OPERATIONS' },
  { id: 'landing-site-intelligence', label: 'Landing Site Intelligence', icon: Crosshair, badge: 'NEW', category: 'OPERATIONS' },
  { id: 'lunar-explorer', label: 'Lunar Explorer', icon: Compass, category: 'OPERATIONS' },
  { id: 'mission-planner', label: 'Mission Planner', icon: CalendarDays, category: 'OPERATIONS' },

  { id: 'site-intelligence', label: 'Site Intelligence', icon: Crosshair, category: 'SCIENTIFIC ANALYSIS' },
  { id: 'solar-analysis', label: 'Solar Analysis', icon: Sun, category: 'SCIENTIFIC ANALYSIS' },
  { id: 'earth-visibility', label: 'Earth Visibility', icon: Radio, category: 'SCIENTIFIC ANALYSIS' },
  { id: 'terrain-analysis', label: 'Terrain Analysis', icon: Mountain, badge: 'Stage 6B', category: 'SCIENTIFIC ANALYSIS' },
  { id: 'analysis-workspace', label: 'Analysis Workspace', icon: SlidersHorizontal, category: 'SCIENTIFIC ANALYSIS' },

  { id: 'reports', label: 'Scientific Reports', icon: FileText, category: 'SYSTEM & METADATA' },
  { id: 'data-sources', label: 'Data & Sources', icon: Database, badge: 'SPICE/PDS', category: 'SYSTEM & METADATA' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, category: 'SYSTEM & METADATA' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const categories: Array<NavItem['category']> = [
    'OPERATIONS',
    'SCIENTIFIC ANALYSIS',
    'SYSTEM & METADATA',
  ];

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: 'var(--bg-shell)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        overflowY: 'auto',
        padding: '16px 10px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {categories.map((category) => {
          const items = NAV_ITEMS.filter((item) => item.category === category);
          return (
            <div key={category}>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  padding: '4px 10px 8px 10px',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {category}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isActive ? 'var(--accent-cyan-glow)' : 'transparent',
                        color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        border: isActive ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.84rem',
                        fontWeight: isActive ? 600 : 400,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={17} color={isActive ? 'var(--accent-cyan)' : 'var(--text-dim)'} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            backgroundColor: isActive ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-surface)',
                            color: isActive ? 'var(--accent-cyan)' : 'var(--text-dim)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            padding: '10px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-card)',
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            LUNAR WINDOW 0.1.0
          </div>
          <div>Stage 6B Backend Foundation</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', marginTop: '4px', color: 'var(--accent-cyan)' }}>
            Branch: feature/backend-foundation
          </div>
        </div>
      </div>
    </aside>
  );
};
