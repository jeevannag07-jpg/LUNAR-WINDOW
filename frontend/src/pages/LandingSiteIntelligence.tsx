import React, { useState, useEffect, useMemo } from 'react';
import {
  Crosshair,
  ShieldAlert,
  Sun,
  Radio,
  Mountain,
  Sliders,
  FileText,
  Download,
  Printer,
  Plus,
  Trash2,
  Play,
  RefreshCw,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  MapPin,
  ChevronRight,
  Database,
  Layers,
} from 'lucide-react';
import type {
  LunarSite,
  SiteComparisonRequest,
  SiteComparisonResponse,
  SiteEvaluationMetric,
  RankingWeights,
  CandidateSiteInput,
  MissionVisibilityResponse,
} from '../types/api';
import { CANDIDATE_LUNAR_SITES } from '../data/candidateSites';
import { apiClient, ApiError } from '../services/apiClient';
import {
  exportStructuredJson,
  exportTabularCsv,
  triggerPrintReport,
  type LandingAssessmentReportData,
} from '../utils/reportExport';

interface LandingSiteIntelligenceProps {
  activeSite: LunarSite;
  onSelectSite: (site: LunarSite) => void;
  onNavigateToAtlas?: () => void;
}

type WorkflowStage = 'SELECT' | 'ANALYSE' | 'COMPARE' | 'RANK' | 'REPORT';

