import { parse, random, type MathNode } from 'mathjs';

export type CompiledExpr = (x: number, y: number, t: number) => number;

const MATH_FNS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  sqrt: Math.sqrt,
  abs: Math.abs,
  atan2: Math.atan2,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  floor: Math.floor,
  ceil: Math.ceil,
  sign: Math.sign,
  rand: Math.random,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
};

function walk(node: MathNode): CompiledExpr {
  const n = node as unknown as Record<string, unknown> & { type: string };

  switch (n.type) {
    case 'ConstantNode': {
      const v = Number(n.value);
      if (!Number.isFinite(v)) throw new Error(`Invalid constant: ${String(n.value)}`);
      return () => v;
    }
    case 'SymbolNode': {
      const name = String(n.name);
      if (name === 'x') return (x) => x;
      if (name === 'y') return (_x, y) => y;
      if (name === 't') return (_x, _y, t) => t;
      if (name in CONSTANTS) {
        const v = CONSTANTS[name];
        return () => v;
      }
      throw new Error(`Unknown symbol: ${name}. Allowed: x, y, t, pi, e.`);
    }
    case 'ParenthesisNode': {
      return walk((n as unknown as { content: MathNode }).content);
    }
    case 'OperatorNode': {
      const op = String(n.op);
      const args = (n.args as MathNode[]).map(walk);
      if (args.length === 1) {
        const [a] = args;
        if (op === '-') return (x, y, t) => -a(x, y, t);
        if (op === '+') return (x, y, t) => a(x, y, t);
        throw new Error(`Unsupported unary operator: ${op}`);
      }
      if (args.length === 2) {
        const [a, b] = args;
        switch (op) {
          case '+': return (x, y, t) => a(x, y, t) + b(x, y, t);
          case '-': return (x, y, t) => a(x, y, t) - b(x, y, t);
          case '*': return (x, y, t) => a(x, y, t) * b(x, y, t);
          case '/': return (x, y, t) => a(x, y, t) / b(x, y, t);
          case '^': return (x, y, t) => Math.pow(a(x, y, t), b(x, y, t));
        }
      }
      throw new Error(`Unsupported operator: ${op} (${args.length} args)`);
    }
    case 'FunctionNode': {
      const fnNode = n.fn as { name?: string } | string;
      const name = typeof fnNode === 'string' ? fnNode : fnNode?.name ?? '';
      if (!(name in MATH_FNS)) {
        throw new Error(`Unknown function: ${name}. Allowed: ${Object.keys(MATH_FNS).join(', ')}.`);
      }
      const fn = MATH_FNS[name];
      const args = (n.args as MathNode[]).map(walk);
      if (args.length === 1) {
        const [a] = args;
        return (x, y, t) => fn(a(x, y, t));
      }
      if (args.length === 2) {
        const [a, b] = args;
        return (x, y, t) => fn(a(x, y, t), b(x, y, t));
      }
      return (x, y, t) => fn(...args.map((a) => a(x, y, t)));
    }
    case 'UnaryMinusNode': {
      const inner = walk((n as unknown as { content: MathNode }).content);
      return (x, y, t) => -inner(x, y, t);
    }
    default:
      throw new Error(`Unsupported expression node: ${n.type}`);
  }
}

export interface CompileResult {
  ok: true;
  fn: CompiledExpr;
}

export interface CompileError {
  ok: false;
  error: string;
}

export function compileEquation(expr: string): CompileResult | CompileError {
  const trimmed = expr.trim();
  if (!trimmed) return { ok: false, error: 'Expression is empty' };
  let ast: MathNode;
  try {
    ast = parse(trimmed);
  } catch (e) {
    return { ok: false, error: `Parse error: ${(e as Error).message}` };
  }
  let fn: CompiledExpr;
  try {
    fn = walk(ast);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Smoke-test at a few in-domain points to surface evaluation errors early.
  const samples: Array<[number, number, number]> = [
    [0, 0, 0],
    [0.5, -0.5, 0],
    [-1.2, 0.7, 0.3],
    [1.1, 1.3, 0.9],
  ];
  for (const [x, y, t] of samples) {
    let v: number;
    try {
      v = fn(x, y, t);
    } catch (e) {
      return { ok: false, error: `Runtime error: ${(e as Error).message}` };
    }
    if (!Number.isFinite(v)) {
      // A NaN at one sample isn't fatal — user's field may have singularities —
      // but it's suspicious. Allow it; the per-step guard will handle it.
    }
  }
  return { ok: true, fn };
}
