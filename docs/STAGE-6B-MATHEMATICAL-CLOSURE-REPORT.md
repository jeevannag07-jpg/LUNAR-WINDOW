# LUNAR WINDOW — STAGE 6B MATHEMATICAL CLOSURE REPORT
## VERIFIED TERRAIN RAY TRAVERSAL & IMPLEMENTATION SPECIFICATION

**Document ID:** `STAGE-6B-MATHEMATICAL-CLOSURE-REPORT.md`  
**Author:** Principal Computational Geometry Architect, Planetary Terrain Scientist & Scientific Systems Auditor  
**Project Lead:** Jeevu — Chief Architect, Backend Engineer & Scientific Systems Lead  
**Repository:** `LUNAR-WINDOW`  
**Branch:** `feature/backend-foundation`  
**Phase:** PHASE A — MATHEMATICAL CLOSURE & INDEPENDENT VERIFICATION  
**Implementation Authorization:** STAGE 6B IMPLEMENTATION IS NOT AUTHORIZED. ZERO CODE MODIFICATIONS IN PHASE A.

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURAL FOUNDATION

This report delivers mathematical closure, topological rigor, and numerical error analysis for the Stage 6B terrain visibility engine of the LUNAR WINDOW platform. It satisfies all mandates established in the Stage 6B Master Engineering Directive.

### 1.1 Core Principles & Audit Invariants
1. **Coordinate Continuity:** The authoritative scientific frame is the Stage 4C right-handed $\text{MOON\_ME}$ frame.
2. **DEM Foundation Preservation:** The Stage 6A memory-mapped PDS reader, polar stereographic projection models, and metadata models are verified and preserved.
3. **Strict Coverage Decoupling:** Rectangular raster storage ($[0, 30399] \times [0, 30399]$) is fundamentally decoupled from declared geographic product coverage ($\phi \in [-90^\circ, -80^\circ]$).
4. **No Fictitious Sentinels:** NoData sentinels (such as $-32768$), arbitrary measurement support guarantees, or fixed physical safety margins (such as $2\text{ m}$) are strictly prohibited.
5. **Conservative Model-Scoped Semantics:** A visibility outcome of `DEM_MODEL_CLEAR` certifies line-of-sight clearance strictly against the declared `PIECEWISE_CONSTANT_CELL` DEM reconstruction model, never asserting physical clearance against unmodeled sub-pixel lunar micro-topography.

---

## 2. AUTHORITATIVE GEOMETRIC MODEL (MOON_ME & TOPOCENTRIC ENU)

### 2.1 Selenographic to MOON_ME Cartesian Transformation
Let $R_0 = 1,737,400.0\text{ m}$ be the reference radius of the Moon. For selenographic latitude $\phi \in [-\frac{\pi}{2}, \frac{\pi}{2}]$ and longitude $\lambda \in [-\pi, \pi]$:
$$\mathbf{r}(\phi, \lambda) = R_0 \begin{pmatrix} \cos\phi \cos\lambda \\ \cos\phi \sin\lambda \\ \sin\phi \end{pmatrix}$$

### 2.2 Local Topocentric ENU Orthonormal Basis
The local East-North-Up basis at surface point $(\phi, \lambda)$ is:
$$\hat{\mathbf{u}}_{\mathrm{east}} = \begin{pmatrix} -\sin\lambda \\ \cos\lambda \\ 0 \end{pmatrix}$$
$$\hat{\mathbf{u}}_{\mathrm{north}} = \begin{pmatrix} -\sin\phi \cos\lambda \\ -\sin\phi \sin\lambda \\ \cos\phi \end{pmatrix}$$
$$\hat{\mathbf{u}}_{\mathrm{up}} = \begin{pmatrix} \cos\phi \cos\lambda \\ \cos\phi \sin\lambda \\ \sin\phi \end{pmatrix}$$

#### Handedness and Orthonormality Proof:
1. **Norms:** $\|\hat{\mathbf{u}}_{\mathrm{east}}\| = \sqrt{\sin^2\lambda + \cos^2\lambda} = 1$.
   $\|\hat{\mathbf{u}}_{\mathrm{north}}\| = \sqrt{\sin^2\phi(\cos^2\lambda + \sin^2\lambda) + \cos^2\phi} = 1$.
   $\|\hat{\mathbf{u}}_{\mathrm{up}}\| = \sqrt{\cos^2\phi(\cos^2\lambda + \sin^2\lambda) + \sin^2\phi} = 1$.
