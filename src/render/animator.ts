import type { PackedSimulation, ProblemAndSettings } from '../types';
import { hexToRgb, seedColor, type ColorContext } from './colorSchemes';
import { pathPointCount, samplePathAt, simToPixel, type PixelTransform } from './pixelSpace';

export interface AnimatorArgs {
  canvas: HTMLCanvasElement;
  sim: PackedSimulation;
  settings: ProblemAndSettings;
}

export class Animator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: PackedSimulation;
  private settings: ProblemAndSettings;
  private rafId: number | null = null;
  private frameIdx = 0;
  private totalFrames: number;
  private prevPixel: Float32Array; // [x0,y0,x1,y1,...] previous pixel position per path
  private prevValid: Uint8Array; // flag indicating prevPixel is initialized
  private colors: string[]; // per-path stroke colors
  private transform: PixelTransform;
  private dpr: number;

  constructor({ canvas, sim, settings }: AnimatorArgs) {
    this.canvas = canvas;
    this.sim = sim;
    this.settings = settings;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context not available');
    this.ctx = ctx;

    this.totalFrames = Math.max(1, Math.round(settings.fps * settings.realTimeSeconds));
    const paths = sim.offsets.length - 1;
    this.prevPixel = new Float32Array(2 * paths);
    this.prevValid = new Uint8Array(paths);

    const colorCtx: ColorContext = {
      scheme: settings.colorScheme,
      xmin: sim.xmin,
      xmax: sim.xmax,
      ymin: sim.ymin,
      ymax: sim.ymax,
      colorA: settings.colorA,
      colorB: settings.colorB,
    };
    this.colors = new Array(paths);
    for (let i = 0; i < paths; i++) {
      const sx = sim.seeds[2 * i];
      const sy = sim.seeds[2 * i + 1];
      this.colors[i] = seedColor(colorCtx, sx, sy, settings.trailOpacity);
    }

    this.dpr = window.devicePixelRatio || 1;
    this.resize();
    this.transform = this.makeTransform();
    this.clear();
  }

  private makeTransform(): PixelTransform {
    return {
      widthPx: this.canvas.width,
      heightPx: this.canvas.height,
      xmin: this.sim.xmin,
      xmax: this.sim.xmax,
      ymin: this.sim.ymin,
      ymax: this.sim.ymax,
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * this.dpr));
    const h = Math.max(1, Math.floor(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.transform = this.makeTransform();
      this.clear();
      this.prevValid.fill(0);
    }
  }

  clear() {
    this.ctx.fillStyle = this.settings.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    if (this.rafId !== null) return;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.step();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private step() {
    const { ctx, settings, sim, totalFrames } = this;

    if (settings.fade) {
      // Translucent full-canvas fill fades old ink.
      const [r, g, b] = hexToRgb(settings.background);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.05)`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    const paths = sim.offsets.length - 1;
    ctx.lineWidth = settings.strokeWidth * this.dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fractional point index for this frame, mapped to each path's own length.
    const frameFrac = this.frameIdx / totalFrames;

    for (let i = 0; i < paths; i++) {
      const pc = pathPointCount(sim, i);
      if (pc < 2) continue;
      const idx = frameFrac * (pc - 1);
      const pt = samplePathAt(sim, i, idx);
      if (!pt) continue;
      const [px, py] = simToPixel(this.transform, pt[0], pt[1]);

      if (this.prevValid[i]) {
        const pxPrev = this.prevPixel[2 * i];
        const pyPrev = this.prevPixel[2 * i + 1];
        ctx.strokeStyle = this.colors[i];
        ctx.beginPath();
        ctx.moveTo(pxPrev, pyPrev);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      this.prevPixel[2 * i] = px;
      this.prevPixel[2 * i + 1] = py;
      this.prevValid[i] = 1;
    }

    this.frameIdx++;
    if (this.frameIdx >= totalFrames) {
      this.frameIdx = 0;
      if (settings.fade) {
        // Reset state for next loop so old ink doesn't linger forever.
        this.clear();
        this.prevValid.fill(0);
      } else {
        // Permanent mode: freeze on final frame.
        this.stop();
      }
    }
  }

  dispose() {
    this.stop();
  }
}
