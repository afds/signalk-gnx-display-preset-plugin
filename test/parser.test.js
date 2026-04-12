const { expect } = require('chai')
const { parseExpression, extractPaths } = require('../dist/parser')

const DEG = Math.PI / 180

describe('parseExpression', () => {
  describe('boolean literals', () => {
    it('parses true', () => {
      expect(parseExpression('true')).to.deep.equal({ kind: 'true' })
    })

    it('parses false', () => {
      expect(parseExpression('false')).to.deep.equal({ kind: 'false' })
    })

    it('parses TRUE (case-insensitive)', () => {
      expect(parseExpression('TRUE')).to.deep.equal({ kind: 'true' })
    })

    it('true in boolean expression', () => {
      const node = parseExpression("true AND a == 1")
      expect(node.kind).to.equal('and')
      expect(node.left).to.deep.equal({ kind: 'true' })
    })

    it('false in boolean expression', () => {
      const node = parseExpression("a == 1 OR false")
      expect(node.kind).to.equal('or')
      expect(node.right).to.deep.equal({ kind: 'false' })
    })
  })

  describe('equality operators', () => {
    it('parses == with string literal', () => {
      const node = parseExpression("navigation.racing.status == 'countdown'")
      expect(node).to.deep.equal({ kind: 'eq', path: 'navigation.racing.status', value: 'countdown' })
    })

    it('parses == with numeric literal', () => {
      const node = parseExpression('some.path == 42')
      expect(node).to.deep.equal({ kind: 'eq', path: 'some.path', value: 42 })
    })

    it('parses != with string literal', () => {
      const node = parseExpression("navigation.racing.status != 'racing'")
      expect(node).to.deep.equal({ kind: 'neq', path: 'navigation.racing.status', value: 'racing' })
    })
  })

  describe('comparison operators', () => {
    it('parses >', () => {
      const node = parseExpression('environment.wind.speed > 10')
      expect(node).to.deep.equal({ kind: 'gt', path: 'environment.wind.speed', value: 10 })
    })

    it('parses <', () => {
      const node = parseExpression('environment.wind.speed < 5')
      expect(node).to.deep.equal({ kind: 'lt', path: 'environment.wind.speed', value: 5 })
    })

    it('parses >=', () => {
      const node = parseExpression('environment.wind.speed >= 10')
      expect(node).to.deep.equal({ kind: 'gte', path: 'environment.wind.speed', value: 10 })
    })

    it('parses <=', () => {
      const node = parseExpression('environment.wind.speed <= 5')
      expect(node).to.deep.equal({ kind: 'lte', path: 'environment.wind.speed', value: 5 })
    })
  })

  describe('range operators', () => {
    it('parses BETWEEN with numbers', () => {
      const node = parseExpression('environment.wind.angle BETWEEN(-90, 90)')
      expect(node).to.deep.equal({ kind: 'between', path: 'environment.wind.angle', min: -90, max: 90 })
    })

    it('parses OUTSIDE with numbers', () => {
      const node = parseExpression('environment.wind.angle OUTSIDE(-90, 90)')
      expect(node).to.deep.equal({ kind: 'outside', path: 'environment.wind.angle', min: -90, max: 90 })
    })

    it('parses BETWEEN with deg suffix', () => {
      const node = parseExpression('environment.wind.angle BETWEEN(-90deg, 90deg)')
      expect(node.kind).to.equal('between')
      expect(node.path).to.equal('environment.wind.angle')
      expect(node.min).to.be.closeTo(-90 * DEG, 1e-10)
      expect(node.max).to.be.closeTo(90 * DEG, 1e-10)
    })

    it('parses OUTSIDE with deg suffix', () => {
      const node = parseExpression('environment.wind.angle OUTSIDE(-90deg, 90deg)')
      expect(node.kind).to.equal('outside')
      expect(node.min).to.be.closeTo(-90 * DEG, 1e-10)
      expect(node.max).to.be.closeTo(90 * DEG, 1e-10)
    })
  })

  describe('deg suffix on comparison operators', () => {
    it('converts deg suffix on == numeric value', () => {
      const node = parseExpression('some.angle == 90deg')
      expect(node).to.deep.equal({ kind: 'eq', path: 'some.angle', value: 90 * DEG })
    })

    it('converts deg suffix on > value', () => {
      const node = parseExpression('some.angle > 45deg')
      expect(node).to.deep.equal({ kind: 'gt', path: 'some.angle', value: 45 * DEG })
    })
  })

  describe('boolean logic', () => {
    it('parses AND', () => {
      const node = parseExpression("a.b == 'x' AND c.d == 'y'")
      expect(node.kind).to.equal('and')
      expect(node.left).to.deep.equal({ kind: 'eq', path: 'a.b', value: 'x' })
      expect(node.right).to.deep.equal({ kind: 'eq', path: 'c.d', value: 'y' })
    })

    it('parses OR', () => {
      const node = parseExpression("a.b == 'x' OR c.d == 'y'")
      expect(node.kind).to.equal('or')
      expect(node.left).to.deep.equal({ kind: 'eq', path: 'a.b', value: 'x' })
      expect(node.right).to.deep.equal({ kind: 'eq', path: 'c.d', value: 'y' })
    })

    it('parses NOT', () => {
      const node = parseExpression("NOT a.b == 'x'")
      expect(node.kind).to.equal('not')
      expect(node.child).to.deep.equal({ kind: 'eq', path: 'a.b', value: 'x' })
    })

    it('AND has higher precedence than OR', () => {
      // "A OR B AND C" should parse as "A OR (B AND C)"
      const node = parseExpression("a == 1 OR b == 2 AND c == 3")
      expect(node.kind).to.equal('or')
      expect(node.left).to.deep.equal({ kind: 'eq', path: 'a', value: 1 })
      expect(node.right.kind).to.equal('and')
      expect(node.right.left).to.deep.equal({ kind: 'eq', path: 'b', value: 2 })
      expect(node.right.right).to.deep.equal({ kind: 'eq', path: 'c', value: 3 })
    })

    it('NOT has higher precedence than AND', () => {
      // "NOT A AND B" should parse as "(NOT A) AND B"
      const node = parseExpression("NOT a == 1 AND b == 2")
      expect(node.kind).to.equal('and')
      expect(node.left.kind).to.equal('not')
      expect(node.left.child).to.deep.equal({ kind: 'eq', path: 'a', value: 1 })
      expect(node.right).to.deep.equal({ kind: 'eq', path: 'b', value: 2 })
    })

    it('parentheses override precedence', () => {
      // "(A OR B) AND C"
      const node = parseExpression("(a == 1 OR b == 2) AND c == 3")
      expect(node.kind).to.equal('and')
      expect(node.left.kind).to.equal('or')
      expect(node.right).to.deep.equal({ kind: 'eq', path: 'c', value: 3 })
    })

    it('nested parentheses', () => {
      const node = parseExpression("(a == 1 AND (b == 2 OR c == 3))")
      expect(node.kind).to.equal('and')
      expect(node.left).to.deep.equal({ kind: 'eq', path: 'a', value: 1 })
      expect(node.right.kind).to.equal('or')
    })

    it('chained AND is left-associative', () => {
      const node = parseExpression("a == 1 AND b == 2 AND c == 3")
      expect(node.kind).to.equal('and')
      expect(node.left.kind).to.equal('and')
      expect(node.left.left).to.deep.equal({ kind: 'eq', path: 'a', value: 1 })
      expect(node.left.right).to.deep.equal({ kind: 'eq', path: 'b', value: 2 })
      expect(node.right).to.deep.equal({ kind: 'eq', path: 'c', value: 3 })
    })
  })

  describe('whitespace handling', () => {
    it('handles extra whitespace', () => {
      const node = parseExpression("  a.b  ==  'x'  ")
      expect(node).to.deep.equal({ kind: 'eq', path: 'a.b', value: 'x' })
    })

    it('handles newlines in expressions', () => {
      const node = parseExpression("a.b == 'x'\nAND\nc.d == 'y'")
      expect(node.kind).to.equal('and')
    })
  })

  describe('negative numbers', () => {
    it('parses negative number in comparison', () => {
      const node = parseExpression('some.path > -10')
      expect(node).to.deep.equal({ kind: 'gt', path: 'some.path', value: -10 })
    })

    it('parses negative number with deg suffix', () => {
      const node = parseExpression('some.angle > -45deg')
      expect(node).to.deep.equal({ kind: 'gt', path: 'some.angle', value: -45 * DEG })
    })
  })

  describe('floating point numbers', () => {
    it('parses decimal numbers', () => {
      const node = parseExpression('some.path > 3.14')
      expect(node).to.deep.equal({ kind: 'gt', path: 'some.path', value: 3.14 })
    })

    it('parses negative decimal', () => {
      const node = parseExpression('some.path < -0.5')
      expect(node).to.deep.equal({ kind: 'lt', path: 'some.path', value: -0.5 })
    })
  })

  describe('error handling', () => {
    it('throws on empty string', () => {
      expect(() => parseExpression('')).to.throw()
    })

    it('throws on missing operator', () => {
      expect(() => parseExpression('some.path')).to.throw()
    })

    it('throws on missing value after ==', () => {
      expect(() => parseExpression('some.path ==')).to.throw()
    })

    it('throws on unclosed parenthesis', () => {
      expect(() => parseExpression("(a == 1 AND b == 2")).to.throw()
    })

    it('throws on unexpected token', () => {
      expect(() => parseExpression('== 5')).to.throw()
    })

    it('throws on BETWEEN with missing parens', () => {
      expect(() => parseExpression('some.path BETWEEN -90, 90')).to.throw()
    })

    it('throws on BETWEEN with missing comma', () => {
      expect(() => parseExpression('some.path BETWEEN(-90 90)')).to.throw()
    })
  })
})


describe('extractPaths', () => {
  it('extracts path from simple comparison', () => {
    const node = parseExpression("a.b == 'x'")
    expect(extractPaths(node)).to.have.members(['a.b'])
  })

  it('extracts unique paths from AND', () => {
    const node = parseExpression("a.b == 'x' AND c.d == 'y'")
    expect(extractPaths(node)).to.have.members(['a.b', 'c.d'])
  })

  it('deduplicates paths', () => {
    const node = parseExpression("a.b == 'x' AND a.b != 'y'")
    const paths = extractPaths(node)
    expect(paths).to.have.members(['a.b'])
    expect(paths).to.have.lengthOf(1)
  })

  it('extracts paths from complex expression', () => {
    const node = parseExpression("a == 1 AND (b == 2 OR NOT c == 3)")
    expect(extractPaths(node)).to.have.members(['a', 'b', 'c'])
  })

  it('extracts paths from BETWEEN', () => {
    const node = parseExpression('wind.angle BETWEEN(-90deg, 90deg)')
    expect(extractPaths(node)).to.have.members(['wind.angle'])
  })
})
