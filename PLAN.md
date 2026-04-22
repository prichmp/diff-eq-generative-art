# Differential Equation Generative Art — Plan

A static site (Vite + React + TypeScript) where a user enters a 2D system of differential equations, and the app numerically integrates many sample trajectories with RK4 and animates them as trails in a canvas. Points are seeded by Poisson-disk sampling across the domain (including an overshoot region outside the visible frame), so trails flow in from off-screen and the composition fills edge-to-edge. Each trail's color is derived from its seed position, producing a smooth, spatially-coherent color field.

## 1. Tech Stack

- **Build/dev**: Vite + React 19 + TypeScript, static output (deployable to any static host).
- **Rendering**: HTML5 Canvas 2D for MVP. Path-heavy scenes (10k+ segments/frame) can be migrated to WebGL later; Canvas 2D keeps the first pass simple.
- **Math parsing**: [`mathjs`](https://mathjs.org) to parse user input to an AST, then walk the AST and emit a pure JS function over a whitelist of node types (number, symbol, binary op, unary op, whitelisted math calls). This keeps us off `eval`/`Function`-of-user-strings while getting near-native speed in the RK4 inner loop — `math.compile().evaluate(scope)` is 10–100× slower than hand-written JS for trivial expressions, and the inner loop runs 4 × `steps` × `paths` times.
- **Numerics**: In-house classic explicit RK4.
- **Sampling**: Poisson-disk (Bridson) for even seed distribution; can toggle to uniform random for comparison.
- **Off-main-thread work**: Long simulations run in a Web Worker so the UI stays responsive.
- **State**: Plain React hooks; Zustand only if state sprawls.

## 2. User Input

Minimum controls (form on the left; canvas fills the rest):

- **dx/dt** expression — e.g. `sin(y) - 0.1 * x`
- **dy/dt** expression — e.g. `-sin(x) + 0.1 * y`
- **Domain** (xmin, xmax) — the y-range is derived from the canvas aspect ratio so sim space is isotropic with pixel space. Overshoot and the stop-box both extend symmetrically in sim units on both axes.
- **Density** — Poisson-disk minimum distance (controls number of trails).
- **Overshoot** — how far outside the visible frame seeds may start, in sim units. Constrained to ≤ stop-box radius so seeds don't terminate on step 1.
- **Simulation time** — total integration time. `dt` is derived as `time / steps`; `steps` has a sane default and is exposed as an advanced knob.
- **Real-time duration** — playback length in seconds before looping. Separate from simulation time; each animation frame interpolates into the precomputed path at fractional index `frame / totalFrames × (steps - 1)`. If `dt > 1/fps` the animation shows the integrator's resolution; pick `steps ≥ fps × realTimeSeconds` for smooth playback.
- **Color scheme** — corner rainbow gradient (default), HSL-from-angle, custom two-color.
- **Background / stroke width / trail opacity**.
- **Actions**: Render, Stop, Randomize, Save PNG, Save MP4 (optional, via `ffmpeg.wasm` — nice-to-have).

Preset gallery (a few tested equations) so the app is compelling on first load even without input.

## 3. Architecture

```
src/
  App.tsx                        # layout: controls panel + canvas stage
  components/
    ControlsPanel.tsx            # all user inputs, validation, presets
    CanvasStage.tsx              # canvas ref + animation loop
    EquationInput.tsx            # live-validated math expression field
  simulation/
    rk4.ts                       # explicitRungeKutta4
    sampling.ts                  # poissonDiskSampling, uniformSampling (seeded RNG)
    compileEquation.ts           # mathjs parse → AST-walk → JS function (x,y,t)=>[dx,dy]
    simulate.ts                  # runs sampling + RK4 for all seeds
    worker.ts                    # Web Worker wrapper around simulate
  render/
    pixelSpace.ts                # sim-space → pixel-space conversion + per-frame slicing
    animator.ts                  # requestAnimationFrame loop, trail drawing
    colorSchemes.ts              # cornerRainbowGradient, HSL, etc.
  types.ts                       # ProblemAndSettings, SimulationResult, etc.
  presets.ts
  main.tsx / index.html
```

## 4. Data Flow

1. User edits the form. On "Render" (or debounced change), we build a `ProblemAndSettings` object (including a reproducibility seed — see §7).
2. Main thread posts it to the worker.
3. Worker:
   - Compiles the two expressions (mathjs parse → AST walk → JS function).
   - Generates seeds via Poisson-disk over the overshoot-expanded domain, using a seeded RNG.
   - For each seed, runs RK4 until it either (a) completes the configured time, (b) leaves the stop-box (2× the visible domain on each axis), or (c) produces a non-finite value at any step.
   - Packs results as a single transferable `Float32Array` (or one per path) plus an offsets table, so the postMessage is a **transfer**, not a structured clone.
4. Main thread converts to pixel space and pre-slices into per-frame positions: linear interpolation to land on evenly-spaced animation frames.
5. Animation loop draws one frame at a time, leaving trails behind.

## 5. Simulation Details

- **RK4**: classic 4th-order explicit. Signature: `explicitRungeKutta4(problem, { time, steps, stops, initialConditions })`.
- **Stop boxes**: terminate a trajectory if it leaves 2× the visible domain (on either axis) — prevents wasted compute on paths that have left the canvas for good. Won't catch paths that exit and re-enter; in practice this is rare for the dissipative / rotational fields the app targets.
- **Per-step guard**: if RK4 produces `NaN` or `Infinity` (e.g. `log(y)` with y→0, or a blow-up), terminate *that* trajectory at the last finite state rather than poisoning the whole render.
- **Seeds**: Poisson-disk with an `overshoot` pad around the domain (constrained ≤ stop-box) so some fraction of trajectories start off-canvas and sweep in during animation. Uses a seeded RNG so the same `ProblemAndSettings` always produces the same output.
- **Frames**: `framesPerSecond * realTimeSeconds`. For each `(path, frame)`, compute a fractional index into the path's point array and linearly interpolate position.

## 6. Rendering / Trails

Per frame:
- **Fading trails (default)**: draw a translucent background rect over the whole canvas (e.g. `rgba(bg, 0.04)`) each frame to slowly fade old ink, then draw a short segment from each trail's previous position to its current one. The full-canvas fill is a non-trivial cost at DPR ≥ 2 — budget it, and skip it entirely in permanent-trails mode.
- **Permanent trails**: skip the fade; every segment persists. Produces denser, painterly output — the single-image / print mode.
- Stroke color is computed **once per trail** from its seed position via the selected color scheme. Trails do not encode time; this is a deliberate choice to keep the color field spatially coherent.
- Canvas is sized to device pixel ratio; resize handler re-renders.

## 7. Equation Compilation & Safety

- User input is text. `mathjs` parses to an AST; we walk the AST and build a JS function closed over a whitelist of operators (`+ - * / ^ unary-`) and math calls (`sin`, `cos`, `tan`, `exp`, `log`, `sqrt`, `abs`, `atan2`, `min`, `max`, `pow`, `floor`, `ceil`, `sign`, plus `pi`, `e`). Any other node type (function definition, assignment, unknown symbol) is rejected at parse time. No access to globals, no user text ever passed to `Function` / `eval`.
- Validate before running: compile, evaluate once at `(0, 0, 0)` and at a small random sample of in-domain points, confirm results are finite. Surface parse/eval errors inline under the input. The per-step NaN/Inf guard (§5) handles blow-ups that only appear along a trajectory.
- **Reproducibility**: `ProblemAndSettings` carries an explicit `seed: number` used by the Poisson-disk sampler and any randomized color choice. "Randomize" just picks a new seed. Share-as-URL encodes seed + settings, so the same link always reproduces the same art.
- **Guardrails** — concrete caps, enforced in both the UI and the worker:
  - `paths ≤ 50_000`
  - `steps ≤ 20_000` per path
  - `steps × paths ≤ 100_000_000` total RK4 evaluations
  - `realTimeSeconds ≤ 120`, `fps ∈ [24, 60]`
  - reject `overshoot > stopBoxRadius`

## 8. Milestones

1. **Scaffold**: `npm create vite@latest` → React+TS template; set up folder structure and a blank canvas.
2. **Solver + sampling**: implement `explicitRungeKutta4` and Poisson-disk (seeded); unit test with a known system (e.g. a linear spiral, closed-form comparison).
3. **Static render**: hard-code one equation, simulate on main thread, draw all paths as static polylines. Verify coloring and pixel-space mapping visually against a known good reference image.
4. **Animation**: add the frame-slicing pass and the rAF trail-drawing loop. Add fade-vs-permanent toggle.
5. **UI**: ControlsPanel with equation inputs + mathjs compilation + inline validation; preset gallery.
6. **Worker**: move simulation off the main thread; add a progress indicator.
7. **Polish**: color schemes, responsive canvas, PNG export, share-as-URL (encode settings in query string).
8. **Stretch**: MP4 export via `ffmpeg.wasm`; WebGL renderer for high path counts; audio sonification of the field.

## 9. Open Questions

- **2D only, or also 3D-projected?** Starting with 2D (`dx/dt`, `dy/dt`). 3D adds a projection step and camera controls — defer.
- **Time dependence?** Allow `t` in expressions (non-autonomous systems) — cheap to support in the compiled evaluator; include from day one. Caveat: non-autonomous systems don't loop cleanly, so the animation's loop point will visibly jump. Either disable looping when any expression references `t`, or mark those presets as "one-shot."
- **How live is "live"?** Pre-simulate-then-play is smoother and supports clean looping for autonomous systems; stepping per frame is more "alive" but stutters under load. Default to pre-simulate; revisit if it feels lifeless.