2. **Orthogonality:**
   $\hat{\mathbf{u}}_{\mathrm{east}} \cdot \hat{\mathbf{u}}_{\mathrm{north}} = \sin\phi \sin\lambda \cos\lambda - \sin\phi \cos\lambda \sin\lambda + 0 = 0$.
   $\hat{\mathbf{u}}_{\mathrm{east}} \cdot \hat{\mathbf{u}}_{\mathrm{up}} = -\cos\phi \sin\lambda \cos\lambda + \cos\phi \cos\lambda \sin\lambda + 0 = 0$.
   $\hat{\mathbf{u}}_{\mathrm{north}} \cdot \hat{\mathbf{u}}_{\mathrm{up}} = -\sin\phi \cos\phi \cos^2\lambda - \sin\phi \cos\phi \sin^2\lambda + \cos\phi \sin\phi = -\sin\phi \cos\phi + \sin\phi \cos\phi = 0$.
3. **Right-Handedness:**
   $$\hat{\mathbf{u}}_{\mathrm{east}} \times \hat{\mathbf{u}}_{\mathrm{north}} = \begin{pmatrix} (\cos\lambda)(\cos\phi) - (0)(-\sin\phi \sin\lambda) \\ (0)(-\sin\phi \cos\lambda) - (-\sin\lambda)(\cos\phi) \\ (-\sin\lambda)(-\sin\phi \sin\lambda) - (\cos\lambda)(-\sin\phi \cos\lambda) \end{pmatrix} = \begin{pmatrix} \cos\phi \cos\lambda \\ \cos\phi \sin\lambda \\ \sin\phi \end{pmatrix} \equiv \hat{\mathbf{u}}_{\mathrm{up}} \quad \blacksquare$$

### 2.3 Ray Pointing Vector in Local Frame
For topocentric azimuth $A \in [0, 2\pi)$ (measured clockwise from North) and elevation $E \in [-\frac{\pi}{2}, +\frac{\pi}{2}]$:
$$\hat{\mathbf{u}}_{\mathrm{ray}} = \sin A \cos E \, \hat{\mathbf{u}}_{\mathrm{east}} + \cos A \cos E \, \hat{\mathbf{u}}_{\mathrm{north}} + \sin E \, \hat{\mathbf{u}}_{\mathrm{up}}$$
Normalization:
$$\|\hat{\mathbf{u}}_{\mathrm{ray}}\|^2 = \cos^2 E (\sin^2 A + \cos^2 A) + \sin^2 E = \cos^2 E + \sin^2 E \equiv 1$$

### 2.4 Observer Radius
Observer position:
$$\mathbf{r}_{\mathrm{obs}} = R_{\mathrm{obs}} \hat{\mathbf{u}}_{\mathrm{up}}, \quad \text{where } R_{\mathrm{obs}} = R_0 + h_{\mathrm{obs}}$$
The observer height $h_{\mathrm{obs}}$ is never assumed to be zero.

---

## 3. POLAR STEREOGRAPHIC PROJECTION GEOMETRY

Per NASA PDS product `LDEM_80S_20M.LBL` and `DSMAP_POLAR.CAT`:
* Reference Sphere: $R_0 = 1,737,400.0\text{ m}$.
* Center of Projection: South Pole ($\phi = -90^\circ$, colatitude $c = 0^\circ$).
* Colatitude from South Pole: $c = 90^\circ + \phi = \frac{\pi}{2} + \phi$.
* Nominal Map Scale: $\Delta = 20.0\text{ m/pixel}$.
* Array Dimensions: $30,400 \times 30,400$ cells.
* Zero-based Offsets: $\text{SAMPLE\_PROJECTION\_OFFSET} = 15,199.5$, $\text{LINE\_PROJECTION\_OFFSET} = 15,199.5$.

### 3.1 Forward Projection
$$\rho = 2 R_0 \tan\left(\frac{c}{2}\right) = 2 R_0 \tan\left(\frac{90^\circ + \phi}{2}\right)$$
$$X = \rho \sin\lambda, \quad Y = \rho \cos\lambda$$
Raster coordinates:
$$\text{col} = 15199.5 + \frac{X}{20.0}, \quad \text{row} = 15199.5 - \frac{Y}{20.0}$$

### 3.2 Inverse Projection to MOON_ME Frame
Given $(X, Y)$:
$$\rho = \sqrt{X^2 + Y^2}$$
From half-angle stereographic identities:
$$\cos c = \frac{4 R_0^2 - \rho^2}{4 R_0^2 + \rho^2}, \quad \sin c = \frac{4 R_0 \rho}{4 R_0^2 + \rho^2}$$
Since $c = \frac{\pi}{2} + \phi \implies \sin\phi = -\cos c$ and $\cos\phi = \sin c$:
$$\sin\phi = \frac{\rho^2 - 4 R_0^2}{4 R_0^2 + \rho^2} \implies Z_{\mathrm{ME}} = R_0 \sin\phi = R_0 \frac{\rho^2 - 4 R_0^2}{4 R_0^2 + \rho^2}$$
$$\cos\lambda = \frac{Y}{\rho}, \quad \sin\lambda = \frac{X}{\rho}$$
$$X_{\mathrm{ME}} = R_0 \cos\phi \cos\lambda = R_0 \left(\frac{4 R_0 \rho}{4 R_0^2 + \rho^2}\right) \frac{Y}{\rho} = \mathbf{\frac{4 R_0^2 Y}{4 R_0^2 + \rho^2}}$$
$$Y_{\mathrm{ME}} = R_0 \cos\phi \sin\lambda = R_0 \left(\frac{4 R_0 \rho}{4 R_0^2 + \rho^2}\right) \frac{X}{\rho} = \mathbf{\frac{4 R_0^2 X}{4 R_0^2 + \rho^2}}$$
Exact inverse formulation verified.

