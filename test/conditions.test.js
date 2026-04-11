const { expect } = require('chai')
const { evaluateCondition, evaluatePreset, evaluateProfile, extractPaths } = require('../dist/conditions')

describe('evaluateCondition', () => {
  describe('equals', () => {
    it('returns true for matching string', () => {
      expect(evaluateCondition({ path: 'p', operator: 'equals', value: 'countdown' }, 'countdown')).to.be.true
    })

    it('returns false for non-matching string', () => {
      expect(evaluateCondition({ path: 'p', operator: 'equals', value: 'countdown' }, 'racing')).to.be.false
    })

    it('returns true for matching number', () => {
      expect(evaluateCondition({ path: 'p', operator: 'equals', value: 42 }, 42)).to.be.true
    })

    it('returns false for non-matching number', () => {
      expect(evaluateCondition({ path: 'p', operator: 'equals', value: 42 }, 43)).to.be.false
    })

    it('returns false for null value', () => {
      expect(evaluateCondition({ path: 'p', operator: 'equals', value: 'x' }, null)).to.be.false
    })

    it('returns false for undefined value', () => {
      expect(evaluateCondition({ path: 'p', operator: 'equals', value: 'x' }, undefined)).to.be.false
    })
  })

  describe('notEquals', () => {
    it('returns true when values differ', () => {
      expect(evaluateCondition({ path: 'p', operator: 'notEquals', value: 'countdown' }, 'racing')).to.be.true
    })

    it('returns false when values match', () => {
      expect(evaluateCondition({ path: 'p', operator: 'notEquals', value: 'countdown' }, 'countdown')).to.be.false
    })

    it('returns false for null value', () => {
      expect(evaluateCondition({ path: 'p', operator: 'notEquals', value: 'x' }, null)).to.be.false
    })
  })

  describe('between', () => {
    it('returns true for value in range', () => {
      expect(evaluateCondition({ path: 'p', operator: 'between', min: -60, max: 60 }, 30)).to.be.true
    })

    it('returns true at exact min boundary', () => {
      expect(evaluateCondition({ path: 'p', operator: 'between', min: -60, max: 60 }, -60)).to.be.true
    })

    it('returns true at exact max boundary', () => {
      expect(evaluateCondition({ path: 'p', operator: 'between', min: -60, max: 60 }, 60)).to.be.true
    })

    it('returns false below range', () => {
      expect(evaluateCondition({ path: 'p', operator: 'between', min: -60, max: 60 }, -61)).to.be.false
    })

    it('returns false above range', () => {
      expect(evaluateCondition({ path: 'p', operator: 'between', min: -60, max: 60 }, 61)).to.be.false
    })

    it('returns false for non-numeric value', () => {
      expect(evaluateCondition({ path: 'p', operator: 'between', min: -60, max: 60 }, 'text')).to.be.false
    })

    it('returns false when min is missing', () => {
      expect(evaluateCondition({ path: 'p', operator: 'between', max: 60 }, 30)).to.be.false
    })
  })

  describe('outside', () => {
    it('returns true below min', () => {
      expect(evaluateCondition({ path: 'p', operator: 'outside', min: -60, max: 60 }, -90)).to.be.true
    })

    it('returns true above max', () => {
      expect(evaluateCondition({ path: 'p', operator: 'outside', min: -60, max: 60 }, 90)).to.be.true
    })

    it('returns false for value in range', () => {
      expect(evaluateCondition({ path: 'p', operator: 'outside', min: -60, max: 60 }, 30)).to.be.false
    })

    it('returns false at exact min boundary', () => {
      expect(evaluateCondition({ path: 'p', operator: 'outside', min: -60, max: 60 }, -60)).to.be.false
    })

    it('returns false at exact max boundary', () => {
      expect(evaluateCondition({ path: 'p', operator: 'outside', min: -60, max: 60 }, 60)).to.be.false
    })

    it('returns false for non-numeric value', () => {
      expect(evaluateCondition({ path: 'p', operator: 'outside', min: -60, max: 60 }, 'text')).to.be.false
    })
  })

  describe('unit conversion (deg)', () => {
    const deg60 = 60 * Math.PI / 180

    it('converts between min/max from degrees to radians', () => {
      expect(evaluateCondition(
        { path: 'p', operator: 'between', min: -60, max: 60, unit: 'deg' },
        0
      )).to.be.true
    })

    it('between boundary check with deg conversion', () => {
      expect(evaluateCondition(
        { path: 'p', operator: 'between', min: -60, max: 60, unit: 'deg' },
        deg60
      )).to.be.true
    })

    it('outside with deg conversion', () => {
      expect(evaluateCondition(
        { path: 'p', operator: 'outside', min: -60, max: 60, unit: 'deg' },
        deg60 + 0.01
      )).to.be.true
    })

    it('equals with deg conversion on numeric value', () => {
      expect(evaluateCondition(
        { path: 'p', operator: 'equals', value: 90, unit: 'deg' },
        Math.PI / 2
      )).to.be.true
    })

    it('does not convert string values for equals', () => {
      expect(evaluateCondition(
        { path: 'p', operator: 'equals', value: 'countdown', unit: 'deg' },
        'countdown'
      )).to.be.true
    })
  })
})


