import { providerNeedsKey } from '@shared/providers'
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
  const connection = stored.providers.find((p) => p.id === model.providerConfigId)
  if (!connection) throw new Error('模型使用的服务商已不存在')
  return {
    protocol: connection.protocol, temperature: model.temperature, keyOptional: !providerNeedsKey(connection),
    providerId: model.providerId, baseURL: connection.baseURL || provider.defaultBaseURL,
    modelId: model.modelId || provider.defaultModel, apiKey: getModelApiKey(connection.credentialId ?? connection.id) ?? '',
    theme: stored.theme ?? 'system', hotkey: stored.hotkey,
    assistantId: assistant.id, systemPrompt: assistant.systemPrompt,
    presetId: model.presetId, thinking: model.thinking, thinkingEffort: model.thinkingEffort, thinkingBudget: model.thinkingBudget
  }
}

export function getPublicConfig(): PublicConfig {
  const cfg = withCatalog(loadConfig())
  const providers = cfg.providers.map((p) => ({ ...p, hasApiKey: Boolean(getModelApiKey(p.credentialId ?? p.id)) }))
  const models = cfg.models.map((model) => {
    const p = providers.find((p) => p.id === model.providerConfigId)
    return { ...model, baseURL: p?.baseURL ?? model.baseURL, hasApiKey: Boolean(p && (p.hasApiKey || !providerNeedsKey(p))) }
  })
  const assistant = cfg.assistants.find((a) => a.id === cfg.activeAssistantId)
  const model = models.find((m) => m.id === assistant?.modelConfigId)
  return {
    providerId: model?.providerId ?? cfg.providerId, baseURL: model?.baseURL ?? '', modelId: model?.modelId ?? '',
    hasApiKey: model?.hasApiKey ?? false, theme: cfg.theme ?? 'system', hotkey: cfg.hotkey,
    providers, tasks: cfg.tasks, models, assistants: cfg.assistants, activeAssistantId: cfg.activeAssistantId
  }
}

export function resolveModel(cfg: ResolvedConfig, onReasoning?: (text: string) => void): LanguageModel {
  const fetch = createModelFetch(cfg, globalThis.fetch, onReasoning)
  if (cfg.protocol === 'anthropic' || (!cfg.protocol && (cfg.providerId === 'anthropic' || getModelPreset(cfg)?.providerId === 'anthropic'))) return createAnthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, fetch })(cfg.modelId)
  return createOpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey || (cfg.keyOptional ? 'ollama' : ''), fetch })(cfg.modelId)
}
