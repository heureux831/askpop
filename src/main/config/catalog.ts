import { validateThinking } from '@shared/modelPresets'
import { randomUUID } from 'crypto'
import { PROVIDERS, type StoredConfig, type ModelConfig, type AssistantConfig, type ModelInput, type AssistantInput } from '@shared/config'
import { loadConfig, saveConfig } from './store'
import { getModelApiKey, removeModelApiKey, setModelApiKey } from './secretStore'

export type Catalog = StoredConfig & { models: ModelConfig[]; assistants: AssistantConfig[]; activeAssistantId: string }

export function withCatalog(stored: StoredConfig): Catalog {
  const provider = PROVIDERS.find((p) => p.id === stored.providerId) ?? PROVIDERS[0]
  const models = stored.models ?? [{ id: 'legacy-model', name: '默认模型', providerId: stored.providerId, baseURL: stored.baseURL || provider.defaultBaseURL, modelId: stored.modelId || provider.defaultModel }]
  const assistants = stored.assistants ?? [{ id: 'default-assistant', name: '日常助手', modelConfigId: models[0]?.id ?? '', systemPrompt: '', icon: 'spark' as const }]
  const activeAssistantId = assistants.some((a) => a.id === stored.activeAssistantId) ? stored.activeAssistantId! : assistants[0]?.id ?? ''
  return { ...stored, models, assistants, activeAssistantId }
}

export function saveModel(input: ModelInput): void {
  const cfg = withCatalog(loadConfig())
  const provider = PROVIDERS.find((p) => p.id === input.providerId)
  if (!provider) throw new Error('请选择有效的供应商')
  if (!input.name?.trim()) throw new Error('请输入模型配置名称')
  if (!input.modelId?.trim()) throw new Error('请输入模型 ID')
  const baseURL = input.baseURL?.trim() || provider.defaultBaseURL
  try {
    if (!['http:', 'https:'].includes(new URL(baseURL).protocol)) throw new Error()
  } catch { throw new Error('请输入有效的 HTTP 或 HTTPS 地址') }
  const existing = input.id ? cfg.models.find((m) => m.id === input.id) : undefined
  if (input.id && !existing) throw new Error('模型配置已被删除，请重新选择')
  const id = existing?.id ?? randomUUID()
  const oldKey = getModelApiKey(id)
  const key = input.apiKey?.trim()
  if (!key && !oldKey) throw new Error('请输入 API Key')
  const model: ModelConfig = { id, name: input.name.trim(), providerId: provider.id, baseURL, modelId: input.modelId.trim(), presetId: input.presetId, thinking: input.thinking, thinkingEffort: input.thinkingEffort, thinkingBudget: input.thinkingBudget }
  validateThinking(model)
  if (key) setModelApiKey(id, key)
  try {
    saveConfig({ ...cfg, models: existing ? cfg.models.map((m) => m.id === id ? model : m) : [...cfg.models, model] })
  } catch (error) {
    if (key) { if (oldKey) setModelApiKey(id, oldKey); else removeModelApiKey(id) }
    throw error
  }
}

export function deleteModel(id: string): void {
  const cfg = withCatalog(loadConfig())
  if (cfg.assistants.some((a) => a.modelConfigId === id)) throw new Error('这个模型仍被助手使用，请先为相关助手更换模型。')
  saveConfig({ ...cfg, models: cfg.models.filter((m) => m.id !== id) })
  removeModelApiKey(id)
}

export function saveAssistant(input: AssistantInput): void {
  const cfg = withCatalog(loadConfig())
  if (!input.name?.trim()) throw new Error('请输入助手名称')
  if (!cfg.models.some((m) => m.id === input.modelConfigId)) throw new Error('请选择已配置的模型')
  if (input.id && !cfg.assistants.some((a) => a.id === input.id)) throw new Error('助手已被删除，请重新选择')
  if (typeof input.systemPrompt !== 'string') throw new Error('提示词格式无效')
  const id = input.id ?? randomUUID()
  const assistant: AssistantConfig = { id, name: input.name.trim(), modelConfigId: input.modelConfigId, systemPrompt: input.systemPrompt, icon: ['spark', 'code', 'pen', 'languages'].includes(input.icon) ? input.icon : 'spark' }
  saveConfig({ ...cfg, assistants: input.id ? cfg.assistants.map((a) => a.id === id ? assistant : a) : [...cfg.assistants, assistant], activeAssistantId: cfg.activeAssistantId || id })
}

export function deleteAssistant(id: string): void {
  const cfg = withCatalog(loadConfig())
  const assistants = cfg.assistants.filter((a) => a.id !== id)
  saveConfig({ ...cfg, assistants, activeAssistantId: cfg.activeAssistantId === id ? assistants[0]?.id ?? '' : cfg.activeAssistantId })
}

export function selectAssistant(id: string): void {
  const cfg = withCatalog(loadConfig())
  if (!cfg.assistants.some((a) => a.id === id)) throw new Error('助手不存在，请重新选择')
  saveConfig({ ...cfg, activeAssistantId: id })
}
