import type { ProblemAndSettings } from './types';

export const DEFAULT_SETTINGS: ProblemAndSettings = {
  order: 1,
  dxExpr: 'sin(y) - 0.1 * x',
  dyExpr: '-sin(x) + 0.1 * y',
  vx0Expr: '0',
  vy0Expr: '0',
  xmin: -8,
  xmax: 8,
  density: 0.18,
  overshoot: 3,
  simTime: 20,
  steps: 1200,
  fps: 60,
  realTimeSeconds: 12,
  colorScheme: 'cornerRainbow',
  colorA: '#ff4d8a',
  colorB: '#4dc8ff',
  background: '#0a0a0b',
  strokeWidth: 1.1,
  trailOpacity: 0.9,
  fade: false,
  seed: 1,
};

export interface Preset {
  name: string;
  settings: Partial<ProblemAndSettings>;
}

export const PRESETS: Preset[] = [
  {
    name: 'Drifting Spiral',
    settings: {
      dxExpr: 'sin(y) - 0.1 * x',
      dyExpr: '-sin(x) + 0.1 * y',
      xmin: -12,
      xmax: 12,
      density: 0.18,
      overshoot: 3,
      simTime: 20,
    },
  },
  {
    name: 'Drunkard\'s Walk',
    settings: {
      dxExpr: 'rand() * (10 - -10) + -10',
      dyExpr: 'rand() * (10 - -10) + -10',
      xmin: -6,
      xmax: 6,
      density: 0.18,
      simTime: 20,
    },
  },
  {
    name: 'Vortex',
    settings: {
      dxExpr: '-y - 0.1 * x',
      dyExpr: 'x - 0.1 * y',
      xmin: -5,
      xmax: 5,
      density: 0.16,
      overshoot: 12,
      simTime: 15,
    },
  },
  {
    name: 'Saddle Flow',
    settings: {
      dxExpr: 'y',
      dyExpr: 'x - y - x^3',
      xmin: -3,
      xmax: 3,
      density: 0.09,
      simTime: 12,
    },
  },
  {
    name: 'Curl Field',
    settings: {
      dxExpr: 'sin(2 * y) - 0.05 * x',
      dyExpr: 'cos(2 * x) - 0.05 * y',
      xmin: -5,
      xmax: 5,
      density: 0.14,
      simTime: 22,
    },
  },
  // The following are discrete-time strange-attractor maps from
  // https://softologyblog.wordpress.com/2017/03/04/2d-strange-attractors/
  // interpreted here as continuous vector fields (dx/dt = f(x,y),
  // dy/dt = g(x,y)) so they can flow through the RK4 integrator. The
  // visuals will differ from the canonical iterated-map renderings but
  // produce interesting flows.
  {
    name: 'Bedhead',
    settings: {
      dxExpr: 'sin(x * y / 0.81) * y + cos(-0.92 * x - y)',
      dyExpr: 'x + sin(y) / 0.81',
      xmin: -5,
      xmax: 5,
      density: 0.08,
      simTime: 12,
    },
  },
  {
    name: 'Fractal Dream',
    settings: {
      dxExpr: 'sin(y * 2.879879) + 0.765145 * sin(x * 2.879879)',
      dyExpr: 'sin(x * -0.966918) + 0.744728 * sin(y * -0.966918)',
      xmin: -3,
      xmax: 3,
      density: 0.07,
      simTime: 15,
    },
  },
  {
    // 2D simple harmonic oscillator: x'' = -x, y'' = -y. The initial velocity
    // is set perpendicular to the radius vector, so each seed traces a circle
    // of radius equal to its distance from the origin.
    name: 'Harmonic Oscillator',
    settings: {
      order: 2,
      dxExpr: "-x-0.5x'",
      dyExpr: "-y-0.5y'",
      vx0Expr: 'y',
      vy0Expr: 'x',
      xmin: -3,
      xmax: 3,
      density: 0.06,
      overshoot: 1,
      simTime: 20,
    },
  },
    {
    name: 'Waterfall',
    settings: {
      order: 2,
      dxExpr: "sin(x')",
      dyExpr: 'cos(x)',
      vx0Expr: '0',
      vy0Expr: '0',
      xmin: -12,
      xmax: 12,
      density: 0.2,
      overshoot: 3,
      simTime: 14,
    },
  },
      {
    name: 'Square',
    settings: {
      order: 2,
      dxExpr: "sin(x)",
      dyExpr: 'cos(y)',
      vx0Expr: '0',
      vy0Expr: '0',
      xmin: -12,
      xmax: 12,
      density: 0.2,
      overshoot: 3,
      simTime: 12,
    },
  },
];
