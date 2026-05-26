import { parse, type MathNode } from 'mathjs';

export type CompiledExpr = (x: number, y: number, xp: number, yp: number, t: number) => number;

export interface CompileOptions {
  // When true, x' and y' are accepted in the expression as the first
  // derivatives (velocities). Required for second-order equations.
  allowDerivatives?: boolean;
}

const MATH_FNS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  ln: Math.log,
  log10: Math.log10,
  log2: Math.log2,
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

function walk(node: MathNode, allowDerivatives: boolean): CompiledExpr {
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
      if (name === 't') return (_x, _y, _xp, _yp, t) => t;
      if (name === '__xp') {
        if (!allowDerivatives) {
          throw new Error(`x' is only available inside x'' / y'' of a second-order equation.`);
        }
        return (_x, _y, xp) => xp;
      }
      if (name === '__yp') {
        if (!allowDerivatives) {
          throw new Error(`y' is only available inside x'' / y'' of a second-order equation.`);
        }
        return (_x, _y, _xp, yp) => yp;
      }
      if (name in CONSTANTS) {
        const v = CONSTANTS[name];
        return () => v;
      }
      const allowed = allowDerivatives ? "x, y, x', y', t, pi, e" : 'x, y, t, pi, e';
      throw new Error(`Unknown symbol: ${name}. Allowed: ${allowed}.`);
    }
    case 'ParenthesisNode': {
      return walk((n as unknown as { content: MathNode }).content, allowDerivatives);
    }
    case 'OperatorNode': {
      const op = String(n.op);
      const args = (n.args as MathNode[]).map((a) => walk(a, allowDerivatives));
      if (args.length === 1) {
        const [a] = args;
        if (op === '-') return (x, y, xp, yp, t) => -a(x, y, xp, yp, t);
        if (op === '+') return (x, y, xp, yp, t) => a(x, y, xp, yp, t);
        throw new Error(`Unsupported unary operator: ${op}`);
      }
      if (args.length === 2) {
        const [a, b] = args;
        switch (op) {
          case '+': return (x, y, xp, yp, t) => a(x, y, xp, yp, t) + b(x, y, xp, yp, t);
          case '-': return (x, y, xp, yp, t) => a(x, y, xp, yp, t) - b(x, y, xp, yp, t);
          case '*': return (x, y, xp, yp, t) => a(x, y, xp, yp, t) * b(x, y, xp, yp, t);
          case '/': return (x, y, xp, yp, t) => a(x, y, xp, yp, t) / b(x, y, xp, yp, t);
          case '^': return (x, y, xp, yp, t) => Math.pow(a(x, y, xp, yp, t), b(x, y, xp, yp, t));
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
      const args = (n.args as MathNode[]).map((a) => walk(a, allowDerivatives));
      if (args.length === 1) {
        const [a] = args;
        return (x, y, xp, yp, t) => fn(a(x, y, xp, yp, t));
      }
      if (args.length === 2) {
        const [a, b] = args;
        return (x, y, xp, yp, t) => fn(a(x, y, xp, yp, t), b(x, y, xp, yp, t));
      }
      return (x, y, xp, yp, t) => fn(...args.map((a) => a(x, y, xp, yp, t)));
    }
    case 'UnaryMinusNode': {
      const inner = walk((n as unknown as { content: MathNode }).content, allowDerivatives);
      return (x, y, xp, yp, t) => -inner(x, y, xp, yp, t);
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

export function compileEquation(
  expr: string,
  options: CompileOptions = {},
): CompileResult | CompileError {
  const trimmed = expr.trim();
  if (!trimmed) return { ok: false, error: 'Expression is empty' };
  // mathjs can't tokenize apostrophes inside identifiers, so rewrite x' and y'
  // to internal symbols before parsing. Implicit multiplication handles 2x'.
  const preprocessed = trimmed.replace(/([xy])'/g, '__$1p');
  if (preprocessed.includes("'")) {
    return {
      ok: false,
      error: "Stray apostrophe — only x' and y' (immediately after the letter) are recognized.",
    };
  }
  let ast: MathNode;
  try {
    ast = parse(preprocessed);
  } catch (e) {
    return { ok: false, error: `Parse error: ${(e as Error).message}` };
  }
  let fn: CompiledExpr;
  try {
    fn = walk(ast, options.allowDerivatives ?? false);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, fn };
}
