/**
 * Mulberry32: small, fast, reproducible 32-bit PRNG. Good enough for seed
 * placement — we don't need cryptographic quality.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rect {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/**
 * Bridson's algorithm for Poisson-disk sampling inside an axis-aligned rectangle.
 * Returns points with pairwise distance >= minDist.
 */
export function poissonDiskSampling(
  rect: Rect,
  minDist: number,
  rng: () => number,
  k = 30,
): Array<[number, number]> {
  const { xmin, xmax, ymin, ymax } = rect;
  const w = xmax - xmin;
  const h = ymax - ymin;
  if (w <= 0 || h <= 0 || minDist <= 0) return [];

  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.max(1, Math.ceil(w / cellSize));
  const gridH = Math.max(1, Math.ceil(h / cellSize));
  const grid = new Int32Array(gridW * gridH).fill(-1);
  const points: Array<[number, number]> = [];
  const active: number[] = [];

  const insert = (p: [number, number]): number => {
    const idx = points.length;
    points.push(p);
    const gx = Math.min(gridW - 1, Math.floor((p[0] - xmin) / cellSize));
    const gy = Math.min(gridH - 1, Math.floor((p[1] - ymin) / cellSize));
    grid[gy * gridW + gx] = idx;
    return idx;
  };

  const initial: [number, number] = [xmin + rng() * w, ymin + rng() * h];
  active.push(insert(initial));

  const minDistSq = minDist * minDist;

  while (active.length > 0) {
    const ai = Math.floor(rng() * active.length);
    const pIdx = active[ai];
    const p = points[pIdx];
    let placed = false;

    for (let attempt = 0; attempt < k; attempt++) {
      const angle = rng() * Math.PI * 2;
      const r = minDist * (1 + rng()); // in [minDist, 2*minDist)
      const nx = p[0] + r * Math.cos(angle);
      const ny = p[1] + r * Math.sin(angle);
      if (nx < xmin || nx >= xmax || ny < ymin || ny >= ymax) continue;

      const cgx = Math.min(gridW - 1, Math.floor((nx - xmin) / cellSize));
      const cgy = Math.min(gridH - 1, Math.floor((ny - ymin) / cellSize));

      let ok = true;
      const gx0 = Math.max(0, cgx - 2);
      const gx1 = Math.min(gridW - 1, cgx + 2);
      const gy0 = Math.max(0, cgy - 2);
      const gy1 = Math.min(gridH - 1, cgy + 2);
      for (let gy = gy0; gy <= gy1 && ok; gy++) {
        for (let gx = gx0; gx <= gx1 && ok; gx++) {
          const nIdx = grid[gy * gridW + gx];
          if (nIdx !== -1) {
            const q = points[nIdx];
            const dx = q[0] - nx;
            const dy = q[1] - ny;
            if (dx * dx + dy * dy < minDistSq) ok = false;
          }
        }
      }

      if (ok) {
        active.push(insert([nx, ny]));
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Swap-remove from active list.
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }

  return points;
}
