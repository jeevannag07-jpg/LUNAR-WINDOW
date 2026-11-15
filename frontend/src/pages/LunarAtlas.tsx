import React, { useState, useCallback } from 'react';
import type { LunarSite } from '../types/api';
import { AtlasViewport, type AtlasViewMode } from '../components/atlas/AtlasViewport';
import { AtlasTopBar } from '../components/atlas/AtlasTopBar';
import { AtlasBottomBar } from '../components/atlas/AtlasBottomBar';
import { AtlasLeftCatalogue } from '../components/atlas/AtlasLeftCatalogue';
import { AtlasRightObservationPanel } from '../components/atlas/AtlasRightObservationPanel';
import type { AtlasLayerConfig } from '../components/atlas/AtlasLayerControl';
import { LUNAR_SOUTH_POLAR_LANDMARKS, type LunarLandmark } from '../data/lunarLandmarks';
import { calculateGreatCircleDistance } from '../utils/polarProjection';

interface LunarAtlasProps {
  activeSite: LunarSite;
  onSelectSite: (site: LunarSite) => void;
  onNavigateToWorkspace?: () => void;
}

export const LunarAtlas: React.FC<LunarAtlasProps> = ({
  activeSite,
  onSelectSite,
  onNavigateToWorkspace,
}) => {
  // Navigation & Region View Mode
  const [viewMode, setViewMode] = useState<AtlasViewMode>('south-polar');
  const [activeRegion, setActiveRegion] = useState<'south-pole' | 'global' | 'north-pole' | 'equator' | 'surface'>('south-pole');

  // Floating Panels Visibility
  const [isLeftCatalogueOpen, setIsLeftCatalogueOpen] = useState<boolean>(true);
  const [isRightObservationOpen, setIsRightObservationOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 3D Planetary Slow Motion Rotation state
  const [isRotating, setIsRotating] = useState<boolean>(true);

  // Layer Configuration
  const [layers, setLayers] = useState<AtlasLayerConfig>({
    baseImagery: true,
    baseOpacity: 1.0,
    elevation: false,
    elevationOpacity: 0.65,
    craterBoundaries: true,
    candidateSites: true,
    slopeMap: false,
    illumination: false,
    graticule: true,
  });

  // Selected Landmark (default to Shackleton Crater)
  const defaultLandmark =
    LUNAR_SOUTH_POLAR_LANDMARKS.find((lm) => lm.id === 'shackleton_crater') ||
    LUNAR_SOUTH_POLAR_LANDMARKS[0];
  const [selectedLandmark, setSelectedLandmark] = useState<LunarLandmark | null>(defaultLandmark);

  // Inspected Coordinates & Telemetry
  const [inspectedCoords, setInspectedCoords] = useState<{ lat_deg: number; lon_deg: number }>({
    lat_deg: defaultLandmark.latitude_deg,
    lon_deg: defaultLandmark.longitude_deg,
  });

  // Real-time hover cursor coordinates from viewport
  const [hoverCoords, setHoverCoords] = useState<{ lat_deg: number; lon_deg: number; elev_km?: number } | null>({
    lat_deg: defaultLandmark.latitude_deg,
    lon_deg: defaultLandmark.longitude_deg,
    elev_km: (defaultLandmark.elevation_m || 1250) / 1000,
  });

  // Viewport Zoom level
  const [currentZoom, setCurrentZoom] = useState<number>(1.0);

  // Measurement Points
  const [measurePointA, setMeasurePointA] = useState<{ lat_deg: number; lon_deg: number } | null>(null);
  const [measurePointB, setMeasurePointB] = useState<{ lat_deg: number; lon_deg: number } | null>(null);

  const measureDistance =
    measurePointA && measurePointB
      ? calculateGreatCircleDistance(
          measurePointA.lat_deg,
          measurePointA.lon_deg,
          measurePointB.lat_deg,
          measurePointB.lon_deg
        )
      : null;

  // Toggle Layer Helper
  const handleToggleLayer = useCallback((key: keyof AtlasLayerConfig) => {
    setLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleSetLayerOpacity = useCallback((key: keyof AtlasLayerConfig, opacity: number) => {
    setLayers((prev) => ({
      ...prev,
      [key]: opacity,
    }));
  }, []);

  // Select Landmark & trigger camera recenter
  const handleSelectLandmark = useCallback((lm: LunarLandmark | null) => {
    setSelectedLandmark(lm);
    if (lm) {
      setInspectedCoords({ lat_deg: lm.latitude_deg, lon_deg: lm.longitude_deg });
      window.dispatchEvent(new CustomEvent('lunar-atlas-center'));
      setIsRightObservationOpen(true);
    }
  }, []);

  // Region / Camera Mode Selector
  const handleSelectRegion = useCallback((region: 'south-pole' | 'global' | 'north-pole' | 'equator' | 'surface') => {
    setActiveRegion(region);
    if (region === 'global' || region === 'north-pole') {
      setViewMode('global-moon');
    } else {
      setViewMode('south-polar');
    }
    if (region === 'surface') {
      // High zoom into Shackleton
      window.dispatchEvent(new CustomEvent('lunar-atlas-zoom-in'));
      window.dispatchEvent(new CustomEvent('lunar-atlas-zoom-in'));
    }
  }, []);

  // Add to Mission Plan handler
  const handleAddToMissionPlan = useCallback(() => {
    if (selectedLandmark) {
      const site: LunarSite = {
        site_id: selectedLandmark.id,
        name: selectedLandmark.name,
        coordinates: {
          latitude_deg: selectedLandmark.latitude_deg,
          longitude_deg: selectedLandmark.longitude_deg,
          elevation_m: selectedLandmark.elevation_m || 1100.0,
          frame: 'MOON_ME',
        },
        description: selectedLandmark.description,
        region: 'South Polar Region',
      };
      onSelectSite(site);
    }
    if (onNavigateToWorkspace) {
      onNavigateToWorkspace();
    }
  }, [selectedLandmark, onSelectSite, onNavigateToWorkspace]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  return (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        width: '100%',
        height: isFullscreen ? '100vh' : 'calc(100vh - 84px)',
        minHeight: '620px',
        backgroundColor: '#02040A',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: isFullscreen ? 9999 : 1,
      }}
    >
      {/* 1. TOP TECHNICAL HEADER BAR (Reference 1 Design) */}
      <AtlasTopBar
        activeSite={activeSite}
        selectedLandmark={selectedLandmark}
        onSelectLandmark={handleSelectLandmark}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* 2. MAIN 3D LUNAR SURFACE VIEWPORT (Central Dominant Exploration Canvas) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
        <AtlasViewport
          toolMode="INSPECT"
          layers={layers}
          viewMode={viewMode}
          activeSite={activeSite}
          selectedLandmark={selectedLandmark}
          inspectedCoords={inspectedCoords}
          measurePointA={measurePointA}
          measurePointB={measurePointB}
          assessmentRadiusKm={10.0}
          onSelectLandmark={handleSelectLandmark}
          onInspectCoords={setInspectedCoords}
          onSetMeasurePointA={setMeasurePointA}
          onSetMeasurePointB={setMeasurePointB}
          onSelectSite={onSelectSite}
          isRotating={isRotating}
          onToggleRotation={() => setIsRotating((prev) => !prev)}
          onHoverCoordsChange={setHoverCoords}
          onZoomChange={setCurrentZoom}
        />

        {/* 3. FLOATING LEFT PANEL: MISSION DATA CATALOGUE (Reference 1 Design) */}
        <AtlasLeftCatalogue
          isOpen={isLeftCatalogueOpen}
          onToggleOpen={() => setIsLeftCatalogueOpen(!isLeftCatalogueOpen)}
          viewMode={viewMode}
          onSelectViewMode={setViewMode}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onSetLayerOpacity={handleSetLayerOpacity}
          isRotating={isRotating}
          onToggleRotation={() => setIsRotating((prev) => !prev)}
          activeRegion={activeRegion}
          onSelectRegion={handleSelectRegion}
        />

        {/* 4. FLOATING RIGHT PANEL: OBSERVATION & LOCATION DATA (Reference 1 Design) */}
        <AtlasRightObservationPanel
          isOpen={isRightObservationOpen}
          onToggleOpen={() => setIsRightObservationOpen(!isRightObservationOpen)}
          selectedLandmark={selectedLandmark}
          activeSite={activeSite}
          onAddToMissionPlan={handleAddToMissionPlan}
          onAnalyzeLandingRegion={handleAddToMissionPlan}
        />
      </div>

      {/* 5. BOTTOM TECHNICAL TELEMETRY & SCALE BAR (Reference 1 Design) */}
      <AtlasBottomBar
        hoverCoords={hoverCoords}
        measureDistanceKm={measureDistance ? measureDistance.distance_km : null}
        activeDatasetName={viewMode === 'south-polar' ? 'LROC WAC/NAC (Polar Nadir)' : 'NASA SVS 4720 (Global CGI)'}
        viewMode={viewMode}
        zoom={currentZoom}
      />
    </div>
  );
};
