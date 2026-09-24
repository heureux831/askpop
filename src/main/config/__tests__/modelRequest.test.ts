import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import type { ResolvedConfig } from '@shared/config'
import { resolveModel } from '../resolve'
import { modelRequestBody } from '../modelRequest'

const base: ResolvedConfig = { providerId: 'custom', baseURL: 'https://api.deepseek.com/v1', modelId: 'deepseek-v4-flash', apiKey: 'test-only', hotkey: '' }
afterEach(() => vi.unstubAllGlobals())

async function wire(cfg: ResolvedConfig, anthropic = false) {
  const spy = vi.fn(async () => new Response(JSON.stringify(anthropic ? {
    id: 'msg-test', type: 'message', role: 'assistant', model: cfg.modelId,
    content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }
  } : {
    id: 'test', object: 'chat.completion', created: 1, model: cfg.modelId,
    choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
  }), { headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', spy)
  await generateText({ model: resolveModel(cfg), messages: [{ role: 'user', content: 'hi' }], maxTokens: 128, maxRetries: 0 })
  const [url, init] = (spy.mock.calls as unknown as [string, RequestInit][])[0]
  return { url, body: JSON.parse(init.body as string), headers: init.headers as Record<string, string> }
}

describe('thinking parameters reach the provider through the real SDK', () => {
  it('recognizes the existing custom DeepSeek endpoint and explicitly disables thinking', async () => {
    const { body } = await wire({ ...base, thinking: 'disabled' })
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body).not.toHaveProperty('reasoning_effort')
    expect(body.model).toBe('deepseek-v4-flash')
  })
  it('sends DeepSeek effort only when enabled', async () => {
    const { body } = await wire({ ...base, thinking: 'enabled', thinkingEffort: 'max' })
    expect(body).toMatchObject({ thinking: { type: 'enabled' }, reasoning_effort: 'max' })
  })
  it('preserves service defaults for existing configs', async () => {
    const { body } = await wire(base)
    expect(body).not.toHaveProperty('thinking')
    expect(body).not.toHaveProperty('reasoning_effort')
  })
  it.each(['enabled', 'disabled'] as const)('maps OpenAI %s to actual reasoning_effort', async (thinking) => {
    const { body } = await wire({ ...base, providerId: 'openai', modelId: 'gpt-5.4', thinking, thinkingEffort: 'high' })
    expect(body.reasoning_effort).toBe(thinking === 'enabled' ? 'high' : 'none')
    expect(body.max_completion_tokens).toBe(128)
    expect(body).not.toHaveProperty('max_tokens')
    expect(body).not.toHaveProperty('thinking')
  })
  it('sends Anthropic budget and reserves room for the answer', async () => {
    const { body, url } = await wire({ ...base, providerId: 'anthropic', modelId: 'claude-sonnet-4-5', thinking: 'enabled', thinkingBudget: 8000 }, true)
    expect(url).toContain('/messages')
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 8000 })
    expect(body.max_tokens).toBeGreaterThan(8000)
  })
  it('maps adaptive thinking and explicitly disables it', async () => {
    const cfg: ResolvedConfig = { ...base, providerId: 'anthropic', modelId: 'claude-sonnet-4-6', thinking: 'enabled', thinkingEffort: 'medium' }
    expect((await wire(cfg, true)).body).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } })
    const { body } = await wire({ ...cfg, thinking: 'disabled' }, true)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body).not.toHaveProperty('output_config')
  })
  it('uses an explicit compatible preset for a proxy alias without changing its URL', async () => {
    const { body, url } = await wire({ ...base, baseURL: 'https://proxy.example.test/v1', modelId: 'my-claude-alias', presetId: 'anthropic/claude-sonnet-4-6', thinking: 'enabled' }, true)
    expect(url).toBe('https://proxy.example.test/v1/messages')
    expect(body.model).toBe('my-claude-alias')
    expect(body.thinking).toEqual({ type: 'adaptive' })
  })
  it('does not send speculative fields for unknown models or non-reasoning models', async () => {
    const cfg = { ...base, modelId: 'unknown', baseURL: 'https://other.example.test/v1' }
    expect(modelRequestBody(cfg, { model: cfg.modelId })).toEqual({ model: 'unknown' })
    expect(() => modelRequestBody({ ...cfg, thinking: 'enabled' }, {})).toThrow('预设')
    expect(() => modelRequestBody({ ...base, providerId: 'openai', modelId: 'gpt-4o', thinking: 'enabled' }, {})).toThrow('不支持')
  })
  it('rejects disabling always-reasoning models and incompatible settings', () => {
    expect(() => modelRequestBody({ ...base, providerId: 'openai', modelId: 'o1', thinking: 'disabled' }, {})).toThrow('无法关闭')
    expect(() => modelRequestBody({ ...base, thinking: 'enabled', thinkingEffort: 'medium' }, {})).toThrow('强度')
    expect(() => modelRequestBody({ ...base, providerId: 'anthropic', modelId: 'claude-sonnet-4-5', thinkingBudget: 12 }, {})).toThrow('预算')
  })
})
