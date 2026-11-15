import React, { useState } from 'react';
import {
  Target,
  Navigation,
  Compass,
  Mountain,
  Sun,
  Radio,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Loader2,
  FileJson,
  Crosshair,
  Ruler,
} from 'lucide-react';
import type { LunarLandmark } from '../../data/lunarLandmarks';
import type { LunarSite } from '../../types/api';
import { apiClient } from '../../services/apiClient';
import {
  R_MOON_SPHERE_M,
  latLonToPolarStereo,
  polarStereoToPixel,
  isWithinDeclaredCoverage,
  isWithinRasterStorage,
  calculateGreatCircleDistance,
} from '../../utils/polarProjection';

interface AtlasInspectorPanelProps {
  inspectedCoords: { lat_deg: number; lon_deg: number };
  selectedLandmark: LunarLandmark | null;
  activeSite: LunarSite;
  measurePointA: { lat_deg: number; lon_deg: number } | null;
  measurePointB: { lat_deg: number; lon_deg: number } | null;
  onSelectSite: (site: LunarSite) => void;
  onClearLandmark: () => void;
}

export const AtlasInspectorPanel: React.FC<AtlasInspectorPanelProps> = ({
  inspectedCoords,
  selectedLandmark,
  activeSite,
  measurePointA,
  measurePointB,
  onSelectSite,
  onClearLandmark,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isProfiling, setIsProfiling] = useState<boolean>(false);
  const [profileResult, setProfileResult] = useState<{ count: number; minEl: number; maxEl: number; fidelity: string } | null>(null);
  const [isCheckingVis, setIsCheckingVis] = useState<boolean>(false);
  const [visResult, setVisResult] = useState<{ sunFraction: number; earthFraction: number; epochs: number } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Compute projection & pixel telemetry for current inspected coordinates
  const { x_m, y_m, rho_m } = latLonToPolarStereo(inspectedCoords.lat_deg, inspectedCoords.lon_deg);
  const pixel = polarStereoToPixel(x_m, y_m);
  const inCoverage = isWithinDeclaredCoverage(inspectedCoords.lat_deg);
  const inRaster = isWithinRasterStorage(pixel.col_0, pixel.row_0);

  // Check if current inspected coordinates match active site
  const isActiveSite =
    Math.abs(activeSite.coordinates.latitude_deg - inspectedCoords.lat_deg) < 0.001 &&
    Math.abs(activeSite.coordinates.longitude_deg - inspectedCoords.lon_deg) < 0.001;

  // Handle setting as active site
  const handleSetAsActiveSite = () => {
    const newSite: LunarSite = {
      site_id: selectedLandmark ? selectedLandmark.id : `inspected_${Math.abs(inspectedCoords.lat_deg).toFixed(2)}s_${Math.abs(inspectedCoords.lon_deg).toFixed(2)}e`,
      name: selectedLandmark ? selectedLandmark.name : `Site (${inspectedCoords.lat_deg.toFixed(2)}°S, ${inspectedCoords.lon_deg.toFixed(2)}°E)`,
      coordinates: {
        latitude_deg: parseFloat(inspectedCoords.lat_deg.toFixed(4)),
        longitude_deg: parseFloat(inspectedCoords.lon_deg.toFixed(4)),
        elevation_m: selectedLandmark?.elevation_m ?? 0.0,
        frame: 'MOON_ME',
      },
      description: selectedLandmark
        ? selectedLandmark.description
        : `Custom selected location at South Polar latitude ${inspectedCoords.lat_deg.toFixed(4)}°S.`,
      region: selectedLandmark ? 'South Pole Landmark' : 'South Polar Region',
    };
    onSelectSite(newSite);
  };

  // Run quick radial terrain profile
  const handleRunProfile = async () => {
    setIsProfiling(true);
    setAnalysisError(null);
    try {
      const res = await apiClient.getTerrainProfile({
        site: {
          latitude_deg: inspectedCoords.lat_deg,
          longitude_deg: inspectedCoords.lon_deg,
          elevation_m: 0.0,
          frame: 'MOON_ME',
        },
        azimuth_step_deg: 5.0,
        max_distance_km: 25.0,
      });

      setProfileResult({
        count: res.azimuths_deg.length,
        minEl: res.min_elevation_deg,
        maxEl: res.max_elevation_deg,
        fidelity: res.disclosure?.terrain_fidelity || 'SPHERICAL_DATUM_ONLY',
      });
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Terrain profile analysis failed.');
    } finally {
      setIsProfiling(false);
    }
  };

  // Run quick visibility probe
  const handleRunVisibility = async () => {
    setIsCheckingVis(true);
    setAnalysisError(null);
    try {
      const start = '2026-03-01T00:00:00Z';
      const stop = '2026-03-02T00:00:00Z';
      const res = await apiClient.evaluateVisibility({
        site: {
          latitude_deg: inspectedCoords.lat_deg,
          longitude_deg: inspectedCoords.lon_deg,
          elevation_m: 0.0,
          frame: 'MOON_ME',
        },
        start_time_utc: start,
        end_time_utc: stop,
        sampling_interval_minutes: 60,
      });

      setVisResult({
        sunFraction: res.summary.sunlight_percentage,
        earthFraction: res.summary.earth_line_of_sight_percentage,
        epochs: 25,
      });
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Visibility query failed.');
    } finally {
      setIsCheckingVis(false);
    }
  };

  // Copy telemetry findings as JSON
  const handleCopyFindings = () => {
    const findings = {
      timestamp: new Date().toISOString(),
      inspected_coordinates: {
        latitude_deg: inspectedCoords.lat_deg,
        longitude_deg: inspectedCoords.lon_deg,
        polar_radius_m: rho_m,
      },
      polar_stereographic_projection: {
        x_m,
        y_m,
        scale_m_per_px: 20.0,
      },
      dem_raster_coordinates: {
        continuous_col_0: pixel.col_0,
        continuous_row_0: pixel.row_0,
        fortran_sample_1: pixel.sample_1,
        fortran_line_1: pixel.line_1,
      },
      coverage_verification: {
        inside_geographic_boundary_80s: inCoverage,
        inside_raster_footprint: inRaster,
      },
      selected_landmark: selectedLandmark
        ? {
            id: selectedLandmark.id,
            name: selectedLandmark.name,
            diameter_km: selectedLandmark.diameter_km,
            is_psr: selectedLandmark.is_psr,
          }
        : null,
    };

    navigator.clipboard.writeText(JSON.stringify(findings, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Measure calculation
  const measureResult =
    measurePointA && measurePointB
      ? calculateGreatCircleDistance(
          measurePointA.lat_deg,
          measurePointA.lon_deg,
          measurePointB.lat_deg,
          measurePointB.lon_deg
        )
      : null;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '11px',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header with Title and Copy button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crosshair size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            COORDINATE & SCIENTIFIC INTELLIGENCE
          </h3>
        </div>
        <button
          onClick={handleCopyFindings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
          }}
          title="Copy Telemetry as JSON"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'COPIED' : 'EXPORT JSON'}</span>
        </button>
      </div>

      {/* Selected Landmark Dossier Card */}
      {selectedLandmark && (
        <div
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              {selectedLandmark.name}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {selectedLandmark.is_psr && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#818CF8',
                    fontWeight: 600,
                  }}
                >
                  PSR COLD TRAP
                </span>
              )}
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--accent-amber)',
                  fontWeight: 600,
                }}
              >
                {selectedLandmark.type}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            {selectedLandmark.description}
          </p>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.3 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Science: </strong>
            {selectedLandmark.scientific_significance}
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.3 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Exploration: </strong>
            {selectedLandmark.exploration_interest}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={onClearLandmark}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '0.68rem',
                textDecoration: 'underline',
              }}
            >
              Clear Landmark Selection
            </button>
          </div>
        </div>
      )}

      {/* Geodesic Measurement Card (if active) */}
      {measureResult && (
        <div
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Ruler size={15} color="#818CF8" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818CF8' }}>
              GEODESIC MEASUREMENT (HAVERSINE SPHERE)
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontFamily: 'var(--font-mono)' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>SURFACE ARC DISTANCE</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {measureResult.distance_km.toFixed(3)} km
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>3D CHORD LENGTH</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {measureResult.chord_km.toFixed(3)} km
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
            Points: A ({measurePointA?.lat_deg.toFixed(3)}°S, {measurePointA?.lon_deg.toFixed(3)}°E) &rarr; B ({measurePointB?.lat_deg.toFixed(3)}°S, {measurePointB?.lon_deg.toFixed(3)}°E)
          </div>
        </div>
      )}

      {/* Primary Selenographic Coordinates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
          SELENOGRAPHIC (MOON_ME DATUM)
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            backgroundColor: 'var(--bg-shell)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>LATITUDE (&phi;)</span>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {inspectedCoords.lat_deg.toFixed(5)}°S
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>LONGITUDE (&lambda;)</span>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {inspectedCoords.lon_deg.toFixed(5)}°E
            </div>
          </div>
        </div>
      </div>

      {/* Polar Stereographic Projected Coordinates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
          SOUTH POLAR STEREOGRAPHIC (METRIC)
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            backgroundColor: 'var(--bg-shell)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>POLAR RADIUS &rho;</span>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
              {(rho_m / 1000).toFixed(2)} km
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>X (EASTWARD)</span>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {x_m.toFixed(1)} m
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Y (EARTHWARD)</span>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {y_m.toFixed(1)} m
            </div>
          </div>
        </div>
      </div>

      {/* DEM Pixel Coordinate Transformation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
          LOLA LDEM_80S_20M RASTER INDICES
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            backgroundColor: 'var(--bg-shell)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>CONTINUOUS [0-BASED]</span>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              col: {pixel.col_0.toFixed(2)}, row: {pixel.row_0.toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>PDS FORTRAN [1-BASED]</span>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              samp: {pixel.sample_1.toFixed(1)}, line: {pixel.line_1.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Verification Status Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: inCoverage ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: `1px solid ${inCoverage ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>PRODUCT BOUNDARY (&le; -80°S)</span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: inCoverage ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            }}
          >
            {inCoverage ? 'VALID' : 'OUT'}
          </span>
        </div>

        <div
          style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: inRaster ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: `1px solid ${inRaster ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>RASTER FOOTPRINT</span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: inRaster ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            }}
          >
            {inRaster ? 'VALID' : 'OUT'}
          </span>
        </div>
      </div>

      {/* Button: Set As Global Active Site */}
      <button
        onClick={handleSetAsActiveSite}
        disabled={isActiveSite}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          backgroundColor: isActiveSite ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-cyan)',
          border: `1px solid ${isActiveSite ? 'var(--accent-emerald)' : 'var(--accent-cyan)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          color: isActiveSite ? 'var(--accent-emerald)' : '#05080E',
          fontWeight: 700,
          fontSize: '0.78rem',
          cursor: isActiveSite ? 'default' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Target size={16} />
        <span>{isActiveSite ? 'CURRENT ACTIVE MISSION SITE' : 'SET AS ACTIVE MISSION SITE'}</span>
      </button>

      {/* Quick Scientific Queries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
          RAPID BACKEND SCIENTIFIC QUERIES
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={handleRunProfile}
            disabled={isProfiling}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-shell)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px',
              color: 'var(--text-secondary)',
              cursor: isProfiling ? 'not-allowed' : 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            {isProfiling ? <Loader2 size={13} className="spin" /> : <Mountain size={13} color="var(--accent-cyan)" />}
            <span>RADIAL PROFILE</span>
          </button>

          <button
            onClick={handleRunVisibility}
            disabled={isCheckingVis}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-shell)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px',
              color: 'var(--text-secondary)',
              cursor: isCheckingVis ? 'not-allowed' : 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            {isCheckingVis ? <Loader2 size={13} className="spin" /> : <Sun size={13} color="var(--accent-amber)" />}
            <span>24H VISIBILITY</span>
          </button>
        </div>

        {/* Query Results */}
        {profileResult && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--bg-shell)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-cyan)' }}>
              <span>PROFILE 25 KM (0° AZ):</span>
              <span>{profileResult.count} sample points</span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
              Elevation Range: {profileResult.minEl.toFixed(0)}m to {profileResult.maxEl.toFixed(0)}m
            </div>
            <div style={{ color: 'var(--accent-amber)', fontSize: '0.62rem' }}>
              Mode: {profileResult.fidelity} (SPHERICAL_DATUM fallback)
            </div>
          </div>
        )}

        {visResult && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--bg-shell)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--accent-amber)' }}>SUN VISIBILITY:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{visResult.sunFraction.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--accent-cyan)' }}>EARTH LoS:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{visResult.earthFraction.toFixed(1)}%</span>
            </div>
          </div>
        )}

        {analysisError && (
          <div style={{ fontSize: '0.68rem', color: 'var(--accent-rose)' }}>
            Error: {analysisError}
          </div>
        )}
      </div>
    </div>
  );
};
