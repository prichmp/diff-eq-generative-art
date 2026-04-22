import { CAPS, type PackedSimulation, type ProblemAndSettings } from '../types';
import { compileEquation } from './compileEquation';
import { explicitRungeKutta4, type VectorField } from './rk4';
import { mulberry32, poissonDiskSampling } from './sampling';

export type SimulateProgress = (fraction: number) => void;

export interface SimulateError {
  ok: false;
  error: string;
}

export interface SimulateSuccess {
  ok: true;
  result: PackedSimulation;
}

export type SimulateResult = SimulateSuccess | SimulateError;

/**
 * Sample + integrate the user's vector field. Returns a single packed buffer
 * for transfer-friendly postMessage.
 */
export function simulate(
  settings: ProblemAndSettings,
  aspect: number,
  onProgress?: SimulateProgress,
): SimulateResult {
  const dxCompile = compileEquation(settings.dxExpr);
  if (!dxCompile.ok) return { ok: false, error: `dx/dt: ${dxCompile.error}` };
  const dyCompile = compileEquation(settings.dyExpr);
  if (!dyCompile.ok) return { ok: false, error: `dy/dt: ${dyCompile.error}` };

  const dx = dxCompile.fn;
  const dy = dyCompile.fn;
  const field: VectorField = (x, y, t) => [dx(x, y, t), dy(x, y, t)];

  const { xmin, xmax, density, overshoot, simTime, steps, seed } = settings;

  // Derive y-range from aspect so sim coordinates are isotropic with pixels.
  const xSpan = xmax - xmin;
  const ySpan = xSpan / aspect;
  const yCenter = 0;
  const ymin = yCenter - ySpan / 2;
  const ymax = yCenter + ySpan / 2;

  // Stop box extends one full domain on each side (2x total).
  const stopBox = {
    xmin: xmin - xSpan / 2,
    xmax: xmax + xSpan / 2,
    ymin: ymin - ySpan / 2,
    ymax: ymax + ySpan / 2,
  };
  const stopRadius = Math.min(xSpan, ySpan) / 2;
  const clampedOvershoot = Math.min(overshoot, stopRadius);

  const seedRect = {
    xmin: xmin - clampedOvershoot,
    xmax: xmax + clampedOvershoot,
    ymin: ymin - clampedOvershoot,
    ymax: ymax + clampedOvershoot,
  };

  const rng = mulberry32(seed);
  const seeds = poissonDiskSampling(seedRect, density, rng);

  if (seeds.length === 0) {
    return { ok: false, error: 'Density produced 0 seeds — decrease minimum distance.' };
  }
  if (seeds.length > CAPS.maxPaths) {
    return {
      ok: false,
      error: `Density produced ${seeds.length} paths (cap ${CAPS.maxPaths}). Increase density value.`,
    };
  }
  if (steps > CAPS.maxSteps) {
    return { ok: false, error: `Steps exceeds cap of ${CAPS.maxSteps}.` };
  }
  if (seeds.length * steps > CAPS.maxRk4Evals) {
    return {
      ok: false,
      error: `paths × steps = ${seeds.length * steps} exceeds cap of ${CAPS.maxRk4Evals}.`,
    };
  }

  // Run RK4 per seed, collect into per-path buffers first, then concat.
  const paths = seeds.length;
  const perPath: Float32Array[] = new Array(paths);
  let totalPoints = 0;
  const progressBucket = Math.max(1, Math.floor(paths / 40));
  for (let i = 0; i < paths; i++) {
    const [sx, sy] = seeds[i];
    const { points, pointCount } = explicitRungeKutta4(field, {
      time: simTime,
      steps,
      stopBox,
      initial: [sx, sy],
    });
    const sliced = points.subarray(0, 2 * pointCount);
    perPath[i] = sliced;
    totalPoints += pointCount;
    if (onProgress && i % progressBucket === 0) onProgress(i / paths);
  }
  if (onProgress) onProgress(1);

  const out = new Float32Array(2 * totalPoints);
  const offsets = new Uint32Array(paths + 1);
  let cursor = 0;
  for (let i = 0; i < paths; i++) {
    offsets[i] = cursor;
    out.set(perPath[i], cursor);
    cursor += perPath[i].length;
  }
  offsets[paths] = cursor;

  const seedsFlat = new Float32Array(2 * paths);
  for (let i = 0; i < paths; i++) {
    seedsFlat[2 * i] = seeds[i][0];
    seedsFlat[2 * i + 1] = seeds[i][1];
  }

  return {
    ok: true,
    result: {
      points: out,
      offsets,
      seeds: seedsFlat,
      xmin,
      xmax,
      ymin,
      ymax,
      dt: simTime / steps,
      steps,
    },
  };
}
