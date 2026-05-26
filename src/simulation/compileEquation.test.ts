import { describe, expect, it } from 'vitest';
import { compileEquation } from './compileEquation';

describe('compileEquation', () => {
  it('compiles basic first-order expressions', () => {
    const r = compileEquation('sin(x) + y * t');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fn(0, 0, 0, 0, 0)).toBeCloseTo(0);
    expect(r.fn(Math.PI / 2, 2, 0, 0, 3)).toBeCloseTo(1 + 6);
  });

  it("rejects x' when allowDerivatives is false", () => {
    const r = compileEquation("x' + y");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/second-order/);
  });

  it("rejects y' when allowDerivatives is false", () => {
    const r = compileEquation("y'");
    expect(r.ok).toBe(false);
  });

  it("accepts x' and y' when allowDerivatives is true", () => {
    const r = compileEquation("x' + 2*y'", { allowDerivatives: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // x=0, y=0, xp=3, yp=4, t=0  →  3 + 2*4 = 11
    expect(r.fn(0, 0, 3, 4, 0)).toBeCloseTo(11);
  });

  it('handles implicit multiplication with derivatives (2x\')', () => {
    const r = compileEquation("2x' - y'", { allowDerivatives: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 2*xp - yp with xp=5, yp=3  →  7
    expect(r.fn(0, 0, 5, 3, 0)).toBeCloseTo(7);
  });

  it('rejects stray apostrophe not attached to x or y', () => {
    const r = compileEquation("z' + 1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/apostrophe/i);
  });

  it('rejects empty expression', () => {
    expect(compileEquation('').ok).toBe(false);
    expect(compileEquation('   ').ok).toBe(false);
  });

  it('supports log (natural), ln, log10, log2', () => {
    for (const [expr, expected] of [
      ['log(e)', 1],
      ['ln(e)', 1],
      ['log10(100)', 2],
      ['log2(8)', 3],
    ] as const) {
      const r = compileEquation(expr);
      expect(r.ok, `${expr} should compile`).toBe(true);
      if (!r.ok) continue;
      expect(r.fn(0, 0, 0, 0, 0)).toBeCloseTo(expected);
    }
  });
});