describe('evaluatePreset', () => {
  it('returns true when single condition met', () => {
    const preset = { conditions: [{ path: 'a', operator: 'equals', value: 1 }] }
    expect(evaluatePreset(preset, (p) => p === 'a' ? 1 : undefined)).to.be.true
  })

  it('returns false when single condition not met', () => {
    const preset = { conditions: [{ path: 'a', operator: 'equals', value: 1 }] }
    expect(evaluatePreset(preset, () => 2)).to.be.false
  })

  it('returns true when all conditions met (AND)', () => {
    const preset = {
      conditions: [
        { path: 'a', operator: 'equals', value: 'x' },
        { path: 'b', operator: 'between', min: 0, max: 10 }
      ]
    }
    expect(evaluatePreset(preset, (p) => p === 'a' ? 'x' : 5)).to.be.true
  })

  it('returns false when one condition not met (AND)', () => {
    const preset = {
      conditions: [
        { path: 'a', operator: 'equals', value: 'x' },
        { path: 'b', operator: 'between', min: 0, max: 10 }
      ]
    }
    expect(evaluatePreset(preset, (p) => p === 'a' ? 'x' : 20)).to.be.false
  })

  it('returns false for empty conditions', () => {
    expect(evaluatePreset({ conditions: [] }, () => 1)).to.be.false
  })

  it('returns false for missing conditions', () => {
    expect(evaluatePreset({}, () => 1)).to.be.false
  })
})


describe('evaluateProfile', () => {
  const profile = {
    name: 'test',
    presets: [
      { conditions: [{ path: 'a', operator: 'equals', value: 1 }] },
      { conditions: [{ path: 'a', operator: 'equals', value: 2 }] },
      { conditions: [{ path: 'a', operator: 'equals', value: 3 }] },
      { conditions: [] }
    ]
  }

  it('returns first matching preset index', () => {
    expect(evaluateProfile(profile, () => 1)).to.equal(0)
  })

  it('returns second preset when first does not match', () => {
    expect(evaluateProfile(profile, () => 2)).to.equal(1)
  })

  it('returns third preset when first two do not match', () => {
    expect(evaluateProfile(profile, () => 3)).to.equal(2)
  })

  it('returns null when no presets match', () => {
    expect(evaluateProfile(profile, () => 99)).to.be.null
  })

  it('first match wins even if multiple could match', () => {
    const p = {
      name: 'test',
      presets: [
        { conditions: [{ path: 'a', operator: 'between', min: 0, max: 100 }] },
        { conditions: [{ path: 'a', operator: 'between', min: 0, max: 50 }] },
        { conditions: [] },
        { conditions: [] }
      ]
    }
    expect(evaluateProfile(p, () => 25)).to.equal(0)
  })

  it('handles profile with fewer than 4 presets', () => {
    const p = { name: 'short', presets: [{ conditions: [{ path: 'a', operator: 'equals', value: 1 }] }] }
    expect(evaluateProfile(p, () => 1)).to.equal(0)
  })
})