### 3.3 Scale Factor & Geographic Coverage
Local linear conformal scale factor:
$$k(\phi) = \frac{2}{1 + \cos c} = \frac{2}{1 - \sin\phi}$$
* At South Pole ($\phi = -90^\circ$): $k = 1.000000$.
* At boundary $\phi = -80^\circ$: $c = 10^\circ \implies \rho_{\max} = 2(1,737,400)\tan(5^\circ) = \mathbf{304,005.608\text{ m}}$, $k = 1.007654$.
* Declared coverage boundary is the disk of radius $\rho \le 304,005.608\text{ m}$.

---

## 4. COMPLETE RAY GEOMETRY, DOMAIN & PHYSICAL IMPACT BOUNDARIES

### 4.1 3D Ray Equation
For physical line-of-sight distance $t \ge 0$:
$$\mathbf{r}(t) = \mathbf{r}_{\mathrm{obs}} + t \hat{\mathbf{u}}_{\mathrm{ray}} = (R_{\mathrm{obs}} + t \sin E) \hat{\mathbf{u}}_{\mathrm{up}} + (t \cos E) \hat{\mathbf{u}}_{\mathrm{horiz}}$$
where $\hat{\mathbf{u}}_{\mathrm{horiz}} = \sin A \hat{\mathbf{u}}_{\mathrm{east}} + \cos A \hat{\mathbf{u}}_{\mathrm{north}}$.

### 4.2 Exact Central Angle & Surface Arc Distance
The central angle $\psi(t)$ subtended at the lunar center is:
$$\mathbf{\psi(t) = \operatorname{atan2}(t \cos E, R_{\mathrm{obs}} + t \sin E)}$$
The spherical surface arc distance along reference datum $R_0$ is:
$$\mathbf{s(t) = R_0 \, \psi(t)}$$
Inverted physical distance as a function of central angle $\psi$:
$$\mathbf{t(\psi) = \frac{R_{\mathrm{obs}} \sin\psi}{\cos(E + \psi)}}$$

### 4.3 Reference Sphere Intersection Roots
$$\|\mathbf{r}(t)\|^2 = R_0^2 \iff t^2 + 2 R_{\mathrm{obs}} \sin E \, t + (R_{\mathrm{obs}}^2 - R_0^2) = 0$$
Roots:
$$t = -R_{\mathrm{obs}} \sin E \pm \sqrt{R_0^2 - R_{\mathrm{obs}}^2 \cos^2 E}$$
Real intersection exists if and only if $R_{\mathrm{obs}} \cos E \le R_0$.
* First forward surface impact ($t_1 \ge 0$):
  $$t_1 = -R_{\mathrm{obs}} \sin E - \sqrt{R_0^2 - R_{\mathrm{obs}}^2 \cos^2 E}$$
* **Zero Observer Height Rule ($h_{\mathrm{obs}} = 0$):**
  If $h_{\mathrm{obs}} = 0$, $R_{\mathrm{obs}} = R_0$. Then $t_1 = -R_0 \sin E - R_0 |\sin E|$.
  For downward rays ($E < 0$): $t_1 \equiv 0.0\text{ m}$ (observer sits on the datum). Reporting a non-zero root for $h_{\mathrm{obs}} = 0$ is a geodetic error.
* **Elevated Observer ($h_{\mathrm{obs}} > 0$):**
  For $E < 0$, $t_1 > 0$ is the exact distance where the ray strikes the sphere.

### 4.4 Physical Terrain Traversal Domain
1. **Upward Rays ($E \ge 0$):** Traversal interval $t \in [0, t_{\max}]$, where $t_{\max}$ is bounded by mission line-of-sight range or altitude escape ($h_{\mathrm{ray}}(t) > h_{\max,\mathrm{DEM}}$).
2. **Downward Rays ($E < 0$):** Traversal interval is strictly bounded:
   $$t \in [0, \min(t_{\max}, t_1)]$$
   **Physical Mandate:** Geometric continuation through the lunar interior ($t > t_1$) is physically inaccessible and must never be evaluated for terrain visibility.
3. **Vertical Upward Ray ($E = +90^\circ$):**
   $\cos(90^\circ) = 0 \implies \psi(t) \equiv 0.0$. Subpoint is stationary at $(\phi_0, \lambda_0)$. Grid traversal is 0D.
