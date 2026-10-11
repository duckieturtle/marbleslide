// src/math/latexRenderer.ts
// Converts user equation expressions into KaTeX LaTeX and renders math HTML with powers, fractions, and symbols.

import katex from 'katex';

interface Token {
  type: 'NUM' | 'ID' | 'REL' | 'OP' | 'LPAREN' | 'RPAREN' | 'EQ' | 'OTHER' | 'EOF';
  val?: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/\d|\./.test(ch)) {
      let num = '';
      while (i < s.length && /[\d.]/.test(s[i])) {
        num += s[i];
        i++;
      }
      tokens.push({ type: 'NUM', val: num });
      continue;
    }

    if (/[a-zA-Z_π]/.test(ch)) {
      let id = '';
      while (i < s.length && /[a-zA-Z0-9_π]/.test(s[i])) {
        id += s[i];
        i++;
      }
      tokens.push({ type: 'ID', val: id });
      continue;
    }

    if (ch === '<' || ch === '>') {
      if (s[i + 1] === '=') {
        tokens.push({ type: 'REL', val: ch + '=' });
        i += 2;
      } else {
        tokens.push({ type: 'REL', val: ch });
        i++;
      }
      continue;
    }

    if (ch === '!') {
      if (s[i + 1] === '=') {
        tokens.push({ type: 'REL', val: '!=' });
        i += 2;
      } else {
        tokens.push({ type: 'OP', val: '!' });
        i++;
      }
      continue;
    }

    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (ch === '=') { tokens.push({ type: 'EQ' }); i++; continue; }
    if ('+-*/^'.includes(ch)) { tokens.push({ type: 'OP', val: ch }); i++; continue; }

    tokens.push({ type: 'OTHER', val: ch });
    i++;
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

type ASTNode =
  | { type: 'placeholder' }
  | { type: 'num'; val: string }
  | { type: 'var'; name: string }
  | { type: 'paren'; inner: ASTNode }
  | { type: 'unary'; op: string; arg: ASTNode }
  | { type: 'func'; name: string; arg: ASTNode }
  | { type: 'power'; base: ASTNode; exp: ASTNode }
  | { type: 'binop'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'equation'; lhs: ASTNode; rhs: ASTNode };

class MathParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(type?: Token['type'], val?: string): Token | null {
    const tok = this.peek();
    if (tok.type === 'EOF') return tok;
    if (type && tok.type !== type) return null;
    if (val && tok.val !== val) return null;
    this.pos++;
    return tok;
  }

  public parseEquation(): ASTNode {
    const lhs = this.parseAdditive();
    if (this.peek().type === 'EQ') {
      this.consume('EQ');
      const rhs = this.pos < this.tokens.length - 1 ? this.parseAdditive() : { type: 'placeholder' as const };
      return { type: 'equation', lhs, rhs };
    }
    return lhs;
  }

  private parseAdditive(): ASTNode {
    let node = this.parseMultiplicative();

    while (this.peek().type === 'OP' && (this.peek().val === '+' || this.peek().val === '-')) {
      const op = this.consume('OP')!.val!;
      const right = this.parseMultiplicative();
      node = { type: 'binop', op, left: node, right };
    }

    return node;
  }

  private parseMultiplicative(): ASTNode {
    let node = this.parsePower();

    while (true) {
      const tok = this.peek();
      if (tok.type === 'OP' && (tok.val === '*' || tok.val === '/')) {
        const op = this.consume('OP')!.val!;
        const right = this.parsePower();
        node = { type: 'binop', op, left: node, right };
      } else if (this.isImplicitMulStart(tok)) {
        const right = this.parsePower();
        node = { type: 'binop', op: 'implicit_mul', left: node, right };
      } else {
        break;
      }
    }

    return node;
  }

  private isImplicitMulStart(tok: Token): boolean {
    return tok.type === 'ID' || tok.type === 'NUM' || tok.type === 'LPAREN';
  }

  private parsePower(): ASTNode {
    let node = this.parseUnary();

    if (this.peek().type === 'OP' && this.peek().val === '^') {
      this.consume('OP');
      const right = this.parsePower();
      node = { type: 'power', base: node, exp: right };
    }

    return node;
  }

  private parseUnary(): ASTNode {
    const tok = this.peek();
    if (tok.type === 'OP' && (tok.val === '-' || tok.val === '+')) {
      this.consume('OP');
      const arg = this.parseUnary();
      return { type: 'unary', op: tok.val, arg };
    }
    return this.parseAtom();
  }

  private parseAtom(): ASTNode {
    const tok = this.peek();

    if (tok.type === 'NUM') {
      this.consume('NUM');
      return { type: 'num', val: tok.val! };
    }

    if (tok.type === 'ID') {
      this.consume('ID');
      const id = tok.val!;

      if (this.peek().type === 'LPAREN') {
        this.consume('LPAREN');
        const arg = this.peek().type === 'RPAREN' ? { type: 'placeholder' as const } : this.parseAdditive();
        this.consume('RPAREN');
        return { type: 'func', name: id, arg };
      }

      return { type: 'var', name: id };
    }

    if (tok.type === 'LPAREN') {
      this.consume('LPAREN');
      const inner = this.peek().type === 'RPAREN' ? { type: 'placeholder' as const } : this.parseAdditive();
      this.consume('RPAREN');
      return { type: 'paren', inner };
    }

    return { type: 'placeholder' };
  }
}

