# LUNAR WINDOW (v1.0-Demonstration)

### High-Precision Lunar Mission Planning & Candidate Site Evaluation Platform

**Project Lead:** Jeevan — Chief Architect, Backend Engineer & Scientific Systems Lead  
**Branch:** `feature/backend-foundation`  
**License:** Research / Academic Evaluation Baseline  
**Current Operational Status:** Final Production Release Baseline (156 Backend Tests Passing, 34 Frontend Tests Passing)

---

## 1. Mission Overview

**LUNAR WINDOW** is an aerospace-grade mission planning, topocentric geodesy, and operational decision-support platform designed for lunar south-polar surface exploration. The platform transforms raw planetary ephemerides and digital elevation data into deterministic mission windows:

$$\text{BUILD} \longrightarrow \text{ANALYZE} \longrightarrow \text{EVALUATE} \longrightarrow \text{COMPARE} \longrightarrow \text{DECIDE}$$

The platform models time-dependent illumination, direct-to-Earth geometric line-of-sight, lunar libration, local topographic masking, multi-site opportunity ranking, and high-precision interactive cartography.

---

## 2. Core Architectural Components

```
+---------------------------------------------------------------------------------------+
|                                    LUNAR WINDOW UI                                    |
|             (React 19, TypeScript, Vite, IBM Plex / Technical Monospace)              |
+-------------------------------------------+-------------------------------------------+
                                            |
                         HTTP JSON REST API | Reverse Proxy (:5173 -> :8000)
                                            v
+---------------------------------------------------------------------------------------+
|                               FASTAPI SCIENTIFIC BACKEND                              |
|                              (Python 3.14 / Uvicorn ASGI)                             |
+---------------------+---------------------+---------------------+---------------------+
|   HORIZONS CLIENT   |    SPICE MANAGER    |   TERRAIN ENGINE    |   DECISION ENGINE   |
| NASA Horizons REST  |   NAIF CSPICE C-lib | Polar Stereographic |  Multi-Site Scoring |
| Local In-Memory LRU |   Thread-Safe Lock  | 4-State Radicand    | Deterministic Rank  |
| DE440 State Vectors | DE440 / LSK / PCK   | DDA Supercover / Dip| Multi-Tier Tiebreak |
+---------------------+---------------------+---------------------+---------------------+
```

### 2.1. The 13 Application Areas

1. **Mission Control:** Live mission status, active site context, and backend readiness diagnostics.
2. **Lunar Atlas (Flagship):** Interactive South Polar Stereographic cartography engine featuring 5 toggleable layers, 14 IAU landmarks, Haversine geodesic ruler, real-time coordinate & DEM pixel HUD, and direct backend query triggers.
3. **Landing Site Intelligence (New):** Preliminary landing region screening, circular assessment region boundary HUD, transparent missing-data reporting (`DATA UNAVAILABLE`), explainable multi-tier ranking, $\ge 3$ candidate comparison matrix, and downloadable JSON, CSV, and printable PDF reports.
4. **Lunar Explorer:** Interactive South Polar Stereographic projection map ($\rho_{\text{max}} = 304,005.6\text{ m}$, $\phi \le -80.0^\circ\text{S}$) with forward and inverse Cartesian `MOON_ME` transformation.
5. **Site Intelligence:** Local topocentric orthonormal basis $(\mathbf{u}_{\text{east}}, \mathbf{u}_{\text{north}}, \mathbf{u}_{\text{up}})$ in `MOON_ME` with verified determinant $+1.0$ and live multi-site comparison.
6. **Solar Analysis:** Apparent solar disk center vs upper limb ($+0.267^\circ$ offset) grazing horizon illumination curves and 14-day continuous daylight/darkness analysis.
7. **Earth Visibility:** Sub-Earth libration box ($\pm 6.68^\circ$ lat, $\pm 7.92^\circ$ lon), 27.2-day draconic cycles, and direct optical line-of-sight contact passes.
8. **Terrain Analysis:** Stage 6B certified conformal circular ray traversal engine ($N_z \ne 0$), $\delta D \approx 3.55\text{ m}^2$ near-tangent classifier, conservative closed-cell supercover, 360° horizon profile queries, and F01–F14 benchmark suite.
9. **Mission Planner:** Surface stationary lander and rover sortie planning modes with temporal constraint validators ($[1, 1440]\text{ min}$ intervals, duration $\le 180\text{ days}$).
10. **Analysis Workspace:** Central mission execution console computing operational windows (`SUNLIGHT`, `DARKNESS`, `EARTH_LINE_OF_SIGHT`, `COMBINED_OPPORTUNITY`).
11. **Scientific Reports:** Formal scientific disclosure, geodetic parameters, documented physical assumptions, and printable engineering reports.
12. **Data & Sources:** Complete bibliographic and cryptographic provenance registry for NAIF SPICE kernels and NASA PDS LOLA datasets.
13. **Settings:** API base URL configuration, liveness probe (`/health`), and operational readiness probe (`/ready`).

