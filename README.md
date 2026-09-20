# AEGIS AI — Inclusive Disaster Evacuation Router

> **"A route can be short but unsafe. The same street, the same flood, five different people, five different answers."**

AEGIS AI is a mission-critical emergency evacuation decision engine paired with a constrained natural-language explanation layer. It rejects the dangerous assumption of standard GPS mapping apps—that all citizens can traverse stairs, overcome 15cm unramped curbs, withstand 10% inclines, or walk at 5 km/h while a flash flood overtakes urban corridors.

---

## Architecture Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                      AEGIS AI ARCHITECTURE                                        |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
                                     +--------------------------+
                                     |  Next.js EOC Dashboard   |
                                     |  (Desktop/Tablet Console)|
                                     +--------------------------+
                                                  |
                                                  | Dispatch request (inputs only)
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                  DETERMINISTIC SAFETY ENGINE                                      |
|                                                                                                   |
|  +------------------------+      +-------------------------+      +----------------------------+  |
|  | Katpadi Street Graph   | ---> | Weights-Driven Costs    | ---> | Multi-Sink Time-Dependent  |  |
|  | (160 nodes, 174 edges) |      | (5 accessibility profiles)     | Binary Heap Dijkstra       |  |
|  +------------------------+      +-------------------------+      +----------------------------+  |
|                                                                                 |                 |
|  +------------------------+      +-------------------------+                    v                 |
|  | Precomputed Flood Poly |      | Shelter Capacity Engine | <--- [Earliest Reachable Shelter]    |
|  | (0-30 min cache)       |      | (Baseline + Background) |                                      |
|  +------------------------+      +-------------------------+                                      |
|                                                  |                                                |
|                                                  v                                                |
|                            [Structured Evacuation Result & Telemetry]                             |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  | Strict One-Way Trust Boundary
                                                  | (Whitelisted facts only, never raw state)
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                CONSTRAINED EXPLANATION LAYER                                      |
|                                                                                                   |
|          +----------------------------+            +----------------------------------+           |
|          | Grounding Verifier         | <--------- | Gemini Model (server-only)       |           |
|          | (Rejects invented numbers) |            | (Concise emergency explanation)  |           |
|          +----------------------------+            +----------------------------------+           |
|                         |                                           |                             |
|       Ungrounded / Fail |                                           | Pass                        |
|                         v                                           v                             |
|          +----------------------------+            +----------------------------------+           |
|          | Verified Fallback Engine   |            | Grounded AI Explanation          |           |
|          | (100% offline & certified) |            | ("AI explanation · grounded")    |           |
|          +----------------------------+            +----------------------------------+           |
+---------------------------------------------------------------------------------------------------+
```

**Non-Negotiable Boundary**: Decisions flow strictly one way. Nothing Gemini returns ever flows back into the graph engine. Gemini does not calculate routes, does not determine accessibility, does not assign shelters, and does not alter graph weights.

---

## Where is the AI?

> **"Gemini doesn't decide who evacuates where. Our graph engine does. Gemini makes those decisions understandable to humans."**

In life-safety disaster operations, probabilistic black-box models hallucinate barriers, miscalculate flood velocities, and fail under pressure. In AEGIS AI:
1. **The Graph Engine Decides**: Multi-sink binary heap Dijkstra determines earliest feasible arrival across time-dependent flood depth curves, physical barrier profiles, and dynamic shelter occupancies.
2. **Gemini Explains**: Operating strictly behind a server-only trust boundary (`lib/gemini.ts`), Gemini translates compact factual facts into clear emergency briefings.
3. **Grounding Verification**: If Gemini hallucinates a single number not present in the engine context, the output is discarded and replaced with a verified deterministic system explanation.
4. **Zero-Downtime Fallback**: If offline, without an API key, or rate-limited, the system seamlessly outputs authoritative fallback explanations. The emergency console never stalls.

---

## How the Cost Function Works

The graph engine utilizes a single unified function:
```ts
computeEdgeCost(edge, fromNode, toNode, profile, context): { blocked, reasons, slowdown }
```
Profile behaviors live exclusively in the weights table (`/data/profiles.json`), allowing seamless generalization to any demographic or mobility condition:

- **Traversing Cost**: Expected traversal duration in seconds:
  $$\text{Cost} = \frac{\text{Distance}}{\text{Profile Speed}} \times \text{Slowdown Multiplier}$$
  Because traversal cost equals expected arrival time and flood impassability is monotonic, earliest arrival is guaranteed optimal (FIFO search property holds).

- **Hard Blocks vs. Penalties**:
  - **Wheelchair User (1.2 m/s)**: Hard-blocked by stairs, curbs $>5\text{cm}$, inclines $>8\%$, and rough surfaces (gravel, dirt, cobble). Slowdown increases with slope: $1 + 0.1 \times \max(0, \text{slope} - 4\%)$.
  - **Parent + Stroller (1.0 m/s)**: Hard-blocked by stairs, high curbs, steep slopes, and rough surfaces. Additional $1.3\times$ penalty for unsignalized multi-lane crossings.
  - **Mobility Limited (0.9 m/s)**: Hard-blocked by stairs only. Penalties for rough surfaces ($1.4\times$), high curbs ($1.3\times$), and inclines.
  - **Pregnant (1.0 m/s)**: No hard blocks. Multipliers for stairs ($2.5\times$), rough ground ($2.0\times$), and steep grades ($1.5\times$).
  - **Cognitive Accessibility (1.1 m/s)**: Penalties for complex intersections ($\text{deg} \ge 4 \implies 1 + 0.25 \times (\text{deg} - 3)$) and unsignalized multi-lane crossings ($2.0\times$); wayfinding discounts for landmark-rich nodes ($0.85\times$).

---

- **Data Sourcing**: Simulation dataset features a seeded, fictionalized street grid representing South Chennai (Velachery–Pallikaranai–Perungudi), anchored near Velachery (`[80.2120, 12.9620]`). All coordinates, elevations, and road attributes are deterministically generated by `/scripts/generate-data.ts`.
- **Precomputed Flood Polygons**: Flood polygons are generated once at build time for minutes 0–30 in `/data/floodPolygons.json` using Turf union/buffer. The runtime map uses instant object lookups with **zero per-frame Turf calls**.
- **Limitations**:
  - **Hazard Type**: Flood only (monsoon inundation surge spreading northward from the Pallikaranai marshland basin).
  - **Turn Penalties**: Turn-angle penalties are omitted (requires edge-expanded state space); cognitive profiles evaluate intersection complexity and lane crossings instead.
  - **Race Mode Route Commitment**: In Race Mode, the evacuee commits to the route computed at departure time $t_0$ without mid-walk replanning.

---

## Setup & Running Locally

### 1. Installation
```bash
npm install
```

### 2. Configure Gemini API Key (Optional)
Create `.env.local` in the root directory:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
*Note: If no key is provided, the application runs 100% offline using certified deterministic fallback explanations.*

### 3. Verification & Story Check
```bash
# Run Vitest test suite (50 tests passing)
npm test

