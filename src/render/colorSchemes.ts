import type { ColorScheme } from '../types';

export interface ColorContext {
  scheme: ColorScheme;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  colorA: string;
  colorB: string;
}

function hslCss(h: number, s: number, l: number, a = 1): string {
  return `hsla(${(((h % 360) + 360) % 360).toFixed(1)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%, ${a.toFixed(3)})`;
}

function parseHex(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function cornerRainbow(nx: number, ny: number, alpha: number): string {
  // Four corner colors, bilinearly interpolated. nx, ny in [0, 1].
  const tl: [number, number, number] = [255, 110, 180]; // pink
  const tr: [number, number, number] = [255, 210, 90]; // amber
  const bl: [number, number, number] = [90, 150, 255]; // blue
  const br: [number, number, number] = [130, 240, 180]; // mint
  const top = mix(tl, tr, nx);
  const bot = mix(bl, br, nx);
  const c = mix(top, bot, 1 - ny);
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${alpha.toFixed(3)})`;
}

/**
 * Compute the stroke color for a trail based on its seed position.
 */
export function seedColor(ctx: ColorContext, sx: number, sy: number, alpha = 1): string {
  const xSpan = ctx.xmax - ctx.xmin;
  const ySpan = ctx.ymax - ctx.ymin;
  const nx = Math.max(0, Math.min(1, (sx - ctx.xmin) / xSpan));
  const ny = Math.max(0, Math.min(1, (sy - ctx.ymin) / ySpan));

  switch (ctx.scheme) {
    case 'cornerRainbow':
      return cornerRainbow(nx, ny, alpha);
    case 'hslAngle': {
      const cx = (ctx.xmin + ctx.xmax) / 2;
      const cy = (ctx.ymin + ctx.ymax) / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const hue = ((ang + Math.PI) / (2 * Math.PI)) * 360;
      const r = Math.hypot(sx - cx, sy - cy);
      const maxR = Math.hypot(xSpan / 2, ySpan / 2);
      const sat = 0.7;
      const light = 0.45 + 0.2 * Math.min(1, r / maxR);
      return hslCss(hue, sat, light, alpha);
    }
    case 'twoColor': {
      const a = parseHex(ctx.colorA);
      const b = parseHex(ctx.colorB);
      const t = (nx + ny) / 2;
      const c = mix(a, b, t);
      return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${alpha.toFixed(3)})`;
    }
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  return parseHex(hex);
}
