import { observeReasoning } from '../chat/reasoningStream'
import type { ResolvedConfig } from '@shared/config'
import { getModelPreset, validateThinking } from '@shared/modelPresets'

// The installed SDK predates several thinking options. Apply the validated,
// provider-specific settings at the HTTP boundary, leaving its SSE parser intact.
export function modelRequestBody(cfg: ResolvedConfig, original: Record<string, unknown>): Record<string, unknown> {
  validateThinking(cfg)
  const body = { ...original }
  // AI SDK 4 defaults an omitted temperature to 0. Leave it truly unset on the wire.
  if (cfg.temperature === undefined) delete body.temperature
  else body.temperature = cfg.temperature
  if (!cfg.thinking || cfg.thinking === 'default') return body
  const preset = getModelPreset(cfg)
  if (!preset || preset.thinking === 'none') return body
  const enabled = cfg.thinking === 'enabled'
  const effort = cfg.thinkingEffort ?? preset.defaultEffort
  switch (preset.thinking) {
    case 'deepseek':
      body.thinking = { type: enabled ? 'enabled' : 'disabled' }
      if (enabled) body.reasoning_effort = effort
      else delete body.reasoning_effort
      break
    case 'openai':
      body.reasoning_effort = enabled ? effort : 'none'
      if (body.max_tokens !== undefined) { body.max_completion_tokens = body.max_tokens; delete body.max_tokens }
      // These sampling options are rejected by reasoning-enabled GPT models.
      if (enabled) { delete body.temperature; delete body.top_p; delete body.presence_penalty; delete body.frequency_penalty }
      break
    case 'anthropic-adaptive':
      body.thinking = { type: enabled ? 'adaptive' : 'disabled' }
      if (enabled) body.output_config = { effort }
      else delete body.output_config
      if (enabled) { delete body.temperature; delete body.top_p; delete body.top_k }
      break
    case 'anthropic-budget': {
      const budget = cfg.thinkingBudget ?? preset.defaultBudget!
      body.thinking = enabled ? { type: 'enabled', budget_tokens: budget } : { type: 'disabled' }
      if (enabled) {
        body.max_tokens = Math.max(Number(body.max_tokens) || 4096, budget + 4096)
        delete body.temperature; delete body.top_p; delete body.top_k
      }
      break
    }
  }
  return body
}

export function createModelFetch(cfg: ResolvedConfig, fetchImpl: typeof fetch = globalThis.fetch, onReasoning?: (text: string) => void): typeof fetch {
  return async (input, init) => {
    if (typeof init?.body !== 'string') return fetchImpl(input, init)
    const body = modelRequestBody(cfg, JSON.parse(init.body))
    return observeReasoning(await fetchImpl(input, { ...init, body: JSON.stringify(body) }), onReasoning)
  }
}