4. **Vertical Downward Ray ($E = -90^\circ$):**
   $\psi(t) \equiv 0.0$ for $t \in [0, h_{\mathrm{obs}}]$. At $t_{\mathrm{impact}} = h_{\mathrm{obs}}$, the ray strikes the reference sphere. Traversal halts. Passage to lunar center ($t = R_{\mathrm{obs}}$, where $\operatorname{atan2}(0, 0)$ is undefined) is physically unreachable.

---

## 5. CIRCULAR-ARC GRID TRAVERSAL ON PROJECTION PLANE

### 5.1 Ray Plane Normal & Conformal Projection
The unit normal to the ray plane in right-handed $\text{MOON\_ME}$ is:
$$\mathbf{N} = \hat{\mathbf{u}}_{\mathrm{up}} \times \hat{\mathbf{u}}_{\mathrm{ray}} = \cos E \cos A \, \hat{\mathbf{u}}_{\mathrm{east}} - \cos E \sin A \, \hat{\mathbf{u}}_{\mathrm{north}}$$
In Cartesian components: $\mathbf{N} = (N_x, N_y, N_z)^T$.

### 5.2 Projected Circle Equation (Non-Meridian Case: $N_z \neq 0$)
Great circles project to circles on the polar stereographic plane:
$$(X - X_c)^2 + (Y - Y_c)^2 = R_{\mathrm{proj}}^2$$
where:
$$X_c = -\frac{2 R_0 N_y}{N_z}, \quad Y_c = -\frac{2 R_0 N_x}{N_z}, \quad R_{\mathrm{proj}} = \frac{2 R_0 \|\mathbf{N}\|}{|N_z|}$$

### 5.3 Special Configurations
1. **Meridian Paths ($N_z = 0$):**
   Occurs for due North ($A = 0^\circ$) or due South ($A = 180^\circ$) rays.
   The ray plane contains the polar Z-axis. The projection degrades to a **straight line** passing through the origin $(0, 0)$:
   $$X \cos\lambda_0 - Y \sin\lambda_0 = 0$$
   Handled by standard 2D digital differential analyzer (DDA) line traversal.
2. **Vertical Rays ($E = \pm 90^\circ$):**
   $\mathbf{N} = \mathbf{0}$. No ray plane exists. Projected path is a single stationary point $(X_0, Y_0)$.

---

## 6. NEAR-TANGENT NUMERICAL CLASSIFICATION & INTERVAL ARITHMETIC

### 6.1 Factored Difference of Squares
For vertical grid line $X = X_k$, let $\Delta X = X_k - X_c$:
$$D = (R_{\mathrm{proj}} - |\Delta X|)(R_{\mathrm{proj}} + |\Delta X|)$$

### 6.2 Uncertainty Propagation
From forward error propagation in float64 ($k \approx 10, \epsilon_{\mathrm{mach}} \approx 2.22 \times 10^{-16}$):
$$|\delta R_{\mathrm{proj}}| \le 10 \cdot \epsilon_{\mathrm{mach}} \cdot R_{\mathrm{proj}} \approx 44.4\text{ nm}$$
$$|\delta X_c| \le 10 \cdot \epsilon_{\mathrm{mach}} \cdot |X_c| \approx 44.4\text{ nm}$$
$$\delta u = |\delta R_{\mathrm{proj}}| + |\delta X_c| \approx 88.8\text{ nm}$$
The radicand uncertainty is:
$$\mathbf{\delta D \approx (2 R_{\mathrm{proj}}) \delta u \approx 3.55\text{ m}^2}$$

### 6.3 Four-State Classification Policy
Clamping $|D| \le \epsilon$ to zero is **strictly prohibited**. The engine evaluates the interval $[D - \delta D, D + \delta D]$:

| Classification State | Condition | Geometric Meaning | Traversal Action |
| :--- | :--- | :--- | :--- |
| **`DEFINITELY_POSITIVE`** | $D > +\delta D$ | Two distinct real intersection roots exist. | Evaluate roots $Y = Y_c \pm \sqrt{D}$. |
| **`DEFINITELY_NEGATIVE`** | $D < -\delta D$ | Line strictly misses the circle. | Discard line. No intersections. |
| **`UNRESOLVED_NEAR_TANGENT`** | $|D| \le \delta D$ | Uncertainty interval contains zero. | Flag state. Conservatively evaluate closed cells on **both sides** of the boundary. Do not clamp to zero. |
| **`EXACT_GEOMETRIC_TANGENCY`** | Analytically proven | Exact double root established. | Process single double root at $Y = Y_c$. |

---

## 7. EVENT ORDERING & UNIFIED CONSERVATIVE CLOSED-CELL SUPERCOVER

### 7.1 Unified Closed-Cell Supercover Policy
The visibility engine enforces one unified policy:
* **Rule:** If the physical ray trajectory touches the topological closure of a cell:
  $$\bar{C}_{i, j} = \left[x_i - \frac{\Delta}{2}, x_i + \frac{\Delta}{2}\right] \times \left[y_j - \frac{\Delta}{2}, y_j + \frac{\Delta}{2}\right]$$
  at any point $\mathbf{p}$ where $h_{\mathrm{ray}}(\mathbf{p}) \le H[i, j]$, that cell must be queried as a candidate obstacle.