---

## 3. Mathematical & Geodetic Standards

- **Reference Frame:** IAU Mean Earth / Polar Axis (`MOON_ME`), right-handed orthonormal coordinate system.
- **Reference Volumetric Datum:** Sphere with mean radius $R_0 = 1,737,400.0\text{ m}$ (IAU/PDS standard).
- **Time Standard:** Coordinated Universal Time (UTC) mapped to Ephemeris Time (ET / TDB) via NAIF SPICE leapseconds kernel `naif0012.tls`.
- **Planetary Ephemerides:** NASA JPL DE440 planetary and lunar ephemeris (`de440.bsp`).
- **Lunar Orientation:** High-precision sub-milliradian binary lunar mantle PCK (`moon_pa_de440_200628.bpc`) rotated into `MOON_ME`.
- **Polar Stereographic Projection:** Center latitude $-90.0^\circ\text{S}$, center longitude $0.0^\circ\text{E}$, grid resolution $20.0\text{ m/pixel}$, declared geographic boundary $\phi \le -80.0^\circ\text{S}$.

---

## 4. Installation & Local Startup

### Prerequisites
- Python 3.11+ (Python 3.14 verified)
- Node.js 18+ (Node.js v24.15 verified) and npm

### 4.1. Backend Setup & Startup
```powershell
# Navigate to backend directory
cd "LUNAR-WINDOW/backend"

# Activate Python virtual environment
.\.venv\Scripts\Activate.ps1

# (Optional) Run pytest test suite to verify baseline
pytest -v

# Launch the FastAPI Uvicorn server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Backend runs at: `http://127.0.0.1:8000` (API documentation at `http://127.0.0.1:8000/docs`).

### 4.2. Frontend Setup & Startup
```powershell
# In a separate terminal, navigate to frontend directory
cd "LUNAR-WINDOW/frontend"

# (Optional) Run vitest test suite
npm test

# Launch Vite development server
npm run dev -- --host 127.0.0.1 --port 5173
```
Frontend runs at: `http://127.0.0.1:5173/` (reverse-proxying `/api`, `/health`, `/ready` to port 8000).

---

## 5. Authoritative API Specifications

| Endpoint | Method | Purpose | Input / Parameters |
| :--- | :---: | :--- | :--- |
| `/health` | `GET` | System liveness probe | *None* |
| `/ready` | `GET` | Subsystem operational readiness probe | *None* |
| `/` | `GET` | Root project metadata | *None* |
| `/api/v1/analysis/visibility` | `POST` | Multi-day mission visibility evaluation | `MissionVisibilityRequest`: site, UTC start/end, interval, thresholds, terrain flag |
| `/api/v1/analysis/terrain/profile` | `POST` | 360-degree local horizon profile scan | `TerrainProfileRequest`: site, azimuth step $[0.5, 10.0]^\circ$, max distance $[5.0, 150.0]\text{ km}$ |
| `/api/v1/analysis/compare` | `POST` | Multi-site opportunity evaluation and ranking | `SiteComparisonRequest`: candidate sites ($1 \le N \le 20$), UTC start/end, interval |

---

## 6. Mandatory Scientific Disclosures & Limitations

