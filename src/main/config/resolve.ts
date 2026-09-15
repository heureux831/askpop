import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

import { PROVIDERS, type PublicConfig, type ResolvedConfig } from '@shared/config'

import { getApiKey } from './secretStore'
import { loadConfig } from './store'

export function getResolvedConfig(): ResolvedConfig {
  const stored = loadConfig()
  const provider = PROVIDERS.find((p) => p.id === stored.providerId) ?? PROVIDERS[0]
  return {
    providerId: stored.providerId,
    baseURL: stored.baseURL || provider.defaultBaseURL,
    modelId: stored.modelId || provider.defaultModel,
    apiKey: getApiKey() ?? '',
    hotkey: stored.hotkey
  }
}

export function getPublicConfig(): PublicConfig {
  const c = getResolvedConfig()
  return {
    providerId: c.providerId,
    baseURL: c.baseURL,
    modelId: c.modelId,
    hasApiKey: c.apiKey !== '',
    hotkey: c.hotkey
  }
}

export function resolveModel(cfg: ResolvedConfig): LanguageModel {
  if (cfg.providerId === 'anthropic') {
    return createAnthropic({ apiKey: cfg.apiKey })(cfg.modelId)
  }
  return createOpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey })(cfg.modelId)
}
