import { PROVIDER_PRESETS, type ProviderConfig, type ProviderInput } from '@shared/providers'
import { DEFAULT_TASKS, type QuickTask } from '@shared/tasks'
import { validateThinking } from '@shared/modelPresets'
import { randomUUID } from 'crypto'
import { PROVIDERS, type StoredConfig, type ModelConfig, type AssistantConfig, type ModelInput, type AssistantInput } from '@shared/config'
import { loadConfig, saveConfig } from './store'
import { getModelApiKey, removeModelApiKey, setModelApiKey } from './secretStore'

export type Catalog = StoredConfig & { models: ModelConfig[]; assistants: AssistantConfig[]; activeAssistantId: string; providers: ProviderConfig[]; tasks: QuickTask[] }

export function withCatalog(stored: StoredConfig): Catalog {
  const provider = PROVIDERS.find((p) => p.id === stored.providerId) ?? PROVIDERS[0]
  const models = stored.models ?? [{ id: 'legacy-model', name: '默认模型', providerId: stored.providerId, baseURL: stored.baseURL || provider.defaultBaseURL, modelId: stored.modelId || provider.defaultModel }]
  const assistants = stored.assistants ?? [{ id: 'default-assistant', name: '日常助手', modelConfigId: models[0]?.id ?? '', systemPrompt: '', icon: 'spark' as const }]
  const activeAssistantId = assistants.some((a) => a.id === stored.activeAssistantId) ? stored.activeAssistantId! : assistants[0]?.id ?? ''
  const providers = [...(stored.providers ?? [])]
  const migratedModels = models.map((model) => {
    if (model.providerConfigId) return model
    const id = `provider-${model.id}`
    if (!providers.some((p) => p.id === id)) {
      let preset = PROVIDER_PRESETS.find((p) => p.id === model.providerId)!
      if (model.providerId === 'custom') {
        try { preset = PROVIDER_PRESETS.find((p) => p.baseURL && new URL(p.baseURL).host === new URL(model.baseURL).host) ?? preset } catch { /* keep custom */ }
      }
      providers.push({ id, presetId: preset.id, name: preset.id === 'custom' ? model.name : preset.name, baseURL: model.baseURL, protocol: model.providerId === 'anthropic' || model.presetId?.startsWith('anthropic/') ? 'anthropic' : 'openai', credentialId: model.id })
    }
    return { ...model, providerConfigId: id }
  })
  if (!stored.providers) for (const preset of PROVIDER_PRESETS) {
    if (preset.id !== 'custom' && !providers.some((p) => p.presetId === preset.id)) providers.push({ id: `preset-${preset.id}`, presetId: preset.id, name: preset.name, baseURL: preset.baseURL, protocol: preset.protocol })
  }
  return { ...stored, models: migratedModels, providers, tasks: stored.tasks ?? DEFAULT_TASKS.map((t) => ({ ...t })), assistants, activeAssistantId }
}

export function saveModel(input: ModelInput): void {
  const cfg = withCatalog(loadConfig())
  const provider = PROVIDERS.find((p) => p.id === input.providerId)
  if (!provider) throw new Error('请选择有效的供应商')

  if (!input.modelId?.trim()) throw new Error('请输入模型 ID')
  const connection = input.providerConfigId ? cfg.providers.find((p) => p.id === input.providerConfigId) : undefined
  if (input.providerConfigId && !connection) throw new Error('服务商不存在，请重新选择')
  const baseURL = connection?.baseURL || input.baseURL?.trim() || provider.defaultBaseURL
  try {
    if (!['http:', 'https:'].includes(new URL(baseURL).protocol)) throw new Error()
  } catch { throw new Error('请输入有效的 HTTP 或 HTTPS 地址') }
  const existing = input.id ? cfg.models.find((m) => m.id === input.id) : undefined
  if (input.id && !existing) throw new Error('模型配置已被删除，请重新选择')
  const id = existing?.id ?? randomUUID()
  const credentialId = connection ? connection.credentialId ?? connection.id : id
  const oldKey = getModelApiKey(credentialId)
  const key = input.apiKey?.trim()
  if (!connection && !key && !oldKey) throw new Error('请输入 API Key')
  if (input.temperature !== undefined && (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > (connection?.protocol === 'anthropic' ? 1 : 2))) throw new Error('温度超出有效范围')
  if (connection && cfg.models.some((m) => m.id !== id && m.providerConfigId === connection.id && m.modelId === input.modelId.trim())) throw new Error('此服务商下已存在相同的 API 模型 ID')
  const model: ModelConfig = { id, providerConfigId: connection?.id, temperature: input.temperature, name: input.name?.trim() || input.modelId.trim(), providerId: provider.id, baseURL, modelId: input.modelId.trim(), presetId: input.presetId, thinking: input.thinking, thinkingEffort: input.thinkingEffort, thinkingBudget: input.thinkingBudget }
  validateThinking(model)
  if (key) setModelApiKey(credentialId, key)
  try {
    saveConfig({ ...cfg, models: existing ? cfg.models.map((m) => m.id === id ? model : m) : [...cfg.models, model] })
  } catch (error) {
    if (key) { if (oldKey) setModelApiKey(credentialId, oldKey); else removeModelApiKey(credentialId) }
    throw error
  }
}

