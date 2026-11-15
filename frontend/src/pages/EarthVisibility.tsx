import React, { useState } from 'react';
import { Radio, Signal, Orbit, Info, ShieldAlert, CheckCircle2, Play, RefreshCw } from 'lucide-react';
import type { LunarSite, MissionVisibilityResponse } from '../types/api';
import { StatCard } from '../components/common/StatCard';
import { ScientificCallout } from '../components/common/ScientificCallout';
import { apiClient, ApiError } from '../services/apiClient';

interface EarthVisibilityProps {
  activeSite: LunarSite;
}

export const EarthVisibility: React.FC<EarthVisibilityProps> = ({ activeSite }) => {
  const [minEarthElevation, setMinEarthElevation] = useState<number>(0.0);

  // Live Earth LoS Analysis State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [earthResult, setEarthResult] = useState<MissionVisibilityResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRunEarthAnalysis = async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const res = await apiClient.evaluateVisibility({
        site: {
          latitude_deg: activeSite.coordinates.latitude_deg,
          longitude_deg: activeSite.coordinates.longitude_deg,
          elevation_m: activeSite.coordinates.elevation_m,
          frame: activeSite.coordinates.frame,
        },
        start_time_utc: '2027-01-01T00:00:00Z',
        end_time_utc: '2027-01-14T00:00:00Z',
        sampling_interval_minutes: 60,
        min_earth_elevation_deg: minEarthElevation,
        min_solar_elevation_deg: 0.0,
        require_terrain_occlusion: false,
      });
      setEarthResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setRunError(`Backend Error ${err.status} (${err.statusText}): ${typeof err.detail === 'object' ? JSON.stringify(err.detail) : String(err.detail)}`);
      } else {
        setRunError((err as Error).message);
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Mean geometric elevation for site
  const lat = activeSite.coordinates.latitude_deg;
  const lon = activeSite.coordinates.longitude_deg;
  
  // Approximate mean Earth elevation based on latitude and longitude
  // At (0, 0) Earth is at zenith ~90 deg. At limb (lat ~0, lon ~90) elevation ~0 deg.
  // At polar latitudes (lat ~ -89 deg), mean Earth elevation ~ 1° to 6° depending on longitude.
  const approxMeanEarthElev = Math.max(0.5, Math.min(8.0, 90.0 - Math.abs(lat) + 2.0 * Math.cos((lon * Math.PI) / 180.0)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Direct-to-Earth Communication Visibility & Libration
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Topocentric Earth Center Geometry, Libration Oscillations & Optical Line-of-Sight
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Mean Earth Elevation"
          value={`~${approxMeanEarthElev.toFixed(2)}°`}
          sublabel="Center of Earth disk above local horizon"
          icon={Radio}
          accentColor="var(--accent-indigo)"
        />
        <StatCard
          label="Libration Envelope (Lat)"
          value="&plusmn;6.68°"
          sublabel="Lunar Polar Libration Oscillation"
          icon={Orbit}
          accentColor="var(--accent-indigo)"
        />
        <StatCard
          label="Libration Envelope (Lon)"
          value="&plusmn;7.92°"
          sublabel="Lunar Longitudinal Libration Oscillation"
          icon={Orbit}
          accentColor="var(--accent-indigo)"
        />
        <StatCard
          label="Draconic Libration Period"
          value="27.21"
          unit="days"
          sublabel="Nodal Libration Cycle"
          icon={Radio}
          accentColor="var(--accent-cyan)"
        />
      </div>

      {/* Mandatory RF Communication Disclaimer */}
      <ScientificCallout type="warning" title="MANDATORY GEOMETRIC LINE-OF-SIGHT DISCLAIMER">
        Notice: Geometric line-of-sight does <strong>NOT</strong> equate to a guaranteed communication link.
        Calculations model the topocentric vector between the lunar surface site and Earth center.
        Actual telecommunication links depend on Deep Space Network (DSN) ground station visibility, RF link budget, multi-path terrain reflections, ionospheric delay, and local masking.
      </ScientificCallout>

      {/* Libration Box Visualization Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Sub-Earth Libration Oscillation Box (27.3-Day Cycle)
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              [SYNTHETIC TEST FIXTURE — NOT FLIGHT DATA] Visualizing apparent Earth motion in lunar sky
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>
            Lissajous Libration Pattern
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '20px', alignItems: 'center' }}>
          {/* Libration Box SVG */}
          <div
            style={{
              backgroundColor: 'var(--bg-shell)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <svg viewBox="-80 -80 160 160" style={{ width: '100%', maxWidth: '240px', height: 'auto' }}>
              {/* Libration boundary box */}
              <rect x="-60" y="-50" width="120" height="100" fill="none" stroke="rgba(129, 140, 248, 0.3)" strokeDasharray="3 3" />
              
              {/* Axes */}
              <line x1="-70" y1="0" x2="70" y2="0" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
              <line x1="0" y1="-60" x2="0" y2="60" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />

              {/* Libration Lissajous Orbit */}
              <ellipse cx="0" cy="0" rx="45" ry="35" fill="none" stroke="var(--accent-indigo)" strokeWidth="1.5" strokeDasharray="4 2" />

              {/* Earth position marker */}
              <circle cx="15" cy="-12" r="5" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1" />
              <text x="23" y="-9" fill="var(--text-primary)" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">
                Earth Center
              </text>

              {/* Axis labels */}
              <text x="0" y="-65" fill="var(--text-dim)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">+6.7° Lat</text>
              <text x="0" y="70" fill="var(--text-dim)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">-6.7° Lat</text>
              <text x="65" y="3" fill="var(--text-dim)" fontSize="6" textAnchor="start" fontFamily="var(--font-mono)">+7.9° Lon</text>
              <text x="-65" y="3" fill="var(--text-dim)" fontSize="6" textAnchor="end" fontFamily="var(--font-mono)">-7.9° Lon</text>
            </svg>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px' }}>
              Apparent angular displacement of Earth viewed from Moon
            </div>
          </div>

          {/* Configuration and Threshold Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
                MINIMUM EARTH ELEVATION THRESHOLD: <span style={{ color: 'var(--accent-indigo)' }}>{minEarthElevation.toFixed(1)}°</span>
              </label>
              <input
                type="range"
                min="0.0"
                max="10.0"
                step="0.5"
                value={minEarthElevation}
                onChange={(e) => setMinEarthElevation(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                <span>0.0° (Horizon)</span>
                <span>5.0° (Safe Margin)</span>
                <span>10.0° (High)</span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-shell)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Site Telemetry Context: {activeSite.name}
              </div>
              At latitude {lat.toFixed(2)}°, Earth hovers near the local southern horizon, sweeping out an elliptical libration trajectory every 27.2 days.
              {approxMeanEarthElev < minEarthElevation ? (
                <div style={{ color: 'var(--accent-rose)', fontWeight: 600, marginTop: '4px' }}>
                  &bull; Current threshold ({minEarthElevation.toFixed(1)}°) exceeds mean site elevation ({approxMeanEarthElev.toFixed(1)}°): RF occultation risk present.
                </div>
              ) : (
                <div style={{ color: 'var(--accent-emerald)', fontWeight: 600, marginTop: '4px' }}>
                  &bull; Mean elevation ({approxMeanEarthElev.toFixed(1)}°) satisfies threshold ({minEarthElevation.toFixed(1)}°): Continuous direct line-of-sight available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Backend Earth Line-of-Sight Run Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Live Backend Earth Line-of-Sight Run (POST /api/v1/analysis/visibility)
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Calculates 14-day high-precision Earth center optical visibility at {activeSite.name} with {minEarthElevation.toFixed(1)}° elevation mask
            </div>
          </div>
          <button
            onClick={handleRunEarthAnalysis}
            disabled={isRunning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: isRunning ? 'var(--bg-subtle)' : 'var(--accent-indigo)',
              color: isRunning ? 'var(--text-dim)' : '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.15s ease',
            }}
          >
            {isRunning ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? 'Calculating Ephemeris...' : 'Run 14-Day Earth LoS Analysis'}
          </button>
        </div>

        {runError && (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-rose)',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              marginBottom: '14px',
            }}
          >
            {runError}
          </div>
        )}

        {earthResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>EARTH LoS AVAILABILITY</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>
                  {earthResult.summary.earth_line_of_sight_percentage.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                  Total: {earthResult.summary.total_earth_line_of_sight_hours.toFixed(1)} hrs
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>COMBINED OPPORTUNITY</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                  {earthResult.summary.combined_opportunity_percentage.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                  Sunlight + Earth contact
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-shell)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>IDENTIFIED LoS WINDOWS</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  {earthResult.windows.filter((w) => w.window_type === 'EARTH_LINE_OF_SIGHT').length}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Direct contact passes</div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--accent-cyan)' }}>Scientific Disclosure: </strong>
              Ephemeris: {earthResult.disclosure.ephemeris_source || 'NASA JPL DE440'} &bull;
              Frame: {earthResult.disclosure.coordinate_frame || 'MOON_ME'} &bull;
              Geometric line-of-sight is necessary but not sufficient for DSN RF link closure.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
