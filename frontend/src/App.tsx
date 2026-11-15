import React, { useState, useEffect } from 'react';
import './styles/theme.css';
import { Header } from './components/common/Header';
import { Sidebar, type PageId } from './components/common/Sidebar';
import { CANDIDATE_LUNAR_SITES } from './data/candidateSites';
import type { LunarSite } from './types/api';
import { apiClient } from './services/apiClient';

// Pages
import { MissionControl } from './pages/MissionControl';
import { LunarAtlas } from './pages/LunarAtlas';
import { LandingSiteIntelligence } from './pages/LandingSiteIntelligence';
import { LunarExplorer } from './pages/LunarExplorer';
import { SiteIntelligence } from './pages/SiteIntelligence';
import { SolarAnalysis } from './pages/SolarAnalysis';
import { EarthVisibility } from './pages/EarthVisibility';
import { TerrainAnalysis } from './pages/TerrainAnalysis';
import { MissionPlanner } from './pages/MissionPlanner';
import { AnalysisWorkspace } from './pages/AnalysisWorkspace';
import { Reports } from './pages/Reports';
import { DataSources } from './pages/DataSources';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>('mission-control');
  const [activeSite, setActiveSite] = useState<LunarSite>(CANDIDATE_LUNAR_SITES[0]);
  const [backendStatus, setBackendStatus] = useState<'ready' | 'healthy' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getReady()
      .then((res) => {
        if (isMounted) {
          setBackendStatus(res.status === 'ready' ? 'ready' : 'healthy');
        }
      })
      .catch(() => {
        // Fallback probe
        apiClient
          .getHealth()
          .then(() => {
            if (isMounted) setBackendStatus('healthy');
          })
          .catch(() => {
            if (isMounted) setBackendStatus('offline');
          });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const renderActivePage = () => {
    switch (activePage) {
      case 'mission-control':
        return <MissionControl activeSite={activeSite} onNavigate={(p) => setActivePage(p as PageId)} />;
      case 'lunar-atlas':
        return (
          <LunarAtlas
            activeSite={activeSite}
            onSelectSite={setActiveSite}
            onNavigateToWorkspace={() => setActivePage('landing-site-intelligence')}
          />
        );
      case 'landing-site-intelligence':
        return (
          <LandingSiteIntelligence
            activeSite={activeSite}
            onSelectSite={setActiveSite}
            onNavigateToAtlas={() => setActivePage('lunar-atlas')}
          />
        );
      case 'lunar-explorer':
        return <LunarExplorer activeSite={activeSite} onSelectSite={setActiveSite} />;
      case 'site-intelligence':
        return <SiteIntelligence activeSite={activeSite} onSelectSite={setActiveSite} />;
      case 'solar-analysis':
        return <SolarAnalysis activeSite={activeSite} />;
      case 'earth-visibility':
        return <EarthVisibility activeSite={activeSite} />;
      case 'terrain-analysis':
        return <TerrainAnalysis activeSite={activeSite} />;
      case 'mission-planner':
        return <MissionPlanner activeSite={activeSite} onNavigateToWorkspace={() => setActivePage('analysis-workspace')} />;
      case 'analysis-workspace':
        return <AnalysisWorkspace activeSite={activeSite} />;
      case 'reports':
        return <Reports activeSite={activeSite} />;
      case 'data-sources':
        return <DataSources />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <MissionControl activeSite={activeSite} onNavigate={(p) => setActivePage(p as PageId)} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-space)' }}>
      {/* Top Application Shell Bar */}
      <Header
        activeSite={activeSite}
        onSelectSite={setActiveSite}
        backendStatus={backendStatus}
      />

      {/* Main Body: Sidebar + Dynamic Page Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar activePage={activePage} onNavigate={setActivePage} />

        <main
          style={{
            flex: 1,
            overflowY: activePage === 'lunar-atlas' ? 'hidden' : 'auto',
            padding: activePage === 'lunar-atlas' ? '0' : '24px 32px 48px 32px',
            backgroundColor: 'var(--bg-space)',
          }}
        >
          <div style={{ maxWidth: activePage === 'lunar-atlas' ? '100%' : '1280px', margin: '0 auto', height: activePage === 'lunar-atlas' ? '100%' : 'auto' }}>
            {renderActivePage()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