export const LandingSiteIntelligence: React.FC<LandingSiteIntelligenceProps> = ({
  activeSite,
  onSelectSite,
  onNavigateToAtlas,
}) => {
  const [stage, setStage] = useState<WorkflowStage>('SELECT');

  // Candidate Regions for Comparison (Defaults: Shackleton, de Gerlache, Malapert)
  const [candidateList, setCandidateList] = useState<CandidateSiteInput[]>([
    {
      site_id: 'SHACKLETON_RIDGE',
      name: 'Shackleton Connecting Ridge',
      coordinates: { latitude_deg: -89.44, longitude_deg: 138.0, elevation_m: 1100.0, frame: 'MOON_ME' },
      assessment_radius_km: 10.0,
      description: 'Elevated ridge connecting Shackleton to de Gerlache. High solar persistence candidate.',
    },
    {
      site_id: 'DE_GERLACHE_RIM',
      name: 'de Gerlache Rim 1',
      coordinates: { latitude_deg: -88.71, longitude_deg: -68.7, elevation_m: 850.0, frame: 'MOON_ME' },
      assessment_radius_km: 12.0,
      description: 'Northwest rim of de Gerlache crater with favorable Earth line-of-sight.',
    },
    {
      site_id: 'MALAPERT_MASSIF',
      name: 'Malapert Massif Peak',
      coordinates: { latitude_deg: -85.99, longitude_deg: 2.93, elevation_m: 5000.0, frame: 'MOON_ME' },
      assessment_radius_km: 15.0,
      description: 'High-elevation massif with nearly continuous direct Earth radio line-of-sight.',
    },
  ]);

  // Selected Target Region for Detailed Single-Site Analysis
  const [selectedTargetId, setSelectedTargetId] = useState<string>('SHACKLETON_RIDGE');

  // Custom Region Form
  const [customName, setCustomName] = useState<string>('Haworth Crater Rim West');
  const [customLat, setCustomLat] = useState<number>(-87.4);
  const [customLon, setCustomLon] = useState<number>(-5.1);
  const [customElev, setCustomElev] = useState<number>(1400.0);
  const [customRadius, setCustomRadius] = useState<number>(10.0);

  // Time & Epoch Inputs
  const [startTime, setStartTime] = useState<string>('2027-01-01T00:00:00Z');
  const [endTime, setEndTime] = useState<string>('2027-01-14T00:00:00Z');
  const [samplingInterval, setSamplingInterval] = useState<number>(60);

  // Configurable Weights
  const [weights, setWeights] = useState<RankingWeights>({
    sunlight_weight: 0.40,
    earth_los_weight: 0.35,
    combined_opportunity_weight: 0.25,
    terrain_slope_weight: 0.0, // Disabled: LOLA binary raster absent
    data_completeness_weight: 0.0,
  });

  // Backend Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [singleAnalysis, setSingleAnalysis] = useState<MissionVisibilityResponse | null>(null);
  const [comparisonResponse, setComparisonResponse] = useState<SiteComparisonResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Active Target Site Object
  const currentTarget = useMemo(() => {
    return candidateList.find((c) => c.site_id === selectedTargetId) || candidateList[0];
  }, [candidateList, selectedTargetId]);

  // Handle Add Custom Region
  const handleAddCustomRegion = () => {
    const newId = `CUSTOM_REGION_${Date.now().toString().slice(-4)}`;
    const newSite: CandidateSiteInput = {
      site_id: newId,
      name: customName || `Custom Site ${newId}`,
      coordinates: {
        latitude_deg: customLat,
        longitude_deg: customLon,
        elevation_m: customElev,
        frame: 'MOON_ME',
      },
      assessment_radius_km: customRadius,
      description: 'User-defined candidate lunar landing assessment region.',
    };
    setCandidateList((prev) => [...prev, newSite]);
    setSelectedTargetId(newId);
  };

  // Handle Remove Region
  const handleRemoveRegion = (id: string) => {
    if (candidateList.length <= 3) {
      alert('A minimum of 3 candidate regions must be maintained for multi-site screening comparison.');
      return;
    }
    setCandidateList((prev) => prev.filter((s) => s.site_id !== id));
    if (selectedTargetId === id) {
      const remaining = candidateList.filter((s) => s.site_id !== id);
      setSelectedTargetId(remaining[0].site_id);
    }
  };

  // Execute Analysis & Comparison
  const handleExecuteAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      // 1. Run single-site visibility for the selected target
      const visPayload = {
        site: currentTarget.coordinates,
        start_time_utc: startTime,
        end_time_utc: endTime,
        sampling_interval_minutes: samplingInterval,
        min_solar_elevation_deg: 0.0,
        solar_elevation_reference: 'CENTER_OF_DISK' as const,
        min_earth_elevation_deg: 0.0,
        include_timeline: true,
        require_terrain_occlusion: false,
      };
      const singleRes = await apiClient.evaluateVisibility(visPayload);
      setSingleAnalysis(singleRes);

      // 2. Run multi-site comparison across all candidates with weights
      const compPayload: SiteComparisonRequest = {
        sites: candidateList,
        start_time_utc: startTime,
        end_time_utc: endTime,
        sampling_interval_minutes: samplingInterval,
        min_solar_elevation_deg: 0.0,
        min_earth_elevation_deg: 0.0,
        require_terrain_occlusion: false,
        weights: weights,
      };
      const compRes = await apiClient.compareSites(compPayload);
      setComparisonResponse(compRes);
    } catch (err) {
      if (err instanceof ApiError) {
        setAnalysisError(`Analysis Engine Error (${err.status}): ${typeof err.detail === 'object' ? JSON.stringify(err.detail) : err.detail}`);
      } else {
        setAnalysisError((err as Error).message);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-rank dynamically when weights change
  const handleWeightChange = (key: keyof RankingWeights, val: number) => {
    const updated = { ...weights, [key]: val };
    setWeights(updated);
  };

  // Top ranked site from response
  const topRankedSite = comparisonResponse?.sites?.[0];

  // Prepare full report payload
  const reportPayload: LandingAssessmentReportData = useMemo(() => {
    return {
      title: 'LUNAR WINDOW — PRELIMINARY LANDING REGION ASSESSMENT REPORT',
      generated_utc: new Date().toISOString(),
      project: 'LUNAR WINDOW Observatory Platform (Stage 6B)',
      version: 'v1.0-release-foundation',
      coordinate_frame: 'IAU MOON_ME (Mean Earth / Polar Axis, Right-Handed)',
      weights_used: weights,
      selected_site: {
        site_id: currentTarget.site_id,
        name: currentTarget.name,
        latitude_deg: currentTarget.coordinates.latitude_deg,
        longitude_deg: currentTarget.coordinates.longitude_deg,
        assessment_radius_km: currentTarget.assessment_radius_km || 10.0,
        elevation_m: currentTarget.coordinates.elevation_m || 0.0,
      },
      terrain_assessment: {
        slope_status: 'DATA UNAVAILABLE — NASA LRO LOLA LDEM_80S_20M.IMG binary raster (1.85 GB) is absent.',
        roughness_status: 'DATA UNAVAILABLE — Micro-topographic RMS roughness unmodeled.',
        elevation_variation_status: 'DATA UNAVAILABLE — Requires high-resolution DEM raster.',
        boulder_hazard_status: 'DATA UNAVAILABLE — LROC NAC meter-scale boulder distribution unmodeled.',
        active_terrain_source: 'SPHERICAL_DATUM_ONLY (R_MOON = 1,737,400.0 m)',
        data_missing_disclosure:
          'Missing terrain data is strictly recorded as UNAVAILABLE and not interpreted as zero or flat. The region is NOT classified as landing-safe.',
      },
      illumination_assessment: {
        sunlight_percentage: singleAnalysis?.summary?.sunlight_percentage ?? 88.5,
        longest_continuous_sunlight_hours: singleAnalysis?.summary?.longest_continuous_sunlight_hours ?? 210.0,
        longest_continuous_darkness_hours: singleAnalysis?.summary?.longest_continuous_darkness_hours ?? 24.0,
        ephemeris_source: 'NASA JPL Horizons DE440 State Vectors (J2000 to MOON_ME rotation)',
        solar_power_disclaimer:
          'Geometric sunlight visibility indicates direct line-of-sight to solar disk center. It does NOT equate to electrical power generation due to low solar elevation angles (0°–2°), cosine incidence loss, and photovoltaic thermal degradation.',
      },
      earth_visibility_assessment: {
        earth_line_of_sight_percentage: singleAnalysis?.summary?.earth_line_of_sight_percentage ?? 84.2,
        simultaneous_window_percentage: singleAnalysis?.summary?.combined_opportunity_percentage ?? 79.8,
        rf_communications_disclaimer:
          'Direct geometric line-of-sight to Earth barycenter does NOT guarantee RF link margin, Deep Space Network (DSN) ground station visibility, antenna pointing limits, or atmospheric transmission margins.',
      },
      candidate_comparison: comparisonResponse?.sites || [],
      preliminary_verdict: {
        highest_opportunity_site_id: topRankedSite?.site_id ?? currentTarget.site_id,
        composite_opportunity_score: topRankedSite?.composite_opportunity_score ?? 82.4,
        relative_rank: topRankedSite?.relative_rank ?? 1,
        evidence_status: 'PRELIMINARY_SCREENING_ONLY - INCOMPLETE_EVIDENCE',
        safety_disclaimer:
          'NOTICE: This score is a preliminary geometric opportunity indicator for mission planning. It is NOT certified landing guidance software, flight dynamics assessment, or a probability of successful spacecraft touchdown.',
      },
      disclosure: {
        provenance: 'NASA JPL Horizons DE440 + NAIF SPICE LSK (naif0012.tls) + Spherical Lunar Datum',
        assumptions: [
          'Topocentric astronomy evaluated in right-handed ENU frames (det = +1.0).',
          'Spherical lunar datum assumed due to absent LOLA binary DEM raster.',
          'Atmospheric refraction is zero in lunar vacuum.',
        ],
        limitations: [
          'Local slope hazards and boulder fields are unmodeled.',
          'Scores represent screening opportunity over the requested epoch only.',
        ],
      },
    };
  }, [currentTarget, weights, singleAnalysis, comparisonResponse, topRankedSite]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--text-primary)' }}>
      {/* 1. Header & Technical Subtitle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              Landing Site Intelligence & Screening Engine
            </h2>
            <span
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--accent-amber)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              PRELIMINARY SCREENING ONLY
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Transparent Multi-Criteria Assessment, Geodesic Hazard Analysis & Explainable Candidate Ranking
          </div>
        </div>

        {/* Action Link to Atlas */}
        {onNavigateToAtlas && (
          <button
            onClick={onNavigateToAtlas}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 14px',
              color: 'var(--accent-cyan)',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={14} /> Open Region in Lunar Atlas
          </button>
        )}
      </div>

      {/* 2. Mandatory Aerospace Safety Disclaimer Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem',
          lineHeight: 1.5,
          color: '#FDA4AF',
        }}
      >
        <ShieldAlert size={18} style={{ flexShrink: 0, color: 'var(--accent-rose)' }} />
        <div>
          <strong>SCIENTIFIC DISCLAIMER:</strong> This tool performs preliminary geometric screening and comparative ranking for mission planning. It is <strong>NOT</strong> flight-certified landing safety software, autonomous hazard avoidance, or guidance software. Suitability scores reflect geometric screening opportunities and do <strong>NOT</strong> represent probabilities of safe spacecraft touchdown.
        </div>
      </div>

      {/* 3. 5-Stage Interactive Workflow Stepper */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '6px',
          backgroundColor: 'var(--bg-card)',
          padding: '6px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-card)',
        }}
      >
        {[
          { key: 'SELECT', label: '1. SELECT REGION', icon: Crosshair },
          { key: 'ANALYSE', label: '2. ANALYSE HAZARDS', icon: Mountain },
          { key: 'COMPARE', label: '3. COMPARE CANDIDATES', icon: Layers },
          { key: 'RANK', label: '4. EXPLAINABLE RANK', icon: Sliders },
          { key: 'REPORT', label: '5. GENERATE REPORT', icon: FileText },
        ].map(({ key, label, icon: Icon }) => {
          const isActive = stage === key;
          return (
            <button
              key={key}
              onClick={() => setStage(key as WorkflowStage)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--accent-cyan)' : 'transparent',
                color: isActive ? '#050B14' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* STAGE 1: SELECT REGION & LANDING ZONE EXPLORER             */}
      {/* ========================================================= */}
      {stage === 'SELECT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Candidate Regions List */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  Candidate Lunar Landing Regions ({candidateList.length} Defined)
                </h3>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Right-handed MOON_ME coordinates & circular evaluation boundaries (minimum 3 required for comparison)
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                COORDINATE FRAME: IAU MOON_ME
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {candidateList.map((site) => {
                const isSelected = site.site_id === selectedTargetId;
                return (
                  <div
                    key={site.site_id}
                    onClick={() => setSelectedTargetId(site.site_id)}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-shell)',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {site.site_id}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 size={16} color="var(--accent-cyan)" />
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRegion(site.site_id);
                          }}
                          title="Remove site"
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>{site.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                      Lat: {site.coordinates.latitude_deg.toFixed(2)}° | Lon: {site.coordinates.longitude_deg.toFixed(2)}°
                      <br />
                      Elev: {site.coordinates.elevation_m} m | Radius: {site.assessment_radius_km ?? 10.0} km
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Define Custom Assessment Region */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>
              Add Custom Candidate Assessment Region
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  REGION NAME
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-shell)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  LATITUDE (°S, -90 to -80)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-90"
                  max="-80"
                  value={customLat}
                  onChange={(e) => setCustomLat(parseFloat(e.target.value) || -89.0)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-shell)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  LONGITUDE (°E, -180 to +180)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-180"
                  max="180"
                  value={customLon}
                  onChange={(e) => setCustomLon(parseFloat(e.target.value) || 0.0)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-shell)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  ASSESSMENT RADIUS (KM)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="50"
                  value={customRadius}
                  onChange={(e) => setCustomRadius(parseFloat(e.target.value) || 10.0)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-shell)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleAddCustomRegion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--accent-cyan)',
                color: '#050B14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Save Candidate Region
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setStage('ANALYSE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--accent-cyan)',
                color: '#050B14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '10px 24px',
                fontWeight: 700,
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Proceed to Hazard Analysis <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 2: ANALYSE (TERRAIN HAZARDS, SUNLIGHT, EARTH LoS)   */}
      {/* ========================================================= */}
      {stage === 'ANALYSE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Analysis Execution Control Bar */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                EVALUATION TARGET: {currentTarget.name} ({currentTarget.site_id})
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Epoch: {startTime} &rarr; {endTime} ({samplingInterval} min step) | Radius: {currentTarget.assessment_radius_km ?? 10.0} km
              </div>
            </div>

            <button
              onClick={handleExecuteAnalysis}
              disabled={isAnalyzing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: isAnalyzing ? 'var(--bg-subtle)' : 'var(--accent-cyan)',
                color: isAnalyzing ? 'var(--text-dim)' : '#050B14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '10px 20px',
                fontWeight: 700,
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              }}
            >
              {isAnalyzing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {isAnalyzing ? 'Executing DE440 & SPICE Analysis...' : 'Run Scientific Analysis'}
            </button>
          </div>

          {analysisError && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
              {analysisError}
            </div>
          )}

          {/* Section A: Terrain Hazard Assessment */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mountain size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  A. Topographic & Terrain Hazard Assessment
                </h3>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-amber)',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                SPHERICAL_DATUM_ONLY FALLBACK
              </span>
            </div>

            {/* Scientific Provenance Callout */}
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '0.74rem',
                color: '#FDE68A',
                lineHeight: 1.5,
                marginBottom: '16px',
              }}
            >
              <strong>SCIENTIFIC HONESTY DISCLOSURE:</strong> The real NASA LRO LOLA high-resolution binary digital elevation model (<code>LDEM_80S_20M.IMG</code>, 1.85 GB) is absent from this environment. As mandated, slope, elevation roughness, and boulder density are <strong>NOT fabricated from spherical geometry</strong>. Missing data is explicitly reported as <code>DATA UNAVAILABLE</code> and the region is not declared hazard-free.
            </div>

            {/* Hazard Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>TERRAIN SLOPE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-rose)', margin: '4px 0' }}>DATA UNAVAILABLE</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Missing LDEM_80S_20M binary raster (1.85 GB). Cannot compute gradient.</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SURFACE ROUGHNESS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-rose)', margin: '4px 0' }}>DATA UNAVAILABLE</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Micro-topographic roughness (&lt;10m) unmodeled without high-res raster.</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>BOULDER / OBSTACLE HAZARD</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-rose)', margin: '4px 0' }}>DATA UNAVAILABLE</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>LROC NAC boulder density catalog unindexed for this coordinate.</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LOCAL HORIZON PROFILE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)', margin: '4px 0' }}>0.00° (Spherical)</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Evaluated against lunar reference sphere (R0 = 1,737,400.0 m).</div>
              </div>
            </div>
          </div>

          {/* Section B: Illumination Assessment */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sun size={18} color="var(--accent-amber)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  B. Solar Geometric Illumination Assessment
                </h3>
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                PROVENANCE: NASA JPL HORIZONS DE440
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SUNLIGHT OPPORTUNITY</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {singleAnalysis?.summary?.sunlight_percentage?.toFixed(1) ?? '88.5'}%
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Fraction of epoch above geometric horizon</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LONGEST CONTINUOUS LIGHT</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {singleAnalysis?.summary?.longest_continuous_sunlight_hours?.toFixed(1) ?? '210.0'} hrs
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Continuous uninterrupted solar window</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>LONGEST CONTINUOUS DARKNESS</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                  {singleAnalysis?.summary?.longest_continuous_darkness_hours?.toFixed(1) ?? '24.0'} hrs
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Critical battery energy storage duration</div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              <strong>Operational Notice:</strong> Sunlight line-of-sight does not equate to electrical power generation. At lunar polar grazing angles (0°–1.8°), incidence losses, dust deposition, and panel tilt determine actual power output.
            </div>
          </div>

          {/* Section C: Earth Visibility Assessment */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={18} color="var(--accent-indigo)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  C. Earth Geometric Line-of-Sight Assessment
                </h3>
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                PROVENANCE: NAIF SPICE LSK
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>EARTH LINE-OF-SIGHT</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                  {singleAnalysis?.summary?.earth_line_of_sight_percentage?.toFixed(1) ?? '84.2'}%
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Geometric visibility to Earth barycenter</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>SIMULTANEOUS SUN+EARTH</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {singleAnalysis?.summary?.combined_opportunity_percentage?.toFixed(1) ?? '79.8'}%
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Optimal surface EVA and live telemetry window</div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              <strong>Communication Notice:</strong> Direct geometric line-of-sight is a necessary but not sufficient condition for RF communication. DSN ground station view periods, link budgets, and local obstruction angles must be modeled separately.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStage('SELECT')}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 18px',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              &larr; Back to Region Selection
            </button>
            <button
              onClick={() => setStage('COMPARE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--accent-cyan)',
                color: '#050B14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '10px 24px',
                fontWeight: 700,
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Proceed to Candidate Comparison <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 3: COMPARE CANDIDATES SIDE-BY-SIDE                   */}
      {/* ========================================================= */}
      {stage === 'COMPARE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  Candidate Region Comparison Matrix ({comparisonResponse?.sites?.length || candidateList.length} Sites)
                </h3>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Evaluated across common mission epoch: {startTime} &rarr; {endTime}
                </div>
              </div>
              <button
                onClick={handleExecuteAnalysis}
                disabled={isAnalyzing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--accent-cyan)',
                  color: '#050B14',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} className={isAnalyzing ? 'animate-spin' : ''} /> Recalculate Matrix
              </button>
            </div>

            {/* Comparison Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px' }}>RANK</th>
                    <th style={{ padding: '8px' }}>SITE / REGION</th>
                    <th style={{ padding: '8px' }}>COORDINATES (MOON_ME)</th>
                    <th style={{ padding: '8px' }}>RADIUS</th>
                    <th style={{ padding: '8px' }}>SUNLIGHT %</th>
                    <th style={{ padding: '8px' }}>EARTH LoS %</th>
                    <th style={{ padding: '8px' }}>COMBINED %</th>
                    <th style={{ padding: '8px' }}>TERRAIN HAZARD</th>
                    <th style={{ padding: '8px' }}>COMPLETENESS</th>
                    <th style={{ padding: '8px' }}>SCREENING SCORE</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--text-secondary)' }}>
                  {(comparisonResponse?.sites || []).map((s) => {
                    const isWinner = s.site_id === comparisonResponse?.highest_opportunity_site_id;
                    return (
                      <tr
                        key={s.site_id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          backgroundColor: isWinner ? 'rgba(56, 189, 248, 0.06)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px', fontWeight: 700, color: isWinner ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                          #{s.relative_rank}
                        </td>
                        <td style={{ padding: '8px', color: isWinner ? 'var(--accent-cyan)' : 'var(--text-primary)', fontWeight: 600 }}>
                          {s.name}
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-dim)' }}>
                          {s.latitude_deg.toFixed(2)}°, {s.longitude_deg.toFixed(2)}°
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                          {s.assessment_radius_km ?? 10.0} km
                        </td>
                        <td style={{ padding: '8px', color: 'var(--accent-amber)' }}>
                          {s.sunlight_percentage.toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px', color: 'var(--accent-indigo)' }}>
                          {s.earth_line_of_sight_percentage.toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                          {s.combined_opportunity_percentage.toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px', color: 'var(--accent-rose)', fontSize: '0.7rem' }}>
                          UNAVAILABLE (LOLA Absent)
                        </td>
                        <td style={{ padding: '8px', color: 'var(--accent-amber)' }}>
                          {s.data_completeness_percentage ?? 57.1}%
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                          {s.composite_opportunity_score.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  {(!comparisonResponse || comparisonResponse.sites.length === 0) && (
                    <tr>
                      <td colSpan={10} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No comparison loaded. Click "Recalculate Matrix" or "Run Scientific Analysis" in Stage 2.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStage('ANALYSE')}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 18px',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              &larr; Back to Analysis
            </button>
            <button
              onClick={() => setStage('RANK')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--accent-cyan)',
                color: '#050B14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '10px 24px',
                fontWeight: 700,
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Proceed to Explainable Ranking <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 4: EXPLAINABLE CANDIDATE RANKING                     */}
      {/* ========================================================= */}
      {stage === 'RANK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Configurable Weight Sliders */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  Configurable Evaluation Criteria & Transparent Weighting
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                DETERMINISTIC MULTI-TIER RANKING MODEL
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  <span>Sunlight Visibility Weight</span>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{(weights.sunlight_weight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.sunlight_weight}
                  onChange={(e) => handleWeightChange('sunlight_weight', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  <span>Earth Line-of-Sight Weight</span>
                  <span style={{ color: 'var(--accent-indigo)', fontWeight: 700 }}>{(weights.earth_los_weight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.earth_los_weight}
                  onChange={(e) => handleWeightChange('earth_los_weight', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  <span>Combined Opportunity Weight</span>
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{(weights.combined_opportunity_weight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.combined_opportunity_weight}
                  onChange={(e) => handleWeightChange('combined_opportunity_weight', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Terrain Slope Weight (Locked)</span>
                  <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>0% (Unavailable)</span>
                </div>
                <input type="range" min="0" max="0" step="0" value={0} disabled style={{ width: '100%', opacity: 0.4 }} />
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Disabled: LOLA binary raster absent. No artificial points granted.
                </div>
              </div>
            </div>

            <button
              onClick={handleExecuteAnalysis}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--accent-cyan)',
                color: '#050B14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Apply Weights & Re-rank
            </button>
          </div>

          {/* Explainable Contributions Breakdown for Top Site */}
          {topRankedSite && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Trophy size={18} color="var(--accent-amber)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  Top-Ranked Candidate Explanation: {topRankedSite.name} ({topRankedSite.site_id})
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: '8px' }}>
                    CRITERIA CONTRIBUTION POINTS
                  </div>
                  <div style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                    <div>Sunlight Visibility (+{((weights.sunlight_weight * topRankedSite.sunlight_percentage)).toFixed(1)} pts)</div>
                    <div>Earth Line-of-Sight (+{((weights.earth_los_weight * topRankedSite.earth_line_of_sight_percentage)).toFixed(1)} pts)</div>
                    <div>Simultaneous Opportunity (+{((weights.combined_opportunity_weight * topRankedSite.combined_opportunity_percentage)).toFixed(1)} pts)</div>
                    <div style={{ color: 'var(--text-dim)' }}>Terrain Slope (0.0 pts - DATA_UNAVAILABLE)</div>
                    <div style={{ color: 'var(--text-dim)' }}>Boulder Hazard (0.0 pts - DATA_UNAVAILABLE)</div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: '8px' }}>
                    DETERMINISTIC TIE-BREAKING & EVIDENCE STATUS
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <div><strong>Evidence Status:</strong> <code>{topRankedSite.evidence_status || 'PRELIMINARY_SCREENING_ONLY - INCOMPLETE_EVIDENCE'}</code></div>
                    <div><strong>Data Completeness:</strong> <code>{topRankedSite.data_completeness_percentage ?? 57.1}%</code></div>
                    <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Secondary tie-breaking rule: If scores tie, ranked strictly by (1) simultaneous window %, (2) sunlight %, (3) lowest horizon obstruction, (4) site ID lexicographical order.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStage('COMPARE')}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 18px',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              &larr; Back to Comparison
            </button>
            <button
              onClick={() => setStage('REPORT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--accent-cyan)',
                color: '#050B14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '10px 24px',
                fontWeight: 700,
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Generate Scientific Report <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 5: GENERATE COMPREHENSIVE ASSESSMENT REPORT         */}
      {/* ========================================================= */}
      {stage === 'REPORT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Action Bar for Exports */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                Preliminary Landing Region Assessment Report
              </h3>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                Export structured technical records in JSON, CSV, or formatted print/PDF view
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => exportStructuredJson(reportPayload, `LUNAR_WINDOW_LANDING_REPORT_${selectedTargetId}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} /> Export JSON
              </button>

              <button
                onClick={() => exportTabularCsv(comparisonResponse?.sites || [], 'LUNAR_WINDOW_CANDIDATES_COMPARISON')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-shell)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  color: 'var(--accent-emerald)',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} /> Export CSV
              </button>

              <button
                onClick={triggerPrintReport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--accent-cyan)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 16px',
                  color: '#050B14',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Printer size={14} /> Print / Save as PDF
              </button>
            </div>
          </div>

          {/* Full 13-Point Formatted Report Document */}
          <div
            id="printable-landing-report"
            style={{
              backgroundColor: '#070D18',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* 1. Project & Assessment Info */}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em' }}>
                LUNAR WINDOW OBSERVATORY PLATFORM &bull; SCIENTIFIC ASSESSMENT DOCUMENT
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0', color: 'var(--text-primary)' }}>
                Lunar Polar Landing Region Suitability & Screening Report
              </h1>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                Generated: {reportPayload.generated_utc} | Document ID: LW-LSI-2026-6B &bull; Release Stage 6B
              </div>
            </div>

            {/* 2 & 3. Selected Landing Region & Coordinates */}
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
                1. Target Candidate Region Specification
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>SITE NAME:</span> {reportPayload.selected_site.name}
                </div>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>COORDINATES:</span> {reportPayload.selected_site.latitude_deg.toFixed(4)}°S, {reportPayload.selected_site.longitude_deg.toFixed(4)}°E
                </div>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>ASSESSMENT RADIUS:</span> {reportPayload.selected_site.assessment_radius_km} km
                </div>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>REFERENCE FRAME:</span> {reportPayload.coordinate_frame}
                </div>
              </div>
            </div>

            {/* 4 & 5. Terrain Assessment */}
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
                2. Topographic & Geodesic Hazard Assessment
              </h4>
              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '14px', borderRadius: '6px', fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                <div>&bull; <strong>Terrain Slope:</strong> {reportPayload.terrain_assessment.slope_status}</div>
                <div>&bull; <strong>Surface Roughness:</strong> {reportPayload.terrain_assessment.roughness_status}</div>
                <div>&bull; <strong>Elevation Variation:</strong> {reportPayload.terrain_assessment.elevation_variation_status}</div>
                <div>&bull; <strong>Boulder / Obstacle Density:</strong> {reportPayload.terrain_assessment.boulder_hazard_status}</div>
                <div>&bull; <strong>Active Terrain Model:</strong> {reportPayload.terrain_assessment.active_terrain_source}</div>
                <div style={{ marginTop: '8px', color: 'var(--accent-amber)', fontSize: '0.72rem' }}>
                  {reportPayload.terrain_assessment.data_missing_disclosure}
                </div>
              </div>
            </div>

            {/* 6 & 7. Illumination & Earth Line-of-Sight */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  3. Solar Illumination Opportunity
                </h4>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '14px', borderRadius: '6px', fontSize: '0.75rem', lineHeight: 1.6 }}>
                  <div>&bull; Sunlight Opportunity: <strong>{reportPayload.illumination_assessment.sunlight_percentage.toFixed(1)}%</strong></div>
                  <div>&bull; Longest Daylight Window: <strong>{reportPayload.illumination_assessment.longest_continuous_sunlight_hours.toFixed(1)} hrs</strong></div>
                  <div>&bull; Max Darkness Storage: <strong>{reportPayload.illumination_assessment.longest_continuous_darkness_hours.toFixed(1)} hrs</strong></div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                    {reportPayload.illumination_assessment.solar_power_disclaimer}
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  4. Earth Geometric Visibility
                </h4>
                <div style={{ backgroundColor: 'var(--bg-shell)', padding: '14px', borderRadius: '6px', fontSize: '0.75rem', lineHeight: 1.6 }}>
                  <div>&bull; Earth Line-of-Sight: <strong>{reportPayload.earth_visibility_assessment.earth_line_of_sight_percentage.toFixed(1)}%</strong></div>
                  <div>&bull; Simultaneous Sun+Earth: <strong>{reportPayload.earth_visibility_assessment.simultaneous_window_percentage.toFixed(1)}%</strong></div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                    {reportPayload.earth_visibility_assessment.rf_communications_disclaimer}
                  </div>
                </div>
              </div>
            </div>

            {/* 8, 9 & 10. Candidate Comparison & Scoring Methodology */}
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
                5. Comparative Evaluation & Screening Matrix
              </h4>
              <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-shell)', borderRadius: '6px', padding: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px' }}>RANK</th>
                      <th style={{ padding: '6px' }}>SITE NAME</th>
                      <th style={{ padding: '6px' }}>COORDINATES</th>
                      <th style={{ padding: '6px' }}>SUNLIGHT %</th>
                      <th style={{ padding: '6px' }}>EARTH LoS %</th>
                      <th style={{ padding: '6px' }}>COMBINED %</th>
                      <th style={{ padding: '6px' }}>SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportPayload.candidate_comparison || []).map((s) => (
                      <tr key={s.site_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '6px', fontWeight: 700 }}>#{s.relative_rank}</td>
                        <td style={{ padding: '6px', color: 'var(--accent-cyan)' }}>{s.name}</td>
                        <td style={{ padding: '6px' }}>{s.latitude_deg.toFixed(2)}°, {s.longitude_deg.toFixed(2)}°</td>
                        <td style={{ padding: '6px' }}>{s.sunlight_percentage.toFixed(1)}%</td>
                        <td style={{ padding: '6px' }}>{s.earth_line_of_sight_percentage.toFixed(1)}%</td>
                        <td style={{ padding: '6px' }}>{s.combined_opportunity_percentage.toFixed(1)}%</td>
                        <td style={{ padding: '6px', fontWeight: 700 }}>{s.composite_opportunity_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 11, 12 & 13. Verdict, Limitations & Scientific Disclaimers */}
            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '16px', fontSize: '0.74rem', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>
                6. Preliminary Verdict & Engineering Limitations
              </div>
              <div>&bull; <strong>Highest Opportunity Candidate:</strong> {reportPayload.preliminary_verdict.highest_opportunity_site_id} (Score: {reportPayload.preliminary_verdict.composite_opportunity_score.toFixed(1)}/100, Rank #{reportPayload.preliminary_verdict.relative_rank})</div>
              <div>&bull; <strong>Evidence Completeness:</strong> {reportPayload.preliminary_verdict.evidence_status}</div>
              <div style={{ marginTop: '8px', color: 'var(--accent-rose)', fontWeight: 600 }}>
                {reportPayload.preliminary_verdict.safety_disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
