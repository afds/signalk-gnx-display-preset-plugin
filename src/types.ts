export type ConditionOperator = 'equals' | 'notEquals' | 'between' | 'outside'

export interface Condition {
  path: string
  operator: ConditionOperator
  value?: string | number
  min?: number
  max?: number
  unit?: 'deg'
}

export interface PresetConfig {
  name?: string
  conditions: Condition[]
}

export interface ProfileConfig {
  name: string
  presets: PresetConfig[]
}

export interface PluginOptions {
  sourceAddress: number
  activeProfile: string
  debounceMs: number
  profiles: ProfileConfig[]
}
