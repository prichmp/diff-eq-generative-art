export type VectorField = (x: number, y: number, t: number) => readonly [number, number];

// Second-order RHS: acceleration as a function of position, velocity, and time.
export type VectorField2 = (
  x: number,
  y: number,
  xp: number,
  yp: number,
  t: number,
) => readonly [number, number];

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

export interface RK4Options2 extends RK4Options {
  initialVelocity: [number, number];
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

/**
 * RK4 for a 2D second-order system rewritten as a 4D first-order state
 * [x, y, vx, vy]. The acceleration field gets position + velocity + time.
 * Output buffer stores only positions (x, y) so downstream rendering matches
 * the first-order path.
 */
export function explicitRungeKutta4SecondOrder(
  f: VectorField2,
  opts: RK4Options2,
): RK4Result {
  const { time, steps, stopBox, initial, initialVelocity } = opts;
  const dt = time / steps;
  const halfDt = dt * 0.5;
  const sixthDt = dt / 6;

  const points = new Float32Array(2 * (steps + 1));
  let x = initial[0];
  let y = initial[1];
  let vx = initialVelocity[0];
  let vy = initialVelocity[1];
  let t = 0;

  points[0] = x;
  points[1] = y;
  let pointCount = 1;

  for (let i = 0; i < steps; i++) {
    // Stage 1
    const k1x = vx;
    const k1y = vy;
    const [k1vx, k1vy] = f(x, y, vx, vy, t);

    // Stage 2
    const x2 = x + halfDt * k1x;
    const y2 = y + halfDt * k1y;
    const vx2 = vx + halfDt * k1vx;
    const vy2 = vy + halfDt * k1vy;
    const k2x = vx2;
    const k2y = vy2;
    const [k2vx, k2vy] = f(x2, y2, vx2, vy2, t + halfDt);

    // Stage 3
    const x3 = x + halfDt * k2x;
    const y3 = y + halfDt * k2y;
    const vx3 = vx + halfDt * k2vx;
    const vy3 = vy + halfDt * k2vy;
    const k3x = vx3;
    const k3y = vy3;
    const [k3vx, k3vy] = f(x3, y3, vx3, vy3, t + halfDt);

    // Stage 4
    const x4 = x + dt * k3x;
    const y4 = y + dt * k3y;
    const vx4 = vx + dt * k3vx;
    const vy4 = vy + dt * k3vy;
    const k4x = vx4;
    const k4y = vy4;
    const [k4vx, k4vy] = f(x4, y4, vx4, vy4, t + dt);

    const nx = x + sixthDt * (k1x + 2 * k2x + 2 * k3x + k4x);
    const ny = y + sixthDt * (k1y + 2 * k2y + 2 * k3y + k4y);
    const nvx = vx + sixthDt * (k1vx + 2 * k2vx + 2 * k3vx + k4vx);
    const nvy = vy + sixthDt * (k1vy + 2 * k2vy + 2 * k3vy + k4vy);

    if (
      !Number.isFinite(nx) ||
      !Number.isFinite(ny) ||
      !Number.isFinite(nvx) ||
      !Number.isFinite(nvy)
    ) {
      break;
    }
    if (nx < stopBox.xmin || nx > stopBox.xmax || ny < stopBox.ymin || ny > stopBox.ymax) {
      points[2 * pointCount] = nx;
      points[2 * pointCount + 1] = ny;
      pointCount++;
      break;
    }

    x = nx;
    y = ny;
    vx = nvx;
    vy = nvy;
    t += dt;
    points[2 * pointCount] = x;
    points[2 * pointCount + 1] = y;
    pointCount++;
  }

  return { points, pointCount };
}