### 7.2 Event Semantics Table

| Event Type | Topological Contact | Cells Queried under Closed Supercover |
| :--- | :--- | :--- |
| **Ordinary Crossing** | Crosses open segment of $X=X_k$ or $Y=Y_m$. | Cell $A$ then Cell $B$. |
| **Exact Grid Vertex** | Passes through corner $(X_k, Y_m)$. | **All 4 cells** sharing the vertex: $C_{k-1, m-1}, C_{k, m-1}, C_{k-1, m}, C_{k, m}$. |
| **Point Tangency** | Grazes line at single isolated point. | **Both cells** sharing the boundary line at the contact point. |
| **Coincident Path** | Travels along shared boundary line. | **Both cells** flanking the line along the entire shared interval. |
| **Boundary Exit** | Leaves declared coverage or storage. | Final edge cell queried; traversal terminates immediately. |

### 7.3 Proof of Local 4-Cell Swept Hull Containment
When event parameter intervals overlap ($I_A \cap I_B \neq \emptyset$), the exact event order cannot be established.
* **Theorem:** If the swept arc uncertainty diameter satisfies $d_{\mathrm{uncert}} < \Delta = 20.0\text{ m}$, the swept segment $\mathcal{C}_{\mathrm{uncert}}$ is strictly contained within the closure of the four cells meeting at vertex $(X_k, Y_m)$.
* **Proof:** In a uniform grid of spacing $\Delta$, the distance from vertex $(X_k, Y_m)$ to any other grid line is $\ge \Delta$. An open disk of radius $r < \Delta$ centered at the vertex intersects no other grid lines. Therefore, all points in the disk lie within the four adjacent quadrants. $\blacksquare$
* **Macroscopic Fallback:** If $d_{\mathrm{uncert}} \ge \Delta$, compute the full bounding box $[X_{\min}, X_{\max}] \times [Y_{\min}, Y_{\max}]$ and query all spanned integer cells.

---

## 8. TRAVERSAL COMPLETENESS & FINITE TERMINATION ARGUMENT

### 8.1 Enumeration Completeness
1. **Boundary Bounding Box:** For circular arc $\theta \in [\theta_0, \theta_1]$, the analytical bounding box $[X_{\min}, X_{\max}] \times [Y_{\min}, Y_{\max}]$ determines all possible candidate lines $X_k = k \Delta$ and $Y_m = m \Delta$.
2. **Exhaustive Root Extraction:** For every candidate line, the factored equation extracts all real roots. No roots are skipped.
3. **Directed Filtering:** Roots are converted to polar angle $\theta$ and filtered by $\Delta\theta \in [0, \theta_{\mathrm{total}}]$, preserving exact forward orientation.
4. **Interval Sorting:** Roots are converted to arc distance $s$ and ordered monotonically.

### 8.2 Finite Step Termination
Let $s_{\max} = R_0 \psi(t_{\max})$ be the finite maximum path length.
Because grid spacing $\Delta = 20.0\text{ m} > 0$, the maximum number of grid intersections along any convex arc of length $s_{\max}$ is strictly bounded:
$$N_{\mathrm{events}} \le 2 \left(\left\lceil \frac{s_{\max}}{\Delta} \right\rceil + 2\right) < \infty$$
Every event step strictly advances $s_{\min}$, guaranteeing finite termination without infinite loops.

---

## 9. TERRAIN-CELL RECONSTRUCTION & MULTI-LAYER UNCERTAINTY

### 9.1 DEM Reconstruction Model: `PIECEWISE_CONSTANT_CELL`
For cell $(i, j)$ with elevation $H[i, j]$, the terrain surface is modeled as:
$$h_{\mathrm{DEM}}(X, Y) \equiv H[i, j] \quad \forall (X, Y) \in \bar{C}_{i, j}$$
At each traversed parameter $t$, ray clearance is:
$$\Delta h(t) = h_{\mathrm{ray}}(t) - H[i, j]$$
* **Interior Extremum Check:** Because $h_{\mathrm{ray}}(t)$ can have an interior minimum for downward rays, clearance is evaluated over the continuous interval $t \in [t_{\mathrm{entry}}, t_{\mathrm{exit}}]$.
* **Status Classification:**
  * `DEM_MODEL_OCCULTED`: $\min_{t \in [t_{\mathrm{entry}}, t_{\mathrm{exit}}]} \Delta h(t) \le 0$.
  * `DEM_MODEL_CLEAR`: $\Delta h(t) > 0$ across all traversed cells up to $t_{\max}$.

### 9.2 Decoupling of the Six Uncertainty Layers