function astToLatex(node: ASTNode): string {
  if (!node) return '\\square';

  switch (node.type) {
    case 'placeholder':
      return '\\square';

    case 'num':
      return node.val;

    case 'var':
      if (node.name.toLowerCase() === 'pi' || node.name === 'π') return '\\pi';
      if (node.name.toLowerCase() === 'e') return 'e';
      return node.name;

    case 'paren':
      return `\\left(${astToLatex(node.inner)}\\right)`;

    case 'unary':
      return `${node.op}${astToLatex(node.arg)}`;

    case 'func': {
      const name = node.name.toLowerCase();
      if (name === 'sqrt') return `\\sqrt{${astToLatex(node.arg)}}`;
      if (name === 'cbrt') return `\\sqrt[3]{${astToLatex(node.arg)}}`;
      if (name === 'abs') return `\\left|${astToLatex(node.arg)}\\right|`;
      if (name === 'log10') return `\\log_{10}\\left(${astToLatex(node.arg)}\\right)`;
      if (name === 'log2') return `\\log_{2}\\left(${astToLatex(node.arg)}\\right)`;
      if (name === 'exp') return `e^{${astToLatex(node.arg)}}`;
      const trig = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'ln', 'log'];
      if (trig.includes(name)) {
        return `\\${name}\\left(${astToLatex(node.arg)}\\right)`;
      }
      return `\\text{${node.name}}\\left(${astToLatex(node.arg)}\\right)`;
    }

    case 'power': {
      const baseStr = astToLatex(node.base);
      const expStr = astToLatex(node.exp);
      return `${baseStr}^{${expStr}}`;
    }

    case 'binop': {
      if (node.op === '/') {
        const numNode = node.left.type === 'paren' ? node.left.inner : node.left;
        const denNode = node.right.type === 'paren' ? node.right.inner : node.right;
        const numStr = astToLatex(numNode);
        const denStr = astToLatex(denNode);
        return `\\frac{${numStr}}{${denStr}}`;
      }

      if (node.op === 'implicit_mul') {
        const leftStr = astToLatex(node.left);
        const rightStr = astToLatex(node.right);
        return `${leftStr}${rightStr}`;
      }

      if (node.op === '*') {
        const leftStr = astToLatex(node.left);
        const rightStr = astToLatex(node.right);
        if (
          (node.left.type === 'num' || node.left.type === 'var') &&
          (node.right.type === 'var' || node.right.type === 'paren' || node.right.type === 'func' || node.right.type === 'power')
        ) {
          return `${leftStr}${rightStr}`;
        }
        return `${leftStr} \\cdot ${rightStr}`;
      }

      if (node.op === '+') {
        return `${astToLatex(node.left)} + ${astToLatex(node.right)}`;
      }

      if (node.op === '-') {
        return `${astToLatex(node.left)} - ${astToLatex(node.right)}`;
      }

      return `${astToLatex(node.left)} ${node.op} ${astToLatex(node.right)}`;
    }

    case 'equation':
      return `${astToLatex(node.lhs)} = ${astToLatex(node.rhs)}`;

    default:
      return '\\square';
  }
}

export function equationToLatex(raw: string): string {
  if (!raw || !raw.trim()) return '\\cdots';

  let s = raw.trim();
  let domain = '';
  const domainMatch = s.match(/\{([^}]+)\}/);
  if (domainMatch) {
    domain = domainMatch[1].trim();
    s = s.replace(/\{[^}]*\}/, '').trim();
  }

  let latex = '';
  try {
    const tokens = tokenize(s);
    const parser = new MathParser(tokens);
    const ast = parser.parseEquation();
    latex = astToLatex(ast);
  } catch {
    latex = s;
  }

  if (domain) {
    const formattedDomain = domain
      .replace(/<=/g, ' \\le ')
      .replace(/>=/g, ' \\ge ')
      .replace(/!=/g, ' \\ne ');
    latex += ` \\quad \\left\\{ ${formattedDomain} \\right\\}`;
  }

  return latex;
}

export function renderMathHtml(raw: string): string {
  if (!raw || !raw.trim()) {
    return '<span class="katex-empty">y = &hellip;</span>';
  }

  try {
    const latex = equationToLatex(raw);
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return `<span class="katex-fallback">${escapeHtml(raw)}</span>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
