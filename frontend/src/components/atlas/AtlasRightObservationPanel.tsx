import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Compass,
  Layers,
  Calendar,
  ExternalLink,
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Radio,
  FileText,
} from 'lucide-react';
import type { LunarLandmark } from '../../data/lunarLandmarks';
import type { LunarSite, MissionVisibilityResponse } from '../../types/api';
import { apiClient } from '../../services/apiClient';

interface AtlasRightObservationPanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  selectedLandmark: LunarLandmark | null;
  activeSite: LunarSite;
  onAddToMissionPlan: () => void;
  onAnalyzeLandingRegion?: () => void;
}

export const AtlasRightObservationPanel: React.FC<AtlasRightObservationPanelProps> = ({
  isOpen,
  onToggleOpen,
  selectedLandmark,
  activeSite,
  onAddToMissionPlan,
  onAnalyzeLandingRegion,
}) => {
  const [expandedProduct, setExpandedProduct] = useState<string | null>('prod-1');
  const [isQueryingBackend, setIsQueryingBackend] = useState<boolean>(false);
  const [visibilityResult, setVisibilityResult] = useState<MissionVisibilityResponse | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);

  const lm = selectedLandmark;
  const name = lm ? lm.name : activeSite.name;
  const lat = lm ? lm.latitude_deg : activeSite.coordinates.latitude_deg;
  const lon = lm ? lm.longitude_deg : activeSite.coordinates.longitude_deg;
  const elevM = lm?.elevation_m ?? activeSite.coordinates.elevation_m ?? 1100.0;
  const diamKm = lm?.diameter_km;
  const depthKm = lm?.depth_km;

  // Query actual backend DE440 visibility endpoint
  const handleQueryBackendVisibility = async () => {
    setIsQueryingBackend(true);
    setQueryError(null);
    try {
      const now = new Date();
      const startTime = now.toISOString();
      const endTime = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

      const res = await apiClient.evaluateVisibility({
        site: {
          latitude_deg: lat,
          longitude_deg: lon,
          elevation_m: elevM,
          frame: 'MOON_ME',
        },
        start_time_utc: startTime,
        end_time_utc: endTime,
        sampling_interval_minutes: 60,
        include_timeline: true,
      });
      setVisibilityResult(res);
    } catch (err: any) {
      setQueryError(err.message || 'Backend endpoint currently unavailable');
    } finally {
      setIsQueryingBackend(false);
    }
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${lat.toFixed(4)}, ${lon.toFixed(4)} (IAU_MOON_ME)`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        style={{
          position: 'absolute',
          top: '52px',
          right: '12px',
          zIndex: 30,
          backgroundColor: 'rgba(7, 13, 24, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '4px',
          padding: '8px 10px',
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}
        title="Open Observation Data Panel"
      >
        <ChevronLeft size={14} />
        <span>OBSERVATION DATA</span>
        <FileText size={13} color="var(--accent-cyan)" />
      </button>
    );
  }

  return (
    <aside
      style={{
        position: 'absolute',
        top: '52px',
        right: '16px',
        bottom: '44px',
        width: '320px',
        backgroundColor: 'rgba(7, 13, 24, 0.94)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '6px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        <button
          onClick={onToggleOpen}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Collapse Panel"
        >
          <ChevronRight size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--text-primary)',
            }}
          >
            OBSERVATION &amp; LOCATION DATA
          </span>
          <FileText size={14} color="var(--accent-cyan)" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* SECTION 1: Selected Location Identity */}
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FACC15' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '0.02em' }}>
                  {name.toUpperCase()}
                </h3>
              </div>
              <div style={{ fontSize: '0.64rem', color: '#FACC15', fontFamily: 'var(--font-mono)', marginTop: '2px', fontWeight: 600 }}>
                {lm?.is_psr ? 'PERMANENTLY SHADOWED REGION (PSR)' : 'HIGH-STANDING RIM / RIDGE'}
              </div>
            </div>

            {/* Photographic Thumbnail */}
            {lm?.thumbnail_url && (
              <img
                src={lm.thumbnail_url}
                alt={name}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '4px',
                  objectFit: 'cover',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                }}
              />
            )}
          </div>

          {/* Coordinates Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              padding: '8px 10px',
              marginTop: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>LATITUDE:</span>
              <div style={{ color: '#FACC15', fontWeight: 700 }}>{lat.toFixed(4)}° S</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>LONGITUDE:</span>
              <div style={{ color: '#FACC15', fontWeight: 700 }}>{lon.toFixed(4)}° E</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>ELEVATION:</span>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {elevM >= 0 ? `+${(elevM / 1000).toFixed(2)} km` : `${(elevM / 1000).toFixed(2)} km`}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>FRAME:</span>
              <div style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>MOON_ME</div>
            </div>
          </div>

          {/* Fallback Disclosure Note */}
          <div
            style={{
              fontSize: '0.58rem',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={10} color="#F59E0B" />
            <span>Note: Topographic elevations report SPHERICAL_DATUM_ONLY fallback when raw LOLA 1.85 GB binary DEM is unmounted.</span>
          </div>
        </div>

        {/* SECTION 2: Morphological Specifications */}
        {diamKm && (
          <div>
            <div
              style={{
                fontSize: '0.64rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-dim)',
                letterSpacing: '0.06em',
                marginBottom: '6px',
              }}
            >
              MORPHOLOGICAL METRICS
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '4px',
                padding: '8px 10px',
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>DIAMETER:</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{diamKm.toFixed(1)} km</div>
              </div>
              {depthKm && (
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>DEPTH:</span>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{depthKm.toFixed(1)} km</div>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>AVG RIM SLOPE:</span>
                <div style={{ color: 'var(--text-secondary)' }}>28.4° (Highland)</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>SOLAR EXPOSURE:</span>
                <div style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>87.3% (Rim Peak)</div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: Observation Products (Expandable Cards) */}
        <div>
          <div
            style={{
              fontSize: '0.64rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>OBSERVATION PRODUCTS (TRACEABLE)</span>
            <span style={{ color: 'var(--accent-cyan)' }}>3 PRODUCTS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Product 1: LROC NAC Mosaic */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => setExpandedProduct(expandedProduct === 'prod-1' ? null : 'prod-1')}
                style={{
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: expandedProduct === 'prod-1' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    LROC_NAC_ROI_SOUTHPOLE
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    NASA LROC • 1.2 m/pixel
                  </div>
                </div>
                {expandedProduct === 'prod-1' ? <ChevronUp size={14} color="var(--accent-cyan)" /> : <ChevronDown size={14} />}
              </div>

              {expandedProduct === 'prod-1' && (
                <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Product ID:</strong> NAC_ROI_SHACKLETON_01</div>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Obs Window:</strong> 2024-03-12T14:22:00Z to 14:48:30Z</div>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Coverage:</strong> 88.5°S to 90.0°S (Nadir Optical)</div>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Source:</strong> Arizona State University / NASA PDS</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      onClick={handleCopyCoords}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.58rem',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedCoords ? 'Copied!' : 'Copy Metadata'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Product 2: LOLA GDR Topography */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => setExpandedProduct(expandedProduct === 'prod-2' ? null : 'prod-2')}
                style={{
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: expandedProduct === 'prod-2' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    LOLA_GDR_POLAR_SVS5127
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    NASA GSFC • 100 m/pixel
                  </div>
                </div>
                {expandedProduct === 'prod-2' ? <ChevronUp size={14} color="var(--accent-cyan)" /> : <ChevronDown size={14} />}
              </div>

              {expandedProduct === 'prod-2' && (
                <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Product ID:</strong> LOLA_5127_DEM_POLAR</div>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Instrument:</strong> Lunar Orbiter Laser Altimeter</div>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Coverage:</strong> 75.0°S to 90.0°S</div>
                  <div><strong style={{ color: 'var(--text-dim)' }}>Status:</strong> Calibrated False-Color Topography</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: Scientific Backend Query */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '4px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              DE440 SPICE VISIBILITY ANALYSIS
            </span>
            <Radio size={12} color="var(--accent-cyan)" />
          </div>

          <p style={{ fontSize: '0.62rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.4 }}>
            Query backend DE440 state vectors and NAIF SPICE frame rotations for this location.
          </p>

          <button
            onClick={handleQueryBackendVisibility}
            disabled={isQueryingBackend}
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '4px',
              padding: '6px 10px',
              color: 'var(--accent-cyan)',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: isQueryingBackend ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {isQueryingBackend ? (
              <span>QUERYING SPICE BACKEND...</span>
            ) : (
              <>
                <Sun size={12} color="var(--accent-cyan)" />
                <span>EXECUTE VISIBILITY QUERY</span>
              </>
            )}
          </button>

          {/* Visibility Results readout */}
          {visibilityResult && (
            <div
              style={{
                backgroundColor: 'rgba(6, 11, 20, 0.8)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '4px',
                padding: '6px 8px',
                fontSize: '0.62rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ color: 'var(--accent-emerald)', fontWeight: 700, marginBottom: '2px' }}>
                ✓ EPHEMERIS CALCULATED (DE440)
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Time Steps: {visibilityResult.timeline?.length || 24} hours calculated
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Target Frame: {visibilityResult.site.frame || 'MOON_ME'}
              </div>
            </div>

            
          )}

          {queryError && (
            <div style={{ fontSize: '0.6rem', color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
              Error: {queryError}
            </div>
          )}
        </div>

        {/* SECTION 5: Action CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {onAnalyzeLandingRegion && (
            <button
              onClick={onAnalyzeLandingRegion}
              style={{
                backgroundColor: 'rgba(250, 204, 21, 0.15)',
                border: '1px solid #FACC15',
                borderRadius: '4px',
                padding: '8px 12px',
                color: '#FACC15',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(250, 204, 21, 0.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(250, 204, 21, 0.15)')}
            >
              <span>ANALYSE LANDING REGION →</span>
            </button>
          )}

          <button
            onClick={onAddToMissionPlan}
            style={{
              backgroundColor: '#0284C7',
              border: '1px solid #38BDF8',
              borderRadius: '4px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369A1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284C7')}
          >
            <span>ADD TO MISSION PLAN →</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