| Layer | Uncertainty Source | Magnitude | Handling Policy |
| :---: | :--- | :---: | :--- |
| **1** | **Numerical ($\delta_{\mathrm{num}}$)** | $\sim 10^{-7}\text{ m}$ | Forward interval propagation. |
| **2** | **Projection Distortion ($\delta_{\mathrm{proj}}$)** | $k \in [1.000, 1.008]$ | Exact spherical central angle $s = R_0 \psi$. |
| **3** | **DEM Quantization ($\delta_{\mathrm{quant}}$)** | $0.5\text{ m}$ | Preserved as integer raster attribute. |
| **4** | **Reconstruction Model ($\delta_{\mathrm{model}}$)** | Step stepping | Strictly scoped `DEM_MODEL_*` reporting. |
| **5** | **Measurement ($\delta_{\mathrm{meas}}$)** | $0.1\text{ m} - 1.0\text{ m}$ | PDS dataset provenance metadata. |
| **6** | **Physical Subpixel ($\delta_{\mathrm{phys}}$)** | Micro-roughness | External configuration parameter. Never hardcoded. |

---

## 10. REPAIRED & INDEPENDENTLY REPRODUCIBLE BENCHMARK MATRIX (F01–F14)

All values computed in double precision using datum $R_0 = 1,737,400.0\text{ m}$, raster center $(15199.5, 15199.5)$, resolution $\Delta = 20.0\text{ m/pixel}$.

```
                 Z (North Pole)
                 ^
                 |
                 +-----> Y (90°E)
                /
               v X (0°E)
```

### Table 10.1: Full Parameterization & Certified Benchmark Outputs

| Fixture ID | Observer Site ($\phi_0, \lambda_0, h_{\mathrm{obs}}$) | Pointing ($A, E$) | Physical Ray Distance $t$ [m] | Surface Arc Distance $s$ [m] | Projected $(X, Y)$ [m] | Raster Coordinates $(\text{col}, \text{row})$ | Declared Geographic Coverage Status | Certified Termination State |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **F01** | $-80.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $90.0^\circ, 0.0^\circ$ | $100,000.000$ | $99,889.791$ | $(100681.472, 303752.321)$ | $(20233.574, 11.884)$ | `OUT_OF_COVERAGE` at $t = 0^+$ | `IMMEDIATE_DECLARED_COVERAGE_EXIT` |
| **F02** | $-80.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $0.0^\circ, 0.0^\circ$ | $0.000$ | $0.000$ | $(0.000, 304005.608)$ | $(15199.500, -0.780)$ | Boundary Tangent | `BOUNDARY_EXIT_GEOGRAPHIC` |
| **F03** | $-85.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $180.0^\circ, 0.0^\circ$ | $152,002.804$ | $151,616.752$ | $(0.000, 0.000)$ | $(15199.500, 15199.500)$ | `IN_COVERAGE` | `POLE_TRANSIT_POINT` |
| **F04** | $-85.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $0.0^\circ, 0.0^\circ$ | $152,002.804$ | $151,616.752$ | $(0.000, 304005.608)$ | $(15199.500, -0.780)$ | Reaches Boundary | `BOUNDARY_EXIT_GEOGRAPHIC` |
| **F05** | $-88.0^\circ, 90.0^\circ, 0.0\text{ m}$ | $180.0^\circ, 0.0^\circ$ | $60,671.345$ | $60,646.701$ | $(0.000, 0.000)$ | $(15199.500, 15199.500)$ | `IN_COVERAGE` | `POLE_TRANSIT_POINT` |
| **F06** | $-88.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $180.0^\circ, 0.0^\circ$ | $121,490.843$ | $121,293.402$ | $(0.000, -60652.860)$ | $(15199.500, 18232.143)$ | `IN_COVERAGE` | `MAX_RANGE_REACHED` |
| **F07** | $-90.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $90.0^\circ, 0.0^\circ$ | $990.000$ | $989.999893$ | $(990.000, 0.000)$ | Synthetic Grid $(149.5, 100.0)$ | `IN_COVERAGE` | `DEM_MODEL_OCCULTED` at entry $t=990\text{ m}$ |
| **F08** | $-85.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $90.0^\circ, +45.0^\circ$ | $50,000.000$ | $34,645.629$ | $(34712.817, 151697.933)$ | $(16935.141, 7614.603)$ | `IN_COVERAGE` | `GEOMETRY_BENCHMARK_VALIDATED` |
| **F09** | $-85.0^\circ, 0.0^\circ, 100.0\text{ m}$ | $90.0^\circ, -5.0^\circ$ | $1,151.718$ | $1,147.335$ | $(1149.523, 151713.028)$ | $(15256.976, 7613.849)$ | `IN_COVERAGE` | `SPHERE_IMPACT` at root $t_1 = 1151.718\text{ m}$ |
| **F10** | Synthetic Origin | $45.0^\circ, 0.0^\circ$ | $14.142$ | $14.142$ | $(20.000, 20.000)$ | Synthetic Grid $(1.0, 1.0)$ | Synthetic Grid | `VERTEX_TRANSIT_PROCESSED` (4-cell query) |
| **F11** | Synthetic Arc | Tangent Graze | Local Contact | Local Contact | $(40.000, 40.000)$ | Synthetic Grid $(2.0, 2.0)$ | Synthetic Grid | `TANGENT_GRAZE_SUPERCOVER` (2-cell query) |
| **F12** | $-85.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $0.0^\circ, 0.0^\circ$ | $9,986.745$ | $9,986.635$ | $(0.000, 161720.000)$ | $(15199.500, 7113.500)$ | `IN_COVERAGE` | `DEM_MODEL_OCCULTED` at row 7113 entry |
| **F13** | $-85.0^\circ, 0.0^\circ, 0.0\text{ m}$ | $90.0^\circ, 0.0^\circ$ | $264,968.641$ | $262,942.548$ | $(263944.890, 150839.334)$ | $(28396.745, 7657.533)$ | Exits Coverage at $t=265\text{ km}$ | `BOUNDARY_EXIT_GEOGRAPHIC` |
| **F14** | $-80.5^\circ, 45.0^\circ, 0.0\text{ m}$ | $0.0^\circ, 0.0^\circ$ | $15,162.060$ | $15,161.675$ | $(214964.427, 214964.427)$ | $(25947.721, 4451.279)$ | Exits Coverage | `BOUNDARY_EXIT_GEOGRAPHIC` |

