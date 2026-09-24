import type { ModelConfig, ProviderId } from './config'

export type ThinkingMode = 'default' | 'enabled' | 'disabled'
export type ThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type ThinkingKind = 'none' | 'openai' | 'deepseek' | 'anthropic-budget' | 'anthropic-adaptive'
export interface ModelPreset {
  id: string
  providerId: Exclude<ProviderId, 'custom'>
  modelId: string
  name: string
  description: string
  thinking: ThinkingKind
  defaultThinking: boolean
  canDisable: boolean
  efforts?: ThinkingEffort[]
  defaultEffort?: ThinkingEffort
  defaultBudget?: number
  aliases?: string[]
}

// Capabilities are explicit; unknown models never inherit a guessed request schema.
export const MODEL_PRESETS: ModelPreset[] = [
  { id: 'openai/gpt-5.4', providerId: 'openai', modelId: 'gpt-5.4', name: 'GPT-5.4', description: '通用任务与复杂分析，可切换快速回答和深度思考。', thinking: 'openai', defaultThinking: false, canDisable: true, efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'high' },
  { id: 'openai/gpt-5.2', providerId: 'openai', modelId: 'gpt-5.2', name: 'GPT-5.2', description: '支持可调思考强度。', thinking: 'openai', defaultThinking: false, canDisable: true, efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'high' },
  ...['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'].map((modelId): ModelPreset => ({ id: `openai/${modelId}`, providerId: 'openai', modelId, name: modelId.toUpperCase().replace('MINI', 'mini'), description: '常规对话模型，不提供深度思考开关。', thinking: 'none', defaultThinking: false, canDisable: true })),
  ...['o3-mini', 'o1'].map((modelId): ModelPreset => ({ id: `openai/${modelId}`, providerId: 'openai', modelId, name: modelId, description: '始终进行推理，可以调整强度，无法完全关闭。', thinking: 'openai', defaultThinking: true, canDisable: false, efforts: ['low', 'medium', 'high'], defaultEffort: 'high' })),
  ...['claude-sonnet-4-6', 'claude-opus-4-6'].map((modelId): ModelPreset => ({ id: `anthropic/${modelId}`, providerId: 'anthropic', modelId, name: modelId.includes('sonnet') ? 'Claude Sonnet 4.6' : 'Claude Opus 4.6', description: '自适应思考，按任务复杂度分配推理。', thinking: 'anthropic-adaptive', defaultThinking: false, canDisable: true, efforts: ['low', 'medium', 'high'], defaultEffort: 'high' })),
  ...['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'].map((modelId): ModelPreset => ({ id: `anthropic/${modelId}`, providerId: 'anthropic', modelId, name: `Claude ${modelId.split('-')[1]} 4.5`, description: '扩展思考，可设置思考 Token 预算。', thinking: 'anthropic-budget', defaultThinking: false, canDisable: true, defaultBudget: 2048 })),
  { id: 'deepseek/flash', providerId: 'deepseek', modelId: 'deepseek-flash', name: 'DeepSeek Flash', description: '日常问答；关闭思考可缩短首字等待。', thinking: 'deepseek', defaultThinking: true, canDisable: true, efforts: ['low', 'high', 'max'], defaultEffort: 'high', aliases: ['deepseek-v4-flash'] },
  { id: 'deepseek/pro', providerId: 'deepseek', modelId: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', description: '复杂分析与推理，可关闭思考。', thinking: 'deepseek', defaultThinking: true, canDisable: true, efforts: ['low', 'high', 'max'], defaultEffort: 'high' }
]

type ModelIdentity = Pick<ModelConfig, 'providerId' | 'baseURL' | 'modelId' | 'presetId'>
export function getModelPreset(model: ModelIdentity): ModelPreset | undefined {
  if (model.presetId) return MODEL_PRESETS.find((p) => p.id === model.presetId && (model.providerId === 'custom' || p.providerId === model.providerId))
  let provider = model.providerId
  if (provider === 'custom') {
    try {
      const hosts: Record<string, ProviderId> = { 'api.deepseek.com': 'deepseek', 'api.openai.com': 'openai', 'api.anthropic.com': 'anthropic' }
      provider = hosts[new URL(model.baseURL).hostname] ?? 'custom'
    } catch { return undefined }
  }
  return MODEL_PRESETS.find((p) => p.providerId === provider && (p.modelId === model.modelId || p.aliases?.includes(model.modelId)))
}

export function thinkingEnabled(model: Pick<ModelConfig, 'thinking'>, preset?: ModelPreset): boolean {
  return model.thinking === 'enabled' || ((!model.thinking || model.thinking === 'default') && !!preset?.defaultThinking)
}

export function validateThinking(model: ModelIdentity & Pick<ModelConfig, 'thinking' | 'thinkingEffort' | 'thinkingBudget'>): void {
  if (model.thinking !== undefined && !['default', 'enabled', 'disabled'].includes(model.thinking)) throw new Error('深度思考选项无效')
  const preset = getModelPreset(model)
  if (model.presetId && !preset) throw new Error('模型预设与供应商不匹配')
  if (model.thinkingEffort !== undefined && !preset?.efforts?.includes(model.thinkingEffort)) throw new Error('当前模型不支持这个思考强度')
  if (model.thinkingBudget !== undefined && (preset?.thinking !== 'anthropic-budget' || !Number.isInteger(model.thinkingBudget) || model.thinkingBudget < 1024 || model.thinkingBudget > 16000)) throw new Error('思考预算必须为 1024～16000 的整数，且模型须支持预算设置')
  if (!model.thinking || model.thinking === 'default') return
  if (!preset) throw new Error('请先选择已知的模型参数预设，再调整深度思考')
  if (model.thinking === 'enabled' && preset.thinking === 'none') throw new Error('当前模型不支持深度思考')
  if (model.thinking === 'disabled' && !preset.canDisable) throw new Error('当前模型始终进行推理，无法关闭深度思考')
}
