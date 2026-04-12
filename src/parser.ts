export type ExprNode =
  | { kind: 'and'; left: ExprNode; right: ExprNode }
  | { kind: 'or'; left: ExprNode; right: ExprNode }
  | { kind: 'not'; child: ExprNode }
  | { kind: 'eq'; path: string; value: string | number }
  | { kind: 'neq'; path: string; value: string | number }
  | { kind: 'gt'; path: string; value: number }
  | { kind: 'lt'; path: string; value: number }
  | { kind: 'gte'; path: string; value: number }
  | { kind: 'lte'; path: string; value: number }
  | { kind: 'between'; path: string; min: number; max: number }
  | { kind: 'outside'; path: string; min: number; max: number }
  | { kind: 'true' }
  | { kind: 'false' }

const DEG_TO_RAD = Math.PI / 180

type Token =
  | { type: 'path'; value: string }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'op'; value: string }
  | { type: 'keyword'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) { i++; continue }

    // String literal
    if (input[i] === "'") {
      i++
      let str = ''
      while (i < input.length && input[i] !== "'") {
        str += input[i++]
      }
      if (i >= input.length) throw new Error(`Unterminated string at position ${i}`)
      i++ // closing quote
      tokens.push({ type: 'string', value: str })
      continue
    }

    // Parentheses
    if (input[i] === '(' || input[i] === ')') {
      tokens.push({ type: 'paren', value: input[i] as '(' | ')' })
      i++
      continue
    }

    // Comma
    if (input[i] === ',') {
      tokens.push({ type: 'comma' })
      i++
      continue
    }

    // Operators: ==, !=, >=, <=, >, <
    if (input[i] === '=' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '==' }); i += 2; continue
    }
    if (input[i] === '!' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '!=' }); i += 2; continue
    }
    if (input[i] === '>' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '>=' }); i += 2; continue
    }
    if (input[i] === '<' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '<=' }); i += 2; continue
    }
    if (input[i] === '>') {
      tokens.push({ type: 'op', value: '>' }); i++; continue
    }
    if (input[i] === '<') {
      tokens.push({ type: 'op', value: '<' }); i++; continue
    }

    // Negative number: - followed by digit, and previous token is an operator, keyword, paren, or comma (or start)
    if (input[i] === '-' && i + 1 < input.length && /[0-9.]/.test(input[i + 1])) {
      const prev = tokens[tokens.length - 1]
      if (!prev || prev.type === 'op' || prev.type === 'keyword' ||
          (prev.type === 'paren' && prev.value === '(') || prev.type === 'comma') {
        i++ // skip the minus
        let numStr = '-'
        while (i < input.length && /[0-9.]/.test(input[i])) {
          numStr += input[i++]
        }
        let num = parseFloat(numStr)
        if (i < input.length && input.slice(i, i + 3) === 'deg') {
          num *= DEG_TO_RAD
          i += 3
        }
        tokens.push({ type: 'number', value: num })
        continue
      }
    }

    // Number
    if (/[0-9.]/.test(input[i])) {
      let numStr = ''
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i++]
      }
      let num = parseFloat(numStr)
      if (i < input.length && input.slice(i, i + 3) === 'deg') {
        num *= DEG_TO_RAD
        i += 3
      }
      tokens.push({ type: 'number', value: num })
      continue
    }

    // Words: keywords (AND, OR, NOT, BETWEEN, OUTSIDE) or paths
    if (/[a-zA-Z_]/.test(input[i])) {
      let word = ''
      while (i < input.length && /[a-zA-Z0-9._]/.test(input[i])) {
        word += input[i++]
      }
      const upper = word.toUpperCase()
      if (upper === 'AND' || upper === 'OR' || upper === 'NOT' ||
          upper === 'BETWEEN' || upper === 'OUTSIDE' ||
          upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'keyword', value: upper })
      } else {
        tokens.push({ type: 'path', value: word })
      }
      continue
    }

    throw new Error(`Unexpected character '${input[i]}' at position ${i}`)
  }

  return tokens
}

class Parser {
  private tokens: Token[]
  private pos: number