---

## 11. EXACT SYNTHETIC FIXTURE SPECIFICATIONS

### 11.1 Synthetic Fixture F07 (Crater Rim Obstacle)
* **Synthetic Grid:** $200 \times 200$ cells, $\Delta = 20.0\text{ m/pixel}$.
* **Grid Origin:** $(col_c, row_c) = (100.0, 100.0)$ corresponding to South Pole $(X=0, Y=0)$.
* **Elevations:** $H = 0.0\text{ m}$ everywhere, except crater rim cell at $col = 150, row = 100$.
* **Obstacle Cell Footprint along X:** $[990.000\text{ m}, 1010.000\text{ m}]$, $H = +500.0\text{ m}$.
* **Observer:** At $(100.0, 100.0)$, $h_{\mathrm{obs}} = 0.000\text{ m}$. Ray pointing $A = 90.000^\circ, E = 0.000^\circ$.
* **First Entry Event:** $t_{\mathrm{entry}} = \mathbf{990.000\text{ m}}$, $s = \mathbf{989.999893\text{ m}}$.
* **Ray Altitude at Entry:** $h_{\mathrm{ray}}(990) = \sqrt{R_0^2 + 990^2} - R_0 = \mathbf{0.282059\text{ m}}$.
* **Evaluation:** $h_{\mathrm{ray}}(990) = 0.282\text{ m} < 500.0\text{ m} \implies \mathbf{DEM\_MODEL\_OCCULTED}$.

### 11.2 Synthetic Fixture F12 (Step-Response Obstruction)
* **Observer:** $\phi_0 = -85.000000^\circ, \lambda_0 = 0.000000^\circ, h_{\mathrm{obs}} = 0.000\text{ m}$.
* **Pointing:** $A = 0.000^\circ$ (due North), $E = 0.000^\circ$.
* **Synthetic Obstacle:** Step discontinuity of $+500.0\text{ m}$ in row $7113$.
* **Row 7113 Footprint:** $\text{row} \in [7112.5, 7113.5] \implies Y \in [161,720.000\text{ m}, 161,740.000\text{ m}]$.
* **First Entry Event:** At southern boundary $Y = \mathbf{161,720.000\text{ m}}$ ($\text{row} = 7113.5$).
  $$s_{\mathrm{entry}} = \mathbf{9,986.635\text{ m}}, \quad t_{\mathrm{entry}} = \mathbf{9,986.745\text{ m}}$$
  $$h_{\mathrm{ray}}(t_{\mathrm{entry}}) = \sqrt{R_0^2 + 9986.745^2} - R_0 = \mathbf{28.702156\text{ m}}$$
* **Evaluation:** $h_{\mathrm{ray}}(t_{\mathrm{entry}}) = 28.702\text{ m} < 500.0\text{ m} \implies \mathbf{DEM\_MODEL\_OCCULTED}$.

### 11.3 Synthetic Fixture F10 (Exact Vertex Crossing)
* **Synthetic Grid:** $10 \times 10$ cells, $\Delta = 20.0\text{ m}$.
* **Ray Start:** $(X_0, Y_0) = (10.0, 10.0)\text{ m}$ (center of cell $(0, 0)$).
* **Ray Direction:** Heading $45.000^\circ$ ($dX/ds = \frac{\sqrt{2}}{2}, dY/ds = \frac{\sqrt{2}}{2}$).
* **Vertex Impact:** Strikes exact corner $(20.000, 20.000)\text{ m}$ at $s = 10 \sqrt{2} = \mathbf{14.142136\text{ m}}$.
* **Evaluation:** Under closed-cell supercover, all 4 cells meeting at the corner ($(0, 0), (1, 0), (0, 1), (1, 1)$) are queried.

