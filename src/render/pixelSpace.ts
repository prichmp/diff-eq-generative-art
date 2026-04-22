import type { PackedSimulation } from '../types';

export interface PixelTransform {
  widthPx: number;
  heightPx: number;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/**
 * Map sim coordinates to pixel coordinates. Y is flipped so up in sim space
 * is up on screen.
 */
export function simToPixel(t: PixelTransform, sx: number, sy: number): [number, number] {
  const px = ((sx - t.xmin) / (t.xmax - t.xmin)) * t.widthPx;
  const py = t.heightPx - ((sy - t.ymin) / (t.ymax - t.ymin)) * t.heightPx;
  return [px, py];
}

/**
 * For a fractional index into a path's point array (0..pointCount-1),
 * linearly interpolate to get a point. Used to resample dense simulation
 * output onto the lower-resolution animation-frame timeline.
 */
export function samplePathAt(
  sim: PackedSimulation,
  pathIdx: number,
  fractional: number,
): [number, number] | null {
  const start = sim.offsets[pathIdx];
  const end = sim.offsets[pathIdx + 1];
  const pointCount = (end - start) / 2;
  if (pointCount < 1) return null;

  // Clamp to valid range.
  const maxI = pointCount - 1;
  if (fractional <= 0) {
    return [sim.points[start], sim.points[start + 1]];
  }
  if (fractional >= maxI) {
    return [sim.points[end - 2], sim.points[end - 1]];
  }
  const i0 = Math.floor(fractional);
  const f = fractional - i0;
  const base = start + 2 * i0;
  const x0 = sim.points[base];
  const y0 = sim.points[base + 1];
  const x1 = sim.points[base + 2];
  const y1 = sim.points[base + 3];
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
}

export function pathPointCount(sim: PackedSimulation, pathIdx: number): number {
  return (sim.offsets[pathIdx + 1] - sim.offsets[pathIdx]) / 2;
}
