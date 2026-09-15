import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG } from '@shared/config'
import { getPublicConfig, getResolvedConfig, resolveModel } from '../resolve'
import { setApiKey, setCipherProvider, setSecretPath } from '../secretStore'
import { setConfigPath, saveConfig } from '../store'

describe('getResolvedConfig', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-resolve-'))
    setConfigPath(join(dir, 'config.json'))
    setSecretPath(join(dir, 'secrets.bin'))
    setCipherProvider({
      encrypt: (s) => Buffer.from(s).toString('base64'),
      decrypt: (b) => Buffer.from(b.toString(), 'base64').toString()
    })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('baseURL/modelId 留空时回退到供应商默认值', () => {
    saveConfig({ ...DEFAULT_CONFIG, providerId: 'openai' })
    const cfg = getResolvedConfig()
    expect(cfg.baseURL).toBe('https://api.openai.com/v1')
    expect(cfg.modelId).toBe('gpt-4o')
  })

  it('显式填写的 baseURL/modelId 优先于默认值', () => {
    saveConfig({ ...DEFAULT_CONFIG, providerId: 'openai', baseURL: 'https://x.com/v1', modelId: 'my-model' })
    expect(getResolvedConfig().baseURL).toBe('https://x.com/v1')
    expect(getResolvedConfig().modelId).toBe('my-model')
  })

  it('apiKey 从 secretStore 读出', () => {
    saveConfig(DEFAULT_CONFIG)
    setApiKey('sk-abc')
    expect(getResolvedConfig().apiKey).toBe('sk-abc')
  })

  it('getPublicConfig 不泄露 apiKey，只暴露 hasApiKey', () => {
    saveConfig(DEFAULT_CONFIG)
    setApiKey('sk-abc')
    const pub = getPublicConfig()
    expect(pub).not.toHaveProperty('apiKey')
    expect(pub.hasApiKey).toBe(true)
  })
})

describe('resolveModel', () => {
  it('anthropic 走 createAnthropic，其余走 createOpenAI', () => {
    const anthropic = resolveModel({ providerId: 'anthropic', baseURL: 'https://api.anthropic.com/v1', modelId: 'claude-3-5-sonnet-20241022', apiKey: 'k', hotkey: '' })
    const openai = resolveModel({ providerId: 'openai', baseURL: 'https://api.openai.com/v1', modelId: 'gpt-4o', apiKey: 'k', hotkey: '' })
    expect(anthropic.modelId).toBe('claude-3-5-sonnet-20241022')
    expect(openai.modelId).toBe('gpt-4o')
  })
})
