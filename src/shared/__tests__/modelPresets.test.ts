import { describe, expect, it } from 'vitest'
import { MODEL_PRESETS, getModelPreset, validateThinking, thinkingEnabled } from '../modelPresets'

describe('model capability registry', () => {
  it('has unique IDs and valid thinking defaults', () => {
    expect(new Set(MODEL_PRESETS.map((p) => p.id)).size).toBe(MODEL_PRESETS.length)
    for (const p of MODEL_PRESETS) {
      if (p.defaultEffort) expect(p.efforts).toContain(p.defaultEffort)
      if (!p.canDisable) expect(p.defaultThinking).toBe(true)
      expect(() => validateThinking({ providerId: p.providerId, modelId: p.modelId, baseURL: '', presetId: p.id, thinking: 'default' })).not.toThrow()
    }
  })
  it('recognizes legacy DeepSeek Flash on the official custom endpoint without rewriting its ID', () => {
    const model = { providerId: 'custom' as const, baseURL: 'https://api.deepseek.com/v1', modelId: 'deepseek-v4-flash' }
    const preset = getModelPreset(model)
    expect(preset?.id).toBe('deepseek/flash')
    expect(thinkingEnabled({}, preset)).toBe(true)
    expect(thinkingEnabled({ thinking: 'disabled' }, preset)).toBe(false)
  })
  it('requires an explicit compatibility preset for an unknown proxy', () => {
    const model = { providerId: 'custom' as const, baseURL: 'https://proxy.example.test/v1', modelId: 'deepseek-v4-flash' }
    expect(getModelPreset(model)).toBeUndefined()
    expect(getModelPreset({ ...model, presetId: 'deepseek/flash' })?.providerId).toBe('deepseek')
  })
  it('rejects presets from another named provider', () => {
    expect(() => validateThinking({ providerId: 'openai', baseURL: 'https://api.openai.com/v1', modelId: 'gpt-4o', presetId: 'deepseek/flash' })).toThrow('不匹配')
  })
})
