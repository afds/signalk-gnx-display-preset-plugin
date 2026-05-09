export interface PresetConfig {
  name?: string
  when: string
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
