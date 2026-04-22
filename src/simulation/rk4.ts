export type VectorField = (x: number, y: number, t: number) => readonly [number, number];

export interface RK4Result {
  // Flat buffer [x0,y0,x1,y1,...]. Length = 2 * (pointCount).
  points: Float32Array;
  // Actual number of valid points integrated. May be < steps+1 if the trajectory
  // exited the stop-box or produced a non-finite state.
  pointCount: number;
}

export interface RK4Options {
  time: number;
  steps: number;
  // Axis-aligned stop-box. Trajectory terminates at last finite state if it exits.
  stopBox: { xmin: number; xmax: number; ymin: number; ymax: number };
  initial: [number, number];
}

/**
 * Classic 4th-order explicit Runge-Kutta integrator for a 2D autonomous or
 * non-autonomous vector field. Terminates early on non-finite states or on
 * leaving the stop-box.
 */
export function explicitRungeKutta4(f: VectorField, opts: RK4Options): RK4Result {
  const { time, steps, stopBox, initial } = opts;
  const dt = time / steps;
  const halfDt = dt * 0.5;
  const sixthDt = dt / 6;

  const points = new Float32Array(2 * (steps + 1));
  let x = initial[0];
  let y = initial[1];
  let t = 0;

  points[0] = x;
  points[1] = y;
  let pointCount = 1;

  for (let i = 0; i < steps; i++) {
    const [k1x, k1y] = f(x, y, t);
    const [k2x, k2y] = f(x + halfDt * k1x, y + halfDt * k1y, t + halfDt);
    const [k3x, k3y] = f(x + halfDt * k2x, y + halfDt * k2y, t + halfDt);
    const [k4x, k4y] = f(x + dt * k3x, y + dt * k3y, t + dt);

    const nx = x + sixthDt * (k1x + 2 * k2x + 2 * k3x + k4x);
    const ny = y + sixthDt * (k1y + 2 * k2y + 2 * k3y + k4y);

    if (!Number.isFinite(nx) || !Number.isFinite(ny)) break;
    if (nx < stopBox.xmin || nx > stopBox.xmax || ny < stopBox.ymin || ny > stopBox.ymax) {
      points[2 * pointCount] = nx;
      points[2 * pointCount + 1] = ny;
      pointCount++;
      break;
    }

    x = nx;
    y = ny;
    t += dt;
    points[2 * pointCount] = x;
    points[2 * pointCount + 1] = y;
    pointCount++;
  }

  return { points, pointCount };
}