describe('extractPaths', () => {
  it('extracts unique paths from conditions', () => {
    const profile = {
      name: 'test',
      presets: [
        { conditions: [{ path: 'a', operator: 'equals', value: 1 }, { path: 'b', operator: 'equals', value: 2 }] },
        { conditions: [{ path: 'a', operator: 'notEquals', value: 3 }, { path: 'c', operator: 'equals', value: 4 }] },
        { conditions: [] },
        { conditions: [] }
      ]
    }
    const paths = extractPaths(profile)
    expect(paths).to.have.members(['a', 'b', 'c'])
    expect(paths).to.have.lengthOf(3)
  })

  it('returns empty for profile with no conditions', () => {
    const profile = { name: 'empty', presets: [{ conditions: [] }, { conditions: [] }] }
    expect(extractPaths(profile)).to.have.lengthOf(0)
  })
})


describe('Full scenario: default racing profile', () => {
  const deg90 = 90 * Math.PI / 180

  const profile = {
    name: 'default',
    presets: [
      {
        name: 'race time',
        conditions: [
          { path: 'navigation.racing.status', operator: 'equals', value: 'countdown' }
        ]
      },
      {
        name: 'beat',
        conditions: [
          { path: 'navigation.racing.status', operator: 'notEquals', value: 'countdown' },
          { path: 'environment.wind.angleTrueWater', operator: 'between', min: -90, max: 90, unit: 'deg' }
        ]
      },
      {
        name: 'run',
        conditions: [
          { path: 'navigation.racing.status', operator: 'notEquals', value: 'countdown' },
          { path: 'environment.wind.angleTrueWater', operator: 'outside', min: -90, max: 90, unit: 'deg' }
        ]
      },
      { conditions: [] }
    ]
  }

  function makeLookup(status, windAngleRad) {
    return (path) => {
      if (path === 'navigation.racing.status') return status
      if (path === 'environment.wind.angleTrueWater') return windAngleRad
      return undefined
    }
  }

  it('countdown -> preset 0 (race time)', () => {
    expect(evaluateProfile(profile, makeLookup('countdown', 0.5))).to.equal(0)
  })

  it('racing + wind 45deg -> preset 1 (beat)', () => {
    expect(evaluateProfile(profile, makeLookup('racing', 45 * Math.PI / 180))).to.equal(1)
  })

  it('racing + wind -45deg -> preset 1 (beat)', () => {
    expect(evaluateProfile(profile, makeLookup('racing', -45 * Math.PI / 180))).to.equal(1)
  })

  it('racing + wind 120deg -> preset 2 (run)', () => {
    expect(evaluateProfile(profile, makeLookup('racing', 120 * Math.PI / 180))).to.equal(2)
  })

  it('racing + wind -120deg -> preset 2 (run)', () => {
    expect(evaluateProfile(profile, makeLookup('racing', -120 * Math.PI / 180))).to.equal(2)
  })

  it('racing + wind at exactly 90deg boundary -> preset 1 (beat, inclusive)', () => {
    expect(evaluateProfile(profile, makeLookup('racing', deg90))).to.equal(1)
  })

  it('countdown takes priority regardless of wind', () => {
    expect(evaluateProfile(profile, makeLookup('countdown', 120 * Math.PI / 180))).to.equal(0)
  })

  it('unknown status with no wind data -> null', () => {
    expect(evaluateProfile(profile, () => undefined)).to.be.null
  })
})
