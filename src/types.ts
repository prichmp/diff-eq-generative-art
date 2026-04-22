export type ColorScheme = 'cornerRainbow' | 'hslAngle' | 'twoColor';

export interface ProblemAndSettings {
  dxExpr: string;
  dyExpr: string;
  xmin: number;
  xmax: number;
  density: number;
  overshoot: number;
  simTime: number;
  steps: number;
  fps: number;
  realTimeSeconds: number;
  colorScheme: ColorScheme;
  colorA: string;
  colorB: string;
  background: string;
  strokeWidth: number;
  trailOpacity: number;
  fade: boolean;
  seed: number;
}

export interface PackedSimulation {
  // Flat buffer of [x0,y0,x1,y1,...] points. One sub-slice per path.
  points: Float32Array;
  // offsets[i]..offsets[i+1] is the range for path i (offsets.length = paths+1).
  offsets: Uint32Array;
  // Seed positions in sim space, for color derivation. Length = 2 * paths.
  seeds: Float32Array;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  dt: number;
  steps: number;
}

export const CAPS = {
  maxPaths: 50_000,
  maxSteps: 20_000,
  maxRk4Evals: 100_000_000,
  maxRealTimeSeconds: 120,
  minFps: 24,
  maxFps: 60,
};