1. **LOLA DEM Absence & Spherical Datum Fallback:**
   The 1.85 GB binary raster `LDEM_80S_20M.IMG` is not included in the source distribution. When the physical raster file is absent on disk, all terrain analysis endpoints automatically and honestly operate in `SPHERICAL_DATUM_ONLY` fallback mode ($R_0 = 1,737,400.0\text{ m}$). The UI explicitly discloses: `[TERRAIN FIDELITY: SPHERICAL_DATUM_ONLY]`.
2. **Optical Line-of-Sight vs RF Communications:**
   Calculations model topocentric vectors from the lunar surface to the Earth center disk. Geometric line-of-sight is a necessary kinematic condition, but does not guarantee RF link closure. RF link budget, ground station scheduling (NASA DSN / commercial networks), antenna gain, ionospheric scintillation, and local multi-path reflections are unmodeled.
3. **Sunlight Visibility vs Electrical Power Output:**
   Sunlight windows represent geometric visibility of the apparent solar disk (center of disk or upper limb). Solar panel incidence angle, regolith albedo, dust obscuration, and photovoltaic conversion efficiency are unmodeled.
4. **Deterministic Ranking & Tie-Breaking:**
   Composite opportunity scores combine sunlight opportunity (40%), Earth line-of-sight (35%), and simultaneous opportunity (25%), penalized by horizon obstruction. When candidate sites produce identical composite scores, deterministic secondary ranking is enforced via: (1) combined opportunity %, (2) sunlight %, (3) lowest horizon obstruction, and (4) alphabetical site ID.
5. **Operational Use Disclaimer:**
   LUNAR WINDOW is a mission planning, feasibility analysis, and decision-support prototype. Outputs are not certified for real-time spacecraft descent steering, hazard avoidance, or autonomous navigation.

---

## 7. Reproducible Demonstration Workflow

To conduct a live technical demonstration:
1. **Launch Both Servers:** Follow the steps in Section 4.
2. **Access Dashboard:** Open `http://127.0.0.1:5173` in a web browser. Verify the green `BACKEND ONLINE` or cyan `CORE ACTIVE` badge in the header.
3. **Select Candidate Site:** Select **Shackleton Connecting Ridge** from the header dropdown.
4. **Inspect Lunar Polar Coordinates:** Navigate to **Lunar Explorer**; observe the candidate pins on the South Polar Stereographic disk ($\phi \le -80^\circ$) and note Cartesian coordinates $(X_{\text{ME}}, Y_{\text{ME}}, Z_{\text{ME}})$.
5. **Generate Topographic Horizon Profile:** Navigate to **Terrain Analysis**; click **Compute Horizon Mask**; observe the 360° horizon profile SVG with the spherical datum dip ($-2.038^\circ$) and disclosure badge `[SPHERICAL_DATUM_ONLY]`.
6. **Execute 14-Day Solar Analysis:** Navigate to **Solar Analysis**; click **Run 14-Day Solar Analysis**; observe calculated sunlight duration and daylight streaks.
7. **Execute 14-Day Earth LoS Analysis:** Navigate to **Earth Visibility**; click **Run 14-Day Earth LoS Analysis**; observe contact pass windows and review the RF communication disclaimer.
8. **Run Multi-Site Comparison:** Navigate to **Site Intelligence**; click **Compare 5 Sites**; observe the ranked scorecard, winner identification, and deterministic tie-break disclosure notes.
9. **Execute Mission Workspace:** Navigate to **Analysis Workspace**; click **Execute Visibility Analysis**; review the segmented operational timeline (`SUNLIGHT`, `EARTH_OCCULTED`).
10. **Review Certified Report:** Navigate to **Scientific Reports**; inspect the formal engineering documentation and trigger native browser print/PDF export.

---

## 8. Verification & Test Suite Summary

- **Backend Pytest Suite:** 156 passed in 3.98s (`pytest -v`).
- **Frontend Vitest Suite:** 34 passed in 588ms (`vitest run`).
- **TypeScript Static Verification:** 0 errors (`npx tsc --noEmit`).
- **Production Asset Build:** Succeeded in 1.61s (`npm run build`).
- **Release Verification Report:** Formally documented in [`docs/FINAL-MILESTONE-DELIVERY-REPORT.md`](docs/FINAL-MILESTONE-DELIVERY-REPORT.md).
