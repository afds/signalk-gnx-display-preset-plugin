const { expect } = require('chai')
const { evaluate } = require('../dist/expression')
const { parseExpression } = require('../dist/parser')

function eval$(expr, values, previouslyActive) {
  const node = parseExpression(expr)
  return evaluate(node, (path) => values[path], previouslyActive)
}

describe('evaluate', () => {
  describe('boolean literals', () => {
    it('true always returns true', () => {
      expect(eval$('true', {})).to.be.true
    })

    it('false always returns false', () => {
      expect(eval$('false', {})).to.be.false
    })
  })

  describe('equality operators', () => {
    it('== returns true for matching string', () => {
      expect(eval$("a == 'x'", { a: 'x' })).to.be.true
    })

    it('== returns false for non-matching string', () => {
      expect(eval$("a == 'x'", { a: 'y' })).to.be.false
    })

    it('== returns true for matching number', () => {
      expect(eval$('a == 42', { a: 42 })).to.be.true
    })

    it('== returns false for non-matching number', () => {
      expect(eval$('a == 42', { a: 43 })).to.be.false
    })

    it('!= returns true when values differ', () => {
      expect(eval$("a != 'x'", { a: 'y' })).to.be.true
    })

    it('!= returns false when values match', () => {
      expect(eval$("a != 'x'", { a: 'x' })).to.be.false
    })
  })

  describe('comparison operators', () => {
    it('> returns true when value is greater', () => {
      expect(eval$('a > 10', { a: 15 })).to.be.true
    })

    it('> returns false when value is equal', () => {
      expect(eval$('a > 10', { a: 10 })).to.be.false
    })

    it('> returns false when value is less', () => {
      expect(eval$('a > 10', { a: 5 })).to.be.false
    })

    it('< returns true when value is less', () => {
      expect(eval$('a < 10', { a: 5 })).to.be.true
    })

    it('>= returns true when equal', () => {
      expect(eval$('a >= 10', { a: 10 })).to.be.true
    })

    it('<= returns true when equal', () => {
      expect(eval$('a <= 10', { a: 10 })).to.be.true
    })
  })

  describe('range operators', () => {
    it('BETWEEN returns true for value in range', () => {
      expect(eval$('a BETWEEN(-60, 60)', { a: 30 })).to.be.true
    })

    it('BETWEEN returns true at min boundary (inclusive)', () => {
      expect(eval$('a BETWEEN(-60, 60)', { a: -60 })).to.be.true
    })

    it('BETWEEN returns true at max boundary (inclusive)', () => {
      expect(eval$('a BETWEEN(-60, 60)', { a: 60 })).to.be.true
    })

    it('BETWEEN returns false below range', () => {
      expect(eval$('a BETWEEN(-60, 60)', { a: -61 })).to.be.false
    })

    it('BETWEEN returns false above range', () => {
      expect(eval$('a BETWEEN(-60, 60)', { a: 61 })).to.be.false
    })

    it('OUTSIDE returns true below min', () => {
      expect(eval$('a OUTSIDE(-60, 60)', { a: -90 })).to.be.true
    })

    it('OUTSIDE returns true above max', () => {
      expect(eval$('a OUTSIDE(-60, 60)', { a: 90 })).to.be.true
    })

    it('OUTSIDE returns false in range', () => {
      expect(eval$('a OUTSIDE(-60, 60)', { a: 30 })).to.be.false
    })

    it('OUTSIDE returns false at min boundary (exclusive)', () => {
      expect(eval$('a OUTSIDE(-60, 60)', { a: -60 })).to.be.false
    })

    it('OUTSIDE returns false at max boundary (exclusive)', () => {
      expect(eval$('a OUTSIDE(-60, 60)', { a: 60 })).to.be.false
    })
  })

  describe('null/undefined handling', () => {
    it('== returns false for undefined path', () => {
      expect(eval$("a == 'x'", {})).to.be.false
    })

    it('== returns false for null value', () => {
      expect(eval$("a == 'x'", { a: null })).to.be.false
    })

    it('!= returns false for undefined path', () => {
      expect(eval$("a != 'x'", {})).to.be.false
    })

    it('> returns false for non-numeric value', () => {
      expect(eval$('a > 10', { a: 'text' })).to.be.false
    })

    it('BETWEEN returns false for non-numeric value', () => {
      expect(eval$('a BETWEEN(0, 10)', { a: 'text' })).to.be.false
    })

    it('BETWEEN returns false for undefined value', () => {
      expect(eval$('a BETWEEN(0, 10)', {})).to.be.false
    })

    it('OUTSIDE returns false for non-numeric value', () => {
      expect(eval$('a OUTSIDE(0, 10)', { a: 'text' })).to.be.false
    })
  })

  describe('boolean logic', () => {
    it('AND: true when both sides true', () => {
      expect(eval$("a == 'x' AND b == 'y'", { a: 'x', b: 'y' })).to.be.true
    })

    it('AND: false when left side false', () => {
      expect(eval$("a == 'x' AND b == 'y'", { a: 'z', b: 'y' })).to.be.false
    })

    it('AND: false when right side false', () => {
      expect(eval$("a == 'x' AND b == 'y'", { a: 'x', b: 'z' })).to.be.false
    })

    it('OR: true when either side true', () => {
      expect(eval$("a == 'x' OR b == 'y'", { a: 'z', b: 'y' })).to.be.true
    })

    it('OR: false when both sides false', () => {
      expect(eval$("a == 'x' OR b == 'y'", { a: 'z', b: 'z' })).to.be.false
    })

    it('NOT: inverts true to false', () => {
      expect(eval$("NOT a == 'x'", { a: 'x' })).to.be.false
    })

    it('NOT: inverts false to true', () => {
      expect(eval$("NOT a == 'x'", { a: 'y' })).to.be.true
    })

    it('complex: (A AND B) OR C', () => {
      expect(eval$("(a == 1 AND b == 2) OR c == 3", { a: 1, b: 2, c: 0 })).to.be.true
      expect(eval$("(a == 1 AND b == 2) OR c == 3", { a: 0, b: 0, c: 3 })).to.be.true
      expect(eval$("(a == 1 AND b == 2) OR c == 3", { a: 0, b: 0, c: 0 })).to.be.false
    })
  })

  describe('hysteresis', () => {
    it('BETWEEN with hysteresis widens range when previouslyActive', () => {
      // Without hysteresis arg: BETWEEN(-60, 60) at 61 -> false
      expect(eval$('a BETWEEN(-60, 60)', { a: 61 }, false)).to.be.false
      // With hysteresis=5 and previouslyActive: range widens to [-65, 65]
      expect(eval$('a BETWEEN(-60, 60, 5)', { a: 61 }, true)).to.be.true
      // 66 is still outside even with hysteresis=5
      expect(eval$('a BETWEEN(-60, 60, 5)', { a: 66 }, true)).to.be.false
    })

    it('BETWEEN hysteresis does not apply when not previouslyActive', () => {
      // Entry threshold is strict: 61 is not in [-60, 60]
      expect(eval$('a BETWEEN(-60, 60, 5)', { a: 61 }, false)).to.be.false
    })

    it('OUTSIDE with hysteresis narrows dead zone when previouslyActive', () => {
      // Without hysteresis arg: OUTSIDE(-60, 60) at -59 -> false
      expect(eval$('a OUTSIDE(-60, 60)', { a: -59 }, false)).to.be.false
      // With hysteresis=5 and previouslyActive: thresholds become [-55, 55]
      expect(eval$('a OUTSIDE(-60, 60, 5)', { a: -59 }, true)).to.be.true
    })

    it('OUTSIDE hysteresis does not apply when not previouslyActive', () => {
      expect(eval$('a OUTSIDE(-60, 60, 5)', { a: -59 }, false)).to.be.false
    })

    it('BETWEEN with deg hysteresis converts correctly', () => {
      const deg = Math.PI / 180
      // BETWEEN(-90deg, 90deg, 5deg): boundaries ~1.5708, hysteresis ~0.0873
      // At 91 degrees (just past max), with hysteresis active, should be true
      expect(eval$('a BETWEEN(-90deg, 90deg, 5deg)', { a: 91 * deg }, true)).to.be.true
      // At 96 degrees (past hysteresis), should be false
      expect(eval$('a BETWEEN(-90deg, 90deg, 5deg)', { a: 96 * deg }, true)).to.be.false
    })

    it('no hysteresis argument: behaves without deadband regardless of previouslyActive', () => {
      expect(eval$('a BETWEEN(-60, 60)', { a: 61 }, true)).to.be.false
      expect(eval$('a OUTSIDE(-60, 60)', { a: -59 }, true)).to.be.false
    })
  })

  describe('full scenario: default racing profile', () => {
    const deg = Math.PI / 180

    function evalProfile(presetExprs, values) {
      for (let i = 0; i < presetExprs.length; i++) {
        if (!presetExprs[i]) continue
        const node = parseExpression(presetExprs[i])
        if (evaluate(node, (path) => values[path])) {
          return i
        }
      }
      return null
    }

    const presets = [
      "navigation.racing.status == 'countdown'",
      "navigation.racing.status == 'racing' AND environment.wind.angleTrueWater BETWEEN(-90deg, 90deg)",
      "navigation.racing.status == 'racing' AND environment.wind.angleTrueWater OUTSIDE(-90deg, 90deg)",
      ''
    ]

    function lookup(status, windAngleRad) {
      return {
        'navigation.racing.status': status,
        'environment.wind.angleTrueWater': windAngleRad
      }
    }

    it('countdown -> preset 0', () => {
      expect(evalProfile(presets, lookup('countdown', 0.5))).to.equal(0)
    })

    it('racing + wind 45deg -> preset 1 (beat)', () => {
      expect(evalProfile(presets, lookup('racing', 45 * deg))).to.equal(1)
    })

    it('racing + wind -45deg -> preset 1 (beat)', () => {
      expect(evalProfile(presets, lookup('racing', -45 * deg))).to.equal(1)
    })

    it('racing + wind 120deg -> preset 2 (run)', () => {
      expect(evalProfile(presets, lookup('racing', 120 * deg))).to.equal(2)
    })

    it('racing + wind -120deg -> preset 2 (run)', () => {
      expect(evalProfile(presets, lookup('racing', -120 * deg))).to.equal(2)
    })

    it('racing + wind at exactly 90deg boundary -> preset 1 (beat, inclusive)', () => {
      expect(evalProfile(presets, lookup('racing', 90 * deg))).to.equal(1)
    })

    it('countdown takes priority regardless of wind', () => {
      expect(evalProfile(presets, lookup('countdown', 120 * deg))).to.equal(0)
    })

    it('unknown status -> null', () => {
      expect(evalProfile(presets, lookup('unknown', 0))).to.be.null
    })
  })
})
