import type { ColorScheme, ProblemAndSettings } from '../types';
import { CAPS } from '../types';
import { PRESETS } from '../presets';
import { EquationInput } from './EquationInput';
import { InfoTip } from './InfoTip';

interface Props {
  settings: ProblemAndSettings;
  onChange: (patch: Partial<ProblemAndSettings>) => void;
  onRender: () => void;
  onStop: () => void;
  onRandomize: () => void;
  onSavePng: () => void;
  busy: boolean;
  status: string;
  canRender: boolean;
  notice?: string | null;
}

function numberField(
  label: string,
  value: number,
  onChange: (v: number) => void,
  step: number,
  min: number | undefined,
  max: number | undefined,
  info: string,
) {
  return (
    <label>
      <span>
        {label}
        <InfoTip text={info} />
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}

const EXPR_INFO =
  'Variables: x, y, t. Functions: sin, cos, tan, exp, log, sqrt, abs, atan2, min, max, pow, floor, ceil, sign. Constants: pi, e. Operators: + - * / ^ and unary -.';

export function ControlsPanel({
  settings,
  onChange,
  onRender,
  onStop,
  onRandomize,
  onSavePng,
  busy,
  status,
  canRender,
  notice,
}: Props) {
  return (
    <div className="controls">
      <h1>Differential Equation Art</h1>

      <EquationInput
        label="dx/dt"
        value={settings.dxExpr}
        onChange={(v) => onChange({ dxExpr: v })}
        info={`Rate of change of x as a function of position and time. ${EXPR_INFO}`}
      />
      <EquationInput
        label="dy/dt"
        value={settings.dyExpr}
        onChange={(v) => onChange({ dyExpr: v })}
        info={`Rate of change of y as a function of position and time. ${EXPR_INFO}`}
      />

      <div className="row">
        {numberField(
          'xmin',
          settings.xmin,
          (v) => onChange({ xmin: v }),
          0.1,
          undefined,
          undefined,
          'Left edge of the visible x-range in sim space. The y-range is derived from the canvas aspect ratio so sim coordinates are isotropic with pixels.',
        )}
        {numberField(
          'xmax',
          settings.xmax,
          (v) => onChange({ xmax: v }),
          0.1,
          undefined,
          undefined,
          'Right edge of the visible x-range in sim space. Must be greater than xmin.',
        )}
      </div>

      <div className="row">
        {numberField(
          'density (min dist)',
          settings.density,
          (v) => onChange({ density: Math.max(0.001, v) }),
          0.01,
          0.001,
          undefined,
          'Poisson-disk minimum distance between seed points, in sim units. Smaller values mean more trails. The count is capped.',
        )}
        {numberField(
          'overshoot',
          settings.overshoot,
          (v) => onChange({ overshoot: Math.max(0, v) }),
          0.1,
          0,
          undefined,
          'How far outside the visible frame seeds may start, in sim units. Lets trails sweep in from off-canvas during animation. Auto-clamped to the stop-box radius.',
        )}
      </div>

      <div className="row">
        {numberField(
          'sim time',
          settings.simTime,
          (v) => onChange({ simTime: Math.max(0.1, v) }),
          0.5,
          0.1,
          undefined,
          'Total integration time (arbitrary units). Combined with steps, this fixes the RK4 step size dt = simTime / steps.',
        )}
        {numberField(
          'real seconds',
          settings.realTimeSeconds,
          (v) =>
            onChange({
              realTimeSeconds: Math.max(0.5, Math.min(CAPS.maxRealTimeSeconds, v)),
            }),
          0.5,
          0.5,
          CAPS.maxRealTimeSeconds,
          `Playback length in seconds before the animation loops. Independent of simulation time. Max ${CAPS.maxRealTimeSeconds}s.`,
        )}
      </div>

      <label>
        <span>
          color scheme
          <InfoTip text="How each trail's color is picked from its seed position. Color is fixed per trail — trails don't encode time, which keeps the field spatially coherent." />
        </span>
        <select
          value={settings.colorScheme}
          onChange={(e) => onChange({ colorScheme: e.target.value as ColorScheme })}
        >
          <option value="cornerRainbow">corner rainbow</option>
          <option value="hslAngle">HSL from angle</option>
          <option value="twoColor">two-color</option>
        </select>
      </label>

      {settings.colorScheme === 'twoColor' && (
        <div className="row">
          <label>
            <span>
              color A
              <InfoTip text="First color for the two-color scheme. Any CSS hex like #ff4d8a." />
            </span>
            <input
              type="text"
              value={settings.colorA}
              onChange={(e) => onChange({ colorA: e.target.value })}
            />
          </label>
          <label>
            <span>
              color B
              <InfoTip text="Second color for the two-color scheme. Any CSS hex like #4dc8ff." />
            </span>
            <input
              type="text"
              value={settings.colorB}
              onChange={(e) => onChange({ colorB: e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="row">
        {numberField(
          'stroke width',
          settings.strokeWidth,
          (v) => onChange({ strokeWidth: Math.max(0.2, v) }),
          0.1,
          0.2,
          undefined,
          'Trail line thickness in CSS pixels. Thinner lines reveal more detail; thicker lines give a painterly feel.',
        )}
        {numberField(
          'trail opacity',
          settings.trailOpacity,
          (v) => onChange({ trailOpacity: Math.max(0.02, Math.min(1, v)) }),
          0.05,
          0.02,
          1,
          'Alpha applied to each trail stroke (0.02 to 1). Lower values let overlapping trails blend into denser regions.',
        )}
      </div>

      <label>
        <span>
          background
          <InfoTip text="Canvas background color. Accepts any 6-digit hex (#RRGGBB)." />
        </span>
        <input
          type="text"
          value={settings.background}
          onChange={(e) => onChange({ background: e.target.value })}
        />
      </label>

      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={settings.fade}
          onChange={(e) => onChange({ fade: e.target.checked })}
        />
        <span>
          fading trails (uncheck for permanent)
          <InfoTip text="On: each frame translucently overdraws old ink so trails fade behind the leading edge. Off: every segment persists, producing a single painterly still image that freezes on the final frame." />
        </span>
      </label>

      <details>
        <summary>Advanced</summary>
        <div>
          <div className="row">
            {numberField(
              'steps',
              settings.steps,
              (v) =>
                onChange({ steps: Math.max(10, Math.min(CAPS.maxSteps, Math.round(v))) }),
              100,
              10,
              CAPS.maxSteps,
              `RK4 integration steps per trail. Higher = smoother curve but more compute. Pick steps ≥ fps × realSeconds for smooth playback. Cap ${CAPS.maxSteps}.`,
            )}
            {numberField(
              'fps',
              settings.fps,
              (v) =>
                onChange({
                  fps: Math.max(CAPS.minFps, Math.min(CAPS.maxFps, Math.round(v))),
                }),
              1,
              CAPS.minFps,
              CAPS.maxFps,
              `Animation frame rate (${CAPS.minFps}–${CAPS.maxFps}). Playback re-samples the integrated path onto this many frames per second.`,
            )}
          </div>
          {numberField(
            'seed',
            settings.seed,
            (v) => onChange({ seed: Math.round(v) }),
            1,
            undefined,
            undefined,
            'RNG seed for seed placement. Same seed + same settings = same picture. Use Randomize to pick a new one.',
          )}
        </div>
      </details>

      <div>
        <span className="status">presets</span>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => onChange(p.settings)}
              disabled={busy}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="actions">
        <button className="primary" onClick={onRender} disabled={busy || !canRender}>
          {busy ? 'Rendering…' : 'Render'}
        </button>
        <button onClick={onStop} disabled={!busy}>
          Stop
        </button>
        <button onClick={onRandomize}>Randomize</button>
        <button onClick={onSavePng}>Save PNG</button>
      </div>

      {notice && <div className="notice">{notice}</div>}

      <div className="status">{status}</div>
    </div>
  );
}