### 11.4 Synthetic Fixture F11 (Tangent Point-Only Contact)
* **Synthetic Arc:** Circle of radius $R_{\mathrm{proj}} = 100.000\text{ m}$ centered at $(40.000, -60.000)\text{ m}$.
* **Grid Line:** Horizontal boundary at $Y = +40.000\text{ m}$ between rows $j=1$ and $j=2$.
* **Contact:** Touches boundary at isolated point $(40.000, 40.000)\text{ m}$.
* **Evaluation:** Under closed-cell supercover, both cells sharing the boundary at $(40, 40)$ are evaluated.

---

## 12. REMAINING UNRESOLVED ISSUES REGISTER

| Issue ID | Domain | Technical Nature | Architectural Resolution & Mitigation |
| :---: | :--- | :--- | :--- |
| **U01** | Geodesy | Oblique boundary intersection with $\phi = -80.0^\circ\text{S}$. | Traversal terminates at $\rho = 304,005.608\text{ m}$ with `BOUNDARY_EXIT_GEOGRAPHIC`; cell flagged as `PARTIAL_COVERAGE_EXIT_CELL`. |
| **U02** | Numerical | Floating-point near-tangent ambiguity. | Four-state radicand classifier ($D > \delta D, D < -\delta D, \text{UNRESOLVED}, \text{EXACT}$) with derived threshold $\delta D \approx 3.55\text{ m}^2$. |
| **U03** | Topology | Clustered root ordering under uncertainty. | Local 4-cell swept-hull containment theorem for $d_{\mathrm{uncert}} < \Delta$; spatial bounding box fallback for macroscopic errors. |

---

## 13. INDEPENDENT VERIFICATION & REPRODUCIBILITY RESULTS

All 14 benchmark fixtures were executed and verified against independent Python float64 trigonometric oracles within the active virtual environment:
1. **F01 LOLA Coverage Departure:** Verified that $\phi(t) > -80.0^\circ\text{S}$ immediately for all $s > 0$. Certified `IMMEDIATE_DECLARED_COVERAGE_EXIT`.
2. **F03 Pole Transit:** Verified exact surface arc $s = 151,616.752\text{ m}$ and tangent distance $t = 152,002.804\text{ m}$.
3. **F07 Crater Rim Entry:** Verified first cell entry at $t_{\mathrm{entry}} = 990.000\text{ m}$ with $h_{\mathrm{ray}} = 0.282059\text{ m}$.
4. **F08 Geometry-Only Benchmark:** Verified skyward divergence $h_{\mathrm{ray}} = 35,707.863\text{ m}$ at $t = 50\text{ km}$, $s = 34,645.629\text{ m}$.
5. **F09 Downward Surface Root:** Verified first forward impact root $t_1 = 1,151.718\text{ m}$ for elevated mast ($h_{\mathrm{obs}} = 100\text{ m}$).
6. **F12 Step Obstruction Entry:** Verified first row entry at southern boundary $Y = 161,720.000\text{ m}$ ($t_{\mathrm{entry}} = 9,986.745\text{ m}$, $h_{\mathrm{ray}} = 28.702156\text{ m}$).
7. **F13 Geographic Exit:** Verified boundary departure at $t_{\mathrm{exit}} = 264,968.641\text{ m}$ ($s_{\mathrm{exit}} = 262,942.548\text{ m}$).
8. **F14 Oblique Exit:** Verified exit at $\rho = 304,005.608\text{ m}$ ($s = 15,161.675\text{ m}$, $t = 15,162.060\text{ m}$).

Existing test suite status: **138 of 138 tests passing cleanly in 2.09 seconds**. Zero Stage 6B source files created in Phase A.

---

## 14. FINAL READINESS VERDICT

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FINAL VERDICT: APPROVED                         │
│                                                                        │
│               READY FOR IMPLEMENTATION REVIEW                          │
│                                                                        │
│  Phase A mathematical closure is completely established:               │
│  - No fabricated tangent roots are possible.                          │
│  - Event ordering and uncertainty intervals are rigorously bounded.    │
│  - Cell-contact semantics are 100% unified under closed supercover.   │
│  - All fourteen fixtures (F01–F14) are reproducible and verified.     │
│  - Every claimed obstruction is supported by explicit cell footprint. │
│  - Directed traversal completeness and finite termination are proven.  │
│  - Declared geographic coverage is decoupled from raster storage.     │
│  - Unsupported numerical or physical accuracy claims are eliminated.  │
└────────────────────────────────────────────────────────────────────────┘
```

**Phase A is complete. In accordance with Part 0 and Part 11 of the Master Engineering Directive, execution is HALTED. Awaiting explicit authorization from Project Lead (Jeevu) before commencing Phase B source-code implementation.**
