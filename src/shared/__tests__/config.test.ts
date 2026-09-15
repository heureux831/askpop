import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, PROVIDERS } from '../config'

describe('PROVIDERS', () => {
  it('包含 openai / anthropic / deepseek / custom 四项', () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(['openai', 'anthropic', 'deepseek', 'custom'])
  })

  it('custom 供应商默认 baseURL/model 为空，由用户填写', () => {
    const custom = PROVIDERS.find((p) => p.id === 'custom')!
    expect(custom.defaultBaseURL).toBe('')
    expect(custom.defaultModel).toBe('')
    expect(custom.models).toEqual([])
  })

  it('openai / anthropic / deepseek 提供非空默认 baseURL 和 model', () => {
    for (const p of PROVIDERS.filter((p) => p.id !== 'custom')) {
      expect(p.defaultBaseURL).not.toBe('')
      expect(p.defaultModel).not.toBe('')
      expect(p.models.length).toBeGreaterThan(0)
    }
  })

  it('deepseek 走 OpenAI 兼容协议，提供 deepseek-chat / deepseek-reasoner', () => {
    const deepseek = PROVIDERS.find((p) => p.id === 'deepseek')!
    expect(deepseek.defaultBaseURL).toBe('https://api.deepseek.com/v1')
    expect(deepseek.models).toContain('deepseek-chat')
    expect(deepseek.models).toContain('deepseek-reasoner')
  })
})

describe('DEFAULT_CONFIG', () => {
  it('默认供应商为 openai，model/baseURL 留空以回退到供应商默认值', () => {
    expect(DEFAULT_CONFIG.providerId).toBe('openai')
    expect(DEFAULT_CONFIG.modelId).toBe('')
    expect(DEFAULT_CONFIG.baseURL).toBe('')
  })
})
