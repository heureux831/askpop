import { getModelPreset } from '@shared/modelPresets'
import { createModelFetch } from './modelRequest'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { PROVIDERS, type PublicConfig, type ResolvedConfig } from '@shared/config'
import { getModelApiKey } from './secretStore'
import { loadConfig } from './store'
import { withCatalog } from './catalog'

export function getResolvedConfig(assistantId?: string): ResolvedConfig {
  const stored = withCatalog(loadConfig())
  const assistant = stored.assistants.find((a) => a.id === (assistantId ?? stored.activeAssistantId))
  if (!assistant) throw new Error('请先在设置中创建并选择一个助手。')
  const model = stored.models.find((m) => m.id === assistant.modelConfigId)
  if (!model) throw new Error('助手使用的模型已不存在，请打开设置重新选择。')
  const provider = PROVIDERS.find((p) => p.id === model.providerId) ?? PROVIDERS[0]
  return {
    providerId: model.providerId, baseURL: model.baseURL || provider.defaultBaseURL,
    modelId: model.modelId || provider.defaultModel, apiKey: getModelApiKey(model.id) ?? '',
    theme: stored.theme ?? 'system', hotkey: stored.hotkey,
    assistantId: assistant.id, systemPrompt: assistant.systemPrompt,
    presetId: model.presetId, thinking: model.thinking, thinkingEffort: model.thinkingEffort, thinkingBudget: model.thinkingBudget
  }
}

export function getPublicConfig(): PublicConfig {
  const cfg = withCatalog(loadConfig())
  const models = cfg.models.map((model) => ({ ...model, hasApiKey: Boolean(getModelApiKey(model.id)) }))
  const assistant = cfg.assistants.find((a) => a.id === cfg.activeAssistantId)
  const model = models.find((m) => m.id === assistant?.modelConfigId)
  return {
    providerId: model?.providerId ?? cfg.providerId, baseURL: model?.baseURL ?? '', modelId: model?.modelId ?? '',
    hasApiKey: model?.hasApiKey ?? false, theme: cfg.theme ?? 'system', hotkey: cfg.hotkey,
    models, assistants: cfg.assistants, activeAssistantId: cfg.activeAssistantId
  }
}

export function resolveModel(cfg: ResolvedConfig): LanguageModel {
  const fetch = createModelFetch(cfg)
  if (cfg.providerId === 'anthropic' || getModelPreset(cfg)?.providerId === 'anthropic') return createAnthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, fetch })(cfg.modelId)
  return createOpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, fetch })(cfg.modelId)
}
