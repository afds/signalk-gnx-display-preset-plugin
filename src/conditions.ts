import { Condition, PresetConfig, ProfileConfig } from './types'

const DEG_TO_RAD = Math.PI / 180

function convertIfDeg(val: number | undefined, unit: string | undefined): number | undefined {
  if (val === undefined) return undefined
  return unit === 'deg' ? val * DEG_TO_RAD : val
}

export function evaluateCondition(condition: Condition, value: unknown): boolean {
  if (value === undefined || value === null) return false

  switch (condition.operator) {
    case 'equals': {
      const target = convertIfDeg(
        typeof condition.value === 'number' ? condition.value : undefined,
        condition.unit
      )
      return target !== undefined ? value === target : value === condition.value
    }

    case 'notEquals': {
      const target = convertIfDeg(
        typeof condition.value === 'number' ? condition.value : undefined,
        condition.unit
      )
      return target !== undefined ? value !== target : value !== condition.value
    }

    case 'between': {
      if (typeof value !== 'number') return false
      const min = convertIfDeg(condition.min, condition.unit)
      const max = convertIfDeg(condition.max, condition.unit)
      if (min === undefined || max === undefined) return false
      return value >= min && value <= max
    }

    case 'outside': {
      if (typeof value !== 'number') return false
      const min = convertIfDeg(condition.min, condition.unit)
      const max = convertIfDeg(condition.max, condition.unit)
      if (min === undefined || max === undefined) return false
      return value < min || value > max
    }

    default:
      return false
  }
}

export function evaluatePreset(
  preset: PresetConfig,
  getPathValue: (path: string) => unknown
): boolean {
  if (!preset.conditions || preset.conditions.length === 0) return false
  return preset.conditions.every(c => evaluateCondition(c, getPathValue(c.path)))
}

export function evaluateProfile(
  profile: ProfileConfig,
  getPathValue: (path: string) => unknown
): number | null {
  for (let i = 0; i < profile.presets.length && i < 4; i++) {
    if (evaluatePreset(profile.presets[i], getPathValue)) {
      return i
    }
  }
  return null
}

export function extractPaths(profile: ProfileConfig): string[] {
  const paths = new Set<string>()
  for (const preset of profile.presets) {
    if (preset.conditions) {
      for (const condition of preset.conditions) {
        if (condition.path) paths.add(condition.path)
      }
    }
  }
  return Array.from(paths)
}
