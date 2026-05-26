import { describe, expect, it } from 'vitest';
import { explicitRungeKutta4SecondOrder } from './rk4';

describe('explicitRungeKutta4SecondOrder', () => {
  it('reproduces a circular orbit for the harmonic oscillator', () => {
    // x'' = -x, y'' = -y with initial position (1, 0) and velocity (0, 1)
    // is uniform circular motion at radius 1, angular velocity 1.
    const result = explicitRungeKutta4SecondOrder(
      (x, y) => [-x, -y],
      {
        time: 2 * Math.PI,
        steps: 1000,
        stopBox: { xmin: -2, xmax: 2, ymin: -2, ymax: 2 },
        initial: [1, 0],
        initialVelocity: [0, 1],
      },
    );

    expect(result.pointCount).toBe(1001);

    // Radius should stay ~1 at every sample.
    for (let i = 0; i < result.pointCount; i++) {
      const x = result.points[2 * i];
      const y = result.points[2 * i + 1];
      expect(Math.sqrt(x * x + y * y)).toBeCloseTo(1, 3);
    }

    // After one full period the trajectory should return to the start.
    const lastX = result.points[2 * (result.pointCount - 1)];
    const lastY = result.points[2 * (result.pointCount - 1) + 1];
    expect(lastX).toBeCloseTo(1, 3);
    expect(lastY).toBeCloseTo(0, 3);
  });

  it('terminates when trajectory leaves the stop-box', () => {
    // Constant acceleration in +x with positive initial x-velocity exits
    // the stop-box on the right.
    const result = explicitRungeKutta4SecondOrder(
      () => [1, 0],
      {
        time: 10,
        steps: 100,
        stopBox: { xmin: -2, xmax: 2, ymin: -2, ymax: 2 },
        initial: [0, 0],
        initialVelocity: [1, 0],
      },
    );

    expect(result.pointCount).toBeLessThan(101);
    const lastX = result.points[2 * (result.pointCount - 1)];
    expect(lastX).toBeGreaterThan(2);
  });
});