export function deleteModel(id: string): void {
  const cfg = withCatalog(loadConfig())
  if (cfg.assistants.some((a) => a.modelConfigId === id)) throw new Error('这个模型仍被助手使用，请先为相关助手更换模型。')
  saveConfig({ ...cfg, models: cfg.models.filter((m) => m.id !== id) })
  if (!cfg.providers.some((p) => p.credentialId === id)) removeModelApiKey(id)
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

export function saveProvider(input: ProviderInput): void {
  const cfg = withCatalog(loadConfig())
  const existing = input.id ? cfg.providers.find((p) => p.id === input.id) : undefined
  if (input.id && !existing) throw new Error('服务商已被删除')
  if (!input.name?.trim()) throw new Error('请输入服务商名称')
  if (!PROVIDER_PRESETS.some((p) => p.id === input.presetId)) throw new Error('请选择有效的服务商预设')
  if (!['openai', 'anthropic'].includes(input.protocol)) throw new Error('请选择有效的接口类型')
  const baseURL = input.baseURL.trim().replace(/\/+$/, '')
  try { if (!['http:', 'https:'].includes(new URL(baseURL).protocol)) throw new Error() } catch { throw new Error('请输入有效的 HTTP 或 HTTPS 地址') }
  if (existing && input.protocol === 'anthropic' && cfg.models.some((m) => m.providerConfigId === existing.id && (m.temperature ?? 0) > 1)) throw new Error('请先将此服务商下模型的温度调整至 0～1')
  const id = existing?.id ?? randomUUID()
  const provider: ProviderConfig = { id, name: input.name.trim(), presetId: input.presetId, protocol: input.protocol, baseURL, ...(existing?.credentialId ? { credentialId: existing.credentialId } : {}) }
  const slot = provider.credentialId ?? id, oldKey = getModelApiKey(slot), key = input.apiKey?.trim()
  if (key) setModelApiKey(slot, key)
  try { saveConfig({ ...cfg, providers: existing ? cfg.providers.map((p) => p.id === id ? provider : p) : [...cfg.providers, provider] }) }
  catch (error) { if (key) { if (oldKey) setModelApiKey(slot, oldKey); else removeModelApiKey(slot) }; throw error }
}

export function deleteProvider(id: string): void {
  const cfg = withCatalog(loadConfig())
  const provider = cfg.providers.find((p) => p.id === id)
  if (!provider) throw new Error('服务商不存在')
  const ids = new Set(cfg.models.filter((m) => m.providerConfigId === id).map((m) => m.id))
  if (cfg.assistants.some((a) => ids.has(a.modelConfigId))) throw new Error('此服务商的模型仍被助手使用，请先更换模型。')
  saveConfig({ ...cfg, providers: cfg.providers.filter((p) => p.id !== id), models: cfg.models.filter((m) => !ids.has(m.id)) })
  removeModelApiKey(provider.credentialId ?? id)
}

export function saveTasks(tasks: QuickTask[]): void {
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 30) throw new Error('请保留 1～30 个快捷任务')
  const ids = new Set<string>()
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(task.id) || ids.has(task.id)) throw new Error('任务标识无效或重复')
    ids.add(task.id)
    if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 40) throw new Error('任务标题需为 1～40 个字符')
    if (typeof task.prompt !== 'string' || typeof task.description !== 'string' || !['chat', 'translate', 'summary', 'explanation'].includes(task.icon)) throw new Error('任务配置无效')
  }
  saveConfig({ ...withCatalog(loadConfig()), tasks: tasks.map((t) => ({ id: t.id, title: t.title.trim(), description: t.description.trim(), prompt: t.prompt, icon: t.icon })) })
}

export function getTaskPrompt(taskId?: string): string | undefined {
  if (!taskId) return undefined
  const task = withCatalog(loadConfig()).tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('快捷任务已被删除，请返回首页重新选择')
  return task.prompt
}