  constructor(tokens: Token[]) {
    this.tokens = tokens
    this.pos = 0
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private advance(): Token {
    const t = this.tokens[this.pos]
    if (!t) throw new Error('Unexpected end of expression')
    this.pos++
    return t
  }

  private expect(type: string, value?: string): Token {
    const t = this.advance()
    if (t.type !== type || (value !== undefined && (t as any).value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''} but got ${t.type} '${(t as any).value}'`)
    }
    return t
  }

  parse(): ExprNode {
    const node = this.parseOr()
    if (this.pos < this.tokens.length) {
      const t = this.peek()!
      throw new Error(`Unexpected token ${t.type} '${(t as any).value}'`)
    }
    return node
  }

  // OR has lowest precedence
  private parseOr(): ExprNode {
    let left = this.parseAnd()
    while (this.peek()?.type === 'keyword' && (this.peek() as any).value === 'OR') {
      this.advance()
      const right = this.parseAnd()
      left = { kind: 'or', left, right }
    }
    return left
  }

  // AND has middle precedence
  private parseAnd(): ExprNode {
    let left = this.parseNot()
    while (this.peek()?.type === 'keyword' && (this.peek() as any).value === 'AND') {
      this.advance()
      const right = this.parseNot()
      left = { kind: 'and', left, right }
    }
    return left
  }

  // NOT has highest precedence among logic operators
  private parseNot(): ExprNode {
    if (this.peek()?.type === 'keyword' && (this.peek() as any).value === 'NOT') {
      this.advance()
      const child = this.parseNot()
      return { kind: 'not', child }
    }
    return this.parsePrimary()
  }

  // Primary: parenthesized expression or comparison
  private parsePrimary(): ExprNode {
    const t = this.peek()
    if (!t) throw new Error('Unexpected end of expression')

    // Boolean literals
    if (t.type === 'keyword' && t.value === 'TRUE') {
      this.advance()
      return { kind: 'true' }
    }
    if (t.type === 'keyword' && t.value === 'FALSE') {
      this.advance()
      return { kind: 'false' }
    }

    // Parenthesized expression
    if (t.type === 'paren' && t.value === '(') {
      this.advance()
      const node = this.parseOr()
      this.expect('paren', ')')
      return node
    }

    // Must be a comparison: path op value
    if (t.type !== 'path') {
      throw new Error(`Expected path but got ${t.type} '${(t as any).value}'`)
    }

    const path = (this.advance() as { type: 'path'; value: string }).value
    const op = this.advance()

    if (op.type === 'op') {
      const val = this.advance()
      let value: string | number
      if (val.type === 'string') {
        value = val.value
      } else if (val.type === 'number') {
        value = val.value
      } else {
        throw new Error(`Expected value after operator but got ${val.type}`)
      }

      switch (op.value) {
        case '==': return { kind: 'eq', path, value }
        case '!=': return { kind: 'neq', path, value }
        case '>': return { kind: 'gt', path, value: value as number }
        case '<': return { kind: 'lt', path, value: value as number }
        case '>=': return { kind: 'gte', path, value: value as number }
        case '<=': return { kind: 'lte', path, value: value as number }
        default: throw new Error(`Unknown operator '${op.value}'`)
      }
    }

    if (op.type === 'keyword' && (op.value === 'BETWEEN' || op.value === 'OUTSIDE')) {
      this.expect('paren', '(')
      const minTok = this.advance()
      if (minTok.type !== 'number') throw new Error(`Expected number for min but got ${minTok.type}`)
      this.expect('comma')
      const maxTok = this.advance()
      if (maxTok.type !== 'number') throw new Error(`Expected number for max but got ${maxTok.type}`)
      this.expect('paren', ')')

      const kind = op.value === 'BETWEEN' ? 'between' as const : 'outside' as const
      return { kind, path, min: minTok.value, max: maxTok.value }
    }

    throw new Error(`Expected operator after path but got ${op.type} '${(op as any).value}'`)
  }
}

export function parseExpression(input: string): ExprNode {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Empty expression')
  const tokens = tokenize(trimmed)
  return new Parser(tokens).parse()
}

export function extractPaths(node: ExprNode): string[] {
  const paths = new Set<string>()
  function walk(n: ExprNode) {
    switch (n.kind) {
      case 'and':
      case 'or':
        walk(n.left)
        walk(n.right)
        break
      case 'not':
        walk(n.child)
        break
      case 'true':
      case 'false':
        break
      default:
        paths.add(n.path)
    }
  }
  walk(node)
  return Array.from(paths)
}