# Run Story verification script (outputs exact demo telemetry)
npm run story
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in a desktop/tablet browser (optimized for 1280px / 1024px displays).

---

## 90-Second Stage Demo Script

*Presenter Fallback Note*: If Gemini is unavailable or offline, the app immediately shows the verified system explanation instead. The safety result never depended on it.

### Step 1: Meet Marcus & The Shortest Path Trap (0:00 - 0:15)
- **Action**: Select **Marcus (Wheelchair User)** at departure **T+00:00**.
- **Showcase**: Point to the **Compare Card**:
  - Standard GPS directs Marcus along **Pallikaranai Marsh Rd / Temple Steps**: `240m · 0 min walk — ✕ Steps on Temple Steps`.
  - Accessible Route routes around the barrier: `700m · 9.7 min safe — ✓ SAFE · +9.7 min margin` to **Govt School**.
  - Key takeaway: *"A standard route can be short, but completely impassable."*

### Step 2: Query the Explanation Layer (0:15 - 0:30)
- **Action**: Click the chip **"Why this route?"** in the **Ask AEGIS** panel.
- **Showcase**: Engine explains why Marcus detours around Temple Steps while verifying positive flood slack before water reaches impassable levels. Show the green source badge (*AI explanation · grounded in engine output* or *Verified system explanation*).

### Step 3: Profile Diversity (0:30 - 0:45)
- **Action**: Select **Priya (Pregnant)** at start `r1c4`.
- **Showcase**: Priya can navigate stairs with a slowdown penalty. She routes directly along Bazaar Steps to **District Sports Complex** (`350m · 6.5 min`), whereas a wheelchair user at `r1c4` detours to **Community Hall** (`600m · 8.3 min`).
- Key takeaway: *"The same street, the same flood, five different people, five different answers."*

### Step 4: Advance the Hazard Scrubber (0:45 - 1:05)
- **Action**: Drag the timeline scrubber labeled **"Evacuee departs at T+MM:SS"** to **T+08:00**.
- **Showcase**:
  - Blue floodwaters advance across row 0 and Velachery Main Rd.
  - Toast banner alerts: `ROUTE RECALCULATED`.
  - Safety pill transitions to amber: **TIGHT — +1.7 min margin**.
  - Advance to **T+10:00**: Corridor is flooded; full-width **NO SAFE EVACUATION ROUTE** banner triggers.
  - Ask **"What changed?"**: System confirms Velachery Main Rd flooded at minute 10.
  - Drag time back to **T+00:00** to demonstrate seamless instant recovery.

### Step 5: Shelter Saturation & Overflow Rerouting (1:05 - 1:20)
- **Action**: Slide the **"People evacuating"** slider from 10 to **50**.
- **Showcase**:
  - S1 (Govt School) capacity bars rise to **50/50 [FULL]**.
  - Toast: `SHELTER FULL — Govt School reached capacity`.
  - Engine automatically reroutes Marcus to **Community Hall** (`800m · 11.1 min`).
  - Click **"Why did the shelter change?"**: AEGIS AI confirms Govt School reached capacity and redirected traffic to the nearest reachable facility.

### Step 6: Live Race Mode Finale (1:20 - 1:30)
- **Action**: Click **⚡ RACE MODE**.
- **Showcase**:
  - Marcus commits to the route calculated at departure $t_0$ (no mid-walk replanning).
  - Evacuee marker navigates along the green path while the flood boundary creeps forward.
  - Real-time telemetry countdown: *"Flood reaches next street in 42s"*.
  - Citizen arrives safely at the shelter door just before the corridor submerges.