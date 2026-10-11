// src/math/evaluator.ts
// Mathematical expression parsing supporting explicit y=f(x), explicit x=g(y),
// analytic circles, and general implicit curves F(x, y) = 0 of arbitrary order and functions.

export interface Domain1D {
  min: number;
  max: number;
  minInclusive: boolean;
  maxInclusive: boolean;
}

export interface Domain2D {
  x: Domain1D;
  y: Domain1D;
}

export type EquationType = 'explicit_y' | 'explicit_x' | 'circle' | 'implicit';

export interface CurvePoint {
  x: number;
  y: number;
}

export interface ParsedEquation {
  raw: string;
  expression: string;
  domain: Domain2D;
  type: EquationType;
  freeVariables: string[];
  isValid: boolean;
  errorMessage?: string;

  // For explicit_y: y = f(x)
  fnY?: (x: number, vars?: Record<string, number>) => number;

  // For explicit_x: x = g(y)
  fnX?: (y: number, vars?: Record<string, number>) => number;

  // For circle: (x - h)^2 + (y - k)^2 = R
  circleData?: {
    h: number;
    k: number;
    getR: (vars?: Record<string, number>) => number;
  };

  // For general implicit: F(x, y, vars) = 0
  fnImplicit?: (x: number, y: number, vars?: Record<string, number>) => number;
}

// Built-in functions and constants supported
const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
};

const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
};

/**
 * Parses domain restrictions like:
 * "{x > -2}"
 * "{-3 < x < 4}"
 * "{y > 0}"
 * "{x > 0, y < 4}"
 */
export function parseDomainString(str: string): Domain2D {
  const result: Domain2D = {
    x: { min: -Infinity, max: Infinity, minInclusive: true, maxInclusive: true },
    y: { min: -Infinity, max: Infinity, minInclusive: true, maxInclusive: true },
  };

  if (!str || !str.trim()) return result;

  const clean = str.replace(/[{}\[\]]/g, '').trim();
  if (!clean) return result;

  const conditions = clean.split(/[,;&]/).map(c => c.trim()).filter(Boolean);

  for (const cond of conditions) {
    const varName = /\by\b/i.test(cond) ? 'y' : 'x';
    const target = varName === 'y' ? result.y : result.x;

    // Compound format: "num <= var <= num" or "num < var < num"
    const compoundRegex = new RegExp(`^(-?\\d*\\.?\\d+)\\s*(<=|<)\\s*${varName}\\s*(<=|<)\\s*(-?\\d*\\.?\\d+)$`, 'i');
    const compoundMatch = cond.match(compoundRegex);
    if (compoundMatch) {
      const v1 = parseFloat(compoundMatch[1]);
      const op1 = compoundMatch[2];
      const op2 = compoundMatch[3];
      const v2 = parseFloat(compoundMatch[4]);
      target.min = Math.max(target.min, v1);
      target.minInclusive = op1 === '<=';
      target.max = Math.min(target.max, v2);
      target.maxInclusive = op2 === '<=';
      continue;
    }

    // Single: "var > num", "var >= num", "var < num", "var <= num"
    const varFirstRegex = new RegExp(`^${varName}\\s*(>=|<=|>|<)\\s*(-?\\d*\\.?\\d+)$`, 'i');
    const varFirstMatch = cond.match(varFirstRegex);
    if (varFirstMatch) {
      const op = varFirstMatch[1];
      const val = parseFloat(varFirstMatch[2]);
      if (op === '>' || op === '>=') {
        target.min = Math.max(target.min, val);
        target.minInclusive = op === '>=';
      } else if (op === '<' || op === '<=') {
        target.max = Math.min(target.max, val);
        target.maxInclusive = op === '<=';
      }
      continue;
    }

    // Reversed: "num < var", "num <= var", "num > var", "num >= var"
    const numFirstRegex = new RegExp(`^(-?\\d*\\.?\\d+)\\s*(>=|<=|>|<)\\s*${varName}$`, 'i');
    const numFirstMatch = cond.match(numFirstRegex);
    if (numFirstMatch) {
      const val = parseFloat(numFirstMatch[1]);
      const op = numFirstMatch[2];
      if (op === '<' || op === '<=') {
        target.min = Math.max(target.min, val);
        target.minInclusive = op === '<=';
      } else if (op === '>' || op === '>=') {
        target.max = Math.min(target.max, val);
        target.maxInclusive = op === '>=';
      }
      continue;
    }
  }

  return result;
}

export function isPointInDomain(x: number, y: number, domain: Domain2D): boolean {
  if (domain.x.min !== -Infinity) {
    if (domain.x.minInclusive ? x < domain.x.min : x <= domain.x.min) return false;
  }
  if (domain.x.max !== Infinity) {
    if (domain.x.maxInclusive ? x > domain.x.max : x >= domain.x.max) return false;
  }
  if (domain.y.min !== -Infinity) {
    if (domain.y.minInclusive ? y < domain.y.min : y <= domain.y.min) return false;
  }
  if (domain.y.max !== Infinity) {
    if (domain.y.maxInclusive ? y > domain.y.max : y >= domain.y.max) return false;
  }
  return true;
}

/**
 * Extracts domain restriction and cleans input.
 */
export function extractEquationAndDomain(input: string): { exprText: string; domainText: string } {
  let exprText = input.trim();
  let domainText = '';

  const braceMatch = exprText.match(/\{([^}]+)\}/);
  if (braceMatch) {
    domainText = braceMatch[1];
    exprText = exprText.replace(/\{[^}]+\}/, '').trim();
  }

  return { exprText, domainText };
}

/**
 * Pre-processes mathematical string into valid JS expression.
 * Handles implicit multiplication (xy, 3x, 2y, (x)(y)), powers (^ -> **), and math functions.
 */
export function preprocessExpression(expr: string, coordVars: string[] = ['x']): { jsExpr: string; freeVars: string[] } {
  let s = expr.trim();
  if (!s) return { jsExpr: '0', freeVars: [] };

  // Normalize LaTeX \pi and Unicode π
  s = s.replace(/\\pi\b/g, 'pi');
  s = s.replace(/π/g, 'pi');

  // Convert ^ to **
  s = s.replace(/\^/g, '**');

  // Convert |expr| to abs(expr)
  s = s.replace(/\|([^|]+)\|/g, 'abs($1)');

  // Implicit multiplication: number followed by letter, parenthesis, or pi:
  // Use negative lookbehind so functions like log10( or log2( are not broken into log10*(
  s = s.replace(/(?<![a-zA-Z0-9_])(\d+(?:\.\d+)?)\s*([a-zA-Z_(])/g, '$1*$2');

  // Closing parenthesis followed by letter, number, or parenthesis: )x -> )*x
  s = s.replace(/\)\s*([a-zA-Z0-9_(])/g, ')*$1');

  // Constant multiplications: pi x -> pi*x, pi( -> pi*(, e x -> e*x, e( -> e*(, x pi -> x*pi, etc.
  s = s.replace(/\b(pi|e)\s+([a-zA-Z0-9_(])/gi, '$1*$2');
  s = s.replace(/\b(pi|e)\s*\(/gi, '$1*(');
  s = s.replace(/\b([xy])\s*(pi|e)\b/gi, '$1*$2');
  s = s.replace(/\b(pi|e)\s*([xy])\b/gi, '$1*$2');

  // Variable multiplications: xy -> x*y, yx -> y*x, x( -> x*(, y( -> y*(
  s = s.replace(/\bxy\b/g, 'x*y');
  s = s.replace(/\byx\b/g, 'y*x');
  s = s.replace(/\bx\s*y\b/g, 'x*y');
  s = s.replace(/\by\s*x\b/g, 'y*x');
  s = s.replace(/\bx\s*\(/g, 'x*(');
  s = s.replace(/\by\s*\(/g, 'y*(');

  const MATH_MAPPING: Record<string, string> = {
    pi: 'Math.PI',
    PI: 'Math.PI',
    e: 'Math.E',
    E: 'Math.E',
    sin: 'Math.sin',
    cos: 'Math.cos',
    tan: 'Math.tan',
    asin: 'Math.asin',
    acos: 'Math.acos',
    atan: 'Math.atan',
    sinh: 'Math.sinh',
    cosh: 'Math.cosh',
    tanh: 'Math.tanh',
    sqrt: 'Math.sqrt',
    cbrt: 'Math.cbrt',
    abs: 'Math.abs',
    exp: 'Math.exp',
    ln: 'Math.log',
    log: 'Math.log10',
    log10: 'Math.log10',
    log2: 'Math.log2',
    floor: 'Math.floor',
    ceil: 'Math.ceil',
    round: 'Math.round',
    sign: 'Math.sign',
    min: 'Math.min',
    max: 'Math.max',
  };

  const freeVars = new Set<string>();

  // Single-pass replacement: guarantees no token is ever double-replaced into Math.Math.*
  s = s.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (token) => {
    if (MATH_MAPPING[token]) {
      return MATH_MAPPING[token];
    }
    if (coordVars.includes(token)) {
      return token;
    }
    freeVars.add(token);
    return token;
  });

  return { jsExpr: s, freeVars: Array.from(freeVars) };
}

/**
 * Inspects if an equation matches an analytic circle:
 * e.g., x^2 + y^2 = 10 or (x - h)^2 + (y - k)^2 = R
 */
function tryParseCircle(expr: string): { h: number; k: number; rhsStr: string } | null {
  const s = expr.replace(/\s+/g, '').replace(/\*\*/g, '^');
  const parts = s.split('=');
  if (parts.length !== 2) return null;

  const lhs = parts[0];
  const rhsStr = parts[1];

  const xTerm = '(?:\\((?:x([+-]\\d*(?:\\.\\d+)?))\\)\\^2|x\\^2)';
  const yTerm = '(?:\\((?:y([+-]\\d*(?:\\.\\d+)?))\\)\\^2|y\\^2)';

  let h = 0, k = 0;
  let matched = false;

  const p1 = new RegExp(`^${xTerm}\\+${yTerm}$`);
  const m1 = lhs.match(p1);
  if (m1) {
    h = m1[1] ? -parseFloat(m1[1]) : 0;
    k = m1[2] ? -parseFloat(m1[2]) : 0;
    matched = true;
  } else {
    const p2 = new RegExp(`^${yTerm}\\+${xTerm}$`);
    const m2 = lhs.match(p2);
    if (m2) {
      k = m2[1] ? -parseFloat(m2[1]) : 0;
      h = m2[2] ? -parseFloat(m2[2]) : 0;
      matched = true;
    }
  }

  if (!matched) return null;
  return { h, k, rhsStr };
}

/**
 * Compiles any mathematical equation string (explicit, implicit, arbitrary orders & functions).
 */
export function compileEquation(rawInput: string, explicitDomain?: Domain2D): ParsedEquation {
  const { exprText, domainText } = extractEquationAndDomain(rawInput);
  const domain = explicitDomain || parseDomainString(domainText);

  if (!exprText) {
    return {
      raw: rawInput,
      expression: '',
      domain,
      type: 'explicit_y',
      freeVariables: [],
      isValid: false,
      errorMessage: 'Equation is empty',
    };
  }

  // 1. Analytic Circle Fast-Path: e.g. x^2 + y^2 = 10
  const circleMatch = tryParseCircle(exprText);
  if (circleMatch) {
    const { h, k, rhsStr } = circleMatch;
    const { jsExpr: rhsJs, freeVars } = preprocessExpression(rhsStr, []);

    try {
      const varSetup = freeVars
        .map(v => `const ${v} = (vars && typeof vars['${v}'] === 'number') ? vars['${v}'] : 1;`)
        .join('\n');
      const getR = new Function(
        `return function(vars) {
          ${varSetup}
          const val = (${rhsJs});
          return val > 0 ? Math.sqrt(val) : NaN;
        };`
      )() as (vars?: Record<string, number>) => number;

      return {
        raw: rawInput,
        expression: exprText,
        domain,
        type: 'circle',
        freeVariables: freeVars,
        isValid: true,
        circleData: { h, k, getR },
      };
    } catch (err: any) {
      // Fall through to general implicit if circle compilation fails
    }
  }

  // 2. Check for Explicit x = g(y): e.g. x = 3, x = y^2 - 4
  const isExplicitX = /^x\s*=\s*/i.test(exprText) && !/\bx\b/i.test(exprText.replace(/^x\s*=\s*/i, ''));
  if (isExplicitX) {
    const rhs = exprText.replace(/^x\s*=\s*/i, '').trim();
    const { jsExpr, freeVars } = preprocessExpression(rhs, ['y']);

    try {
      const varSetup = freeVars
        .map(v => `const ${v} = (vars && typeof vars['${v}'] === 'number') ? vars['${v}'] : 1;`)
        .join('\n');
      const fnCode = `
        return function(y, vars) {
          ${varSetup}
          try {
            return (${jsExpr});
          } catch(e) {
            return NaN;
          }
        };
      `;
      const fnX = new Function(fnCode)() as (y: number, vars?: Record<string, number>) => number;

      return {
        raw: rawInput,
        expression: exprText,
        domain,
        type: 'explicit_x',
        freeVariables: freeVars,
        isValid: true,
        fnX,
      };
    } catch (err: any) {
      return {
        raw: rawInput,
        expression: exprText,
        domain,
        type: 'explicit_x',
        freeVariables: [],
        isValid: false,
        errorMessage: err?.message || 'Syntax error in x equation',
      };
    }
  }

  // 3. Check for Explicit y = f(x): starts with "y =" or "f(x) =" and RHS does not contain y
  if (/^(?:y|f\s*\(\s*x\s*\))\s*=/i.test(exprText)) {
    const rhs = exprText.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '').trim();
    if (!/\by\b/i.test(rhs)) {
      const { jsExpr, freeVars } = preprocessExpression(rhs, ['x']);
      try {
        const varSetup = freeVars
          .map(v => `const ${v} = (vars && typeof vars['${v}'] === 'number') ? vars['${v}'] : 1;`)
          .join('\n');
        const fnCode = `
          return function(x, vars) {
            ${varSetup}
            try {
              return (${jsExpr});
            } catch(e) {
              return NaN;
            }
          };
        `;
        const rawFn = new Function(fnCode)() as (x: number, vars?: Record<string, number>) => number;

        const safeFn = (x: number, vars?: Record<string, number>): number => {
          if (domain.x.min !== -Infinity) {
            if (domain.x.minInclusive ? x < domain.x.min : x <= domain.x.min) return NaN;
          }
          if (domain.x.max !== Infinity) {
            if (domain.x.maxInclusive ? x > domain.x.max : x >= domain.x.max) return NaN;
          }
          const val = rawFn(x, vars);
          if (!isFinite(val)) return NaN;
          return val;
        };

        return {
          raw: rawInput,
          expression: rhs,
          domain,
          type: 'explicit_y',
          freeVariables: freeVars,
          isValid: true,
          fnY: safeFn,
        };
      } catch (err: any) {
        return {
          raw: rawInput,
          expression: rhs,
          domain,
          type: 'explicit_y',
          freeVariables: [],
          isValid: false,
          errorMessage: err?.message || 'Syntax error',
        };
      }
    }
  }

  // 4. Expression without "=" that only has "x": default to y = f(x)
  if (!exprText.includes('=') && !/\by\b/i.test(exprText)) {
    const { jsExpr, freeVars } = preprocessExpression(exprText, ['x']);
    try {
      const varSetup = freeVars
        .map(v => `const ${v} = (vars && typeof vars['${v}'] === 'number') ? vars['${v}'] : 1;`)
        .join('\n');
      const fnCode = `
        return function(x, vars) {
          ${varSetup}
          try {
            return (${jsExpr});
          } catch(e) {
            return NaN;
          }
        };
      `;
      const rawFn = new Function(fnCode)() as (x: number, vars?: Record<string, number>) => number;

      const safeFn = (x: number, vars?: Record<string, number>): number => {
        if (domain.x.min !== -Infinity) {
          if (domain.x.minInclusive ? x < domain.x.min : x <= domain.x.min) return NaN;
        }
        if (domain.x.max !== Infinity) {
          if (domain.x.maxInclusive ? x > domain.x.max : x >= domain.x.max) return NaN;
        }
        const val = rawFn(x, vars);
        if (!isFinite(val)) return NaN;
        return val;
      };

      return {
        raw: rawInput,
        expression: exprText,
        domain,
        type: 'explicit_y',
        freeVariables: freeVars,
        isValid: true,
        fnY: safeFn,
      };
    } catch (err: any) {
      return {
        raw: rawInput,
        expression: exprText,
        domain,
        type: 'explicit_y',
        freeVariables: [],
        isValid: false,
        errorMessage: err?.message || 'Syntax error',
      };
    }
  }

  // 5. GENERAL IMPLICIT EQUATION: F(x, y) = 0
  // Handles ANY algebraic order, powers, products, rational, and transcendental functions.
  let lhs = exprText;
  let rhs = '0';

  if (exprText.includes('=')) {
    const parts = exprText.split('=');
    lhs = parts[0].trim();
    rhs = parts[1].trim();
  }

  const { jsExpr: lhsJs, freeVars: lVars } = preprocessExpression(lhs, ['x', 'y']);
  const { jsExpr: rhsJs, freeVars: rVars } = preprocessExpression(rhs, ['x', 'y']);
  const freeVars = Array.from(new Set([...lVars, ...rVars]));

  try {
    const varSetup = freeVars
      .map(v => `const ${v} = (vars && typeof vars['${v}'] === 'number') ? vars['${v}'] : 1;`)
      .join('\n');
    const fnCode = `
      return function(x, y, vars) {
        ${varSetup}
        try {
          const l = (${lhsJs});
          const r = (${rhsJs});
          return l - r;
        } catch(e) {
          return NaN;
        }
      };
    `;
    const fnImplicit = new Function(fnCode)() as (x: number, y: number, vars?: Record<string, number>) => number;

    // Test evaluation at non-zero point to verify compilation
    const testVal = fnImplicit(1.5, 2.5, {});
    if (typeof testVal !== 'number') {
      return {
        raw: rawInput,
        expression: exprText,
        domain,
        type: 'implicit',
        freeVariables: freeVars,
        isValid: false,
        errorMessage: 'Invalid implicit function',
      };
    }

    return {
      raw: rawInput,
      expression: exprText,
      domain,
      type: 'implicit',
      freeVariables: freeVars,
      isValid: true,
      fnImplicit,
    };
  } catch (err: any) {
    return {
      raw: rawInput,
      expression: exprText,
      domain,
      type: 'implicit',
      freeVariables: [],
      isValid: false,
      errorMessage: err?.message || 'Invalid implicit equation',
    };
  }
}

/**
 * Samples any compiled equation into continuous polylines.
 */
export function sampleEquation(
  eq: ParsedEquation,
  xMin: number,
  xMax: number,
  yMin: number = -30,
  yMax: number = 30,
  vars: Record<string, number> = {},
  step: number = 0.04
): CurvePoint[][] {
  if (!eq.isValid) return [];

  // --- ANALYTIC CIRCLE (PARAMETRIC) ---
  if (eq.type === 'circle' && eq.circleData) {
    const r = eq.circleData.getR(vars);
    if (isNaN(r) || r <= 0) return [];

    const { h, k } = eq.circleData;
    const numSteps = 128;
    const polylines: CurvePoint[][] = [];
    let currentLine: CurvePoint[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const theta = (Math.PI * 2 * i) / numSteps;
      const px = h + r * Math.cos(theta);
      const py = k + r * Math.sin(theta);

      if (isPointInDomain(px, py, eq.domain)) {
        currentLine.push({ x: px, y: py });
      } else {
        if (currentLine.length > 1) {
          polylines.push(currentLine);
        }
        currentLine = [];
      }
    }

    if (currentLine.length > 1) {
      polylines.push(currentLine);
    }

    return polylines;
  }

  // --- EXPLICIT X = g(y) ---
  if (eq.type === 'explicit_x' && eq.fnX) {
    const effectiveMinY = Math.max(yMin, eq.domain.y.min);
    const effectiveMaxY = Math.min(yMax, eq.domain.y.max);
    if (effectiveMinY >= effectiveMaxY) return [];

    const polylines: CurvePoint[][] = [];
    let currentLine: CurvePoint[] = [];

    for (let y = effectiveMinY; y <= effectiveMaxY; y += step) {
      const x = eq.fnX(y, vars);
      if (isNaN(x) || Math.abs(x) > 250 || !isPointInDomain(x, y, eq.domain)) {
        if (currentLine.length > 1) polylines.push(currentLine);
        currentLine = [];
        continue;
      }
      currentLine.push({ x, y });
    }
    if (currentLine.length > 1) polylines.push(currentLine);
    return polylines;
  }

  // --- GENERAL IMPLICIT CURVE F(x, y) = 0 VIA MARCHING SQUARES ---
  if (eq.type === 'implicit' && eq.fnImplicit) {
    return sampleMarchingSquares(eq.fnImplicit, xMin, xMax, yMin, yMax, eq.domain, vars);
  }

  // --- STANDARD EXPLICIT Y = f(x) ---
  if (eq.fnY) {
    const effectiveMin = Math.max(xMin, eq.domain.x.min);
    const effectiveMax = Math.min(xMax, eq.domain.x.max);
    if (effectiveMin >= effectiveMax) return [];

    const polylines: CurvePoint[][] = [];
    let currentLine: CurvePoint[] = [];
    const MAX_SLOPE_JUMP = 35;
    const MAX_Y = 250;

    for (let x = effectiveMin; x <= effectiveMax; x += step) {
      const y = eq.fnY(x, vars);
      if (isNaN(y) || Math.abs(y) > MAX_Y || !isPointInDomain(x, y, eq.domain)) {
        if (currentLine.length > 1) polylines.push(currentLine);
        currentLine = [];
        continue;
      }

      if (currentLine.length > 0) {
        const prev = currentLine[currentLine.length - 1];
        const dy = Math.abs(y - prev.y);
        const dx = x - prev.x;
        if (dx > 0 && dy / dx > MAX_SLOPE_JUMP) {
          polylines.push(currentLine);
          currentLine = [];
        }
      }

      currentLine.push({ x, y });
    }

    if (currentLine.length > 1) {
      polylines.push(currentLine);
    }

    return polylines;
  }

  return [];
}

/**
 * 2D Marching Squares with saddle disambiguation & pole filtering
 * for general arbitrary implicit equations F(x, y) = 0.
 */
function sampleMarchingSquares(
  fn: (x: number, y: number, vars?: Record<string, number>) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  domain: Domain2D,
  vars: Record<string, number>,
  gridStep = 0.16
): CurvePoint[][] {
  const nx = Math.ceil((xMax - xMin) / gridStep);
  const ny = Math.ceil((yMax - yMin) / gridStep);
  if (nx <= 1 || ny <= 1) return [];

  const grid = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) {
    const y = yMin + j * gridStep;
    for (let i = 0; i <= nx; i++) {
      const x = xMin + i * gridStep;
      let val = fn(x, y, vars);
      if (isNaN(val) || !isFinite(val) || Math.abs(val) > 1e6) {
        val = NaN;
      }
      grid[j * (nx + 1) + i] = val;
    }
  }

  function interp(x1: number, y1: number, v1: number, x2: number, y2: number, v2: number): CurvePoint | null {
    // Filter pole discontinuities (e.g. 1/x jumping from -1000 to +1000)
    if (Math.abs(v1) > 250 || Math.abs(v2) > 250 || Math.abs(v2 - v1) > 300) {
      return null;
    }
    if (Math.abs(v2 - v1) < 1e-12) return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const t = Math.max(0, Math.min(1, -v1 / (v2 - v1)));
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }

  const polylines: CurvePoint[][] = [];

  for (let j = 0; j < ny; j++) {
    const y0 = yMin + j * gridStep;
    const y1 = y0 + gridStep;
    for (let i = 0; i < nx; i++) {
      const x0 = xMin + i * gridStep;
      const x1 = x0 + gridStep;

      const v0 = grid[j * (nx + 1) + i];
      const v1 = grid[j * (nx + 1) + (i + 1)];
      const v2 = grid[(j + 1) * (nx + 1) + (i + 1)];
      const v3 = grid[(j + 1) * (nx + 1) + i];

      if (isNaN(v0) || isNaN(v1) || isNaN(v2) || isNaN(v3)) continue;

      let mask = 0;
      if (v0 > 0) mask |= 1;
      if (v1 > 0) mask |= 2;
      if (v2 > 0) mask |= 4;
      if (v3 > 0) mask |= 8;

      if (mask === 0 || mask === 15) continue;

      const e0 = () => interp(x0, y0, v0, x1, y0, v1);
      const e1 = () => interp(x1, y0, v1, x1, y1, v2);
      const e2 = () => interp(x0, y1, v3, x1, y1, v2);
      const e3 = () => interp(x0, y0, v0, x0, y1, v3);

      const addSeg = (pA: CurvePoint | null, pB: CurvePoint | null) => {
        if (!pA || !pB) return;
        if (isPointInDomain(pA.x, pA.y, domain) && isPointInDomain(pB.x, pB.y, domain)) {
          polylines.push([pA, pB]);
        }
      };

      switch (mask) {
        case 1: case 14: addSeg(e3(), e0()); break;
        case 2: case 13: addSeg(e0(), e1()); break;
        case 3: case 12: addSeg(e3(), e1()); break;
        case 4: case 11: addSeg(e1(), e2()); break;
        case 5: {
          const centerVal = fn(x0 + gridStep / 2, y0 + gridStep / 2, vars);
          if (centerVal > 0) {
            addSeg(e3(), e2()); addSeg(e0(), e1());
          } else {
            addSeg(e3(), e0()); addSeg(e1(), e2());
          }
          break;
        }
        case 6: case 9:  addSeg(e0(), e2()); break;
        case 7: case 8:  addSeg(e3(), e2()); break;
        case 10: {
          const centerVal = fn(x0 + gridStep / 2, y0 + gridStep / 2, vars);
          if (centerVal > 0) {
            addSeg(e3(), e0()); addSeg(e1(), e2());
          } else {
            addSeg(e3(), e2()); addSeg(e0(), e1());
          }
          break;
        }
      }
    }
  }

  return polylines;
}
