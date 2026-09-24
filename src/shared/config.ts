import type { ProviderConfig, PublicProvider, ApiProtocol } from './providers'
import type { QuickTask } from './tasks'
import { MODEL_PRESETS } from './modelPresets'
import type { ThinkingMode, ThinkingEffort } from './modelPresets'
export type Theme = 'system' | 'light' | 'dark'

export type ProviderId = 'openai' | 'anthropic' | 'deepseek' | 'custom'

export interface ProviderDef {
  id: ProviderId
  label: string
  defaultBaseURL: string
  defaultModel: string
  models: string[]
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: MODEL_PRESETS.filter((p) => p.providerId === 'openai').flatMap((p) => [p.modelId, ...(p.aliases ?? [])])
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-6',
    models: MODEL_PRESETS.filter((p) => p.providerId === 'anthropic').flatMap((p) => [p.modelId, ...(p.aliases ?? [])])
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-flash',
    models: MODEL_PRESETS.filter((p) => p.providerId === 'deepseek').flatMap((p) => [p.modelId, ...(p.aliases ?? [])])
  },
  { id: 'custom', label: 'Custom（兼容接口）', defaultBaseURL: '', defaultModel: '', models: [] }
]

export interface ModelConfig {
  providerConfigId?: string
  temperature?: number
  id: string
  name: string
  providerId: ProviderId
  baseURL: string
  modelId: string
  presetId?: string
  thinking?: ThinkingMode
  thinkingEffort?: ThinkingEffort
  thinkingBudget?: number
}
export interface PublicModel extends ModelConfig { hasApiKey: boolean }
export interface AssistantConfig {
  id: string
  name: string
  modelConfigId: string
  systemPrompt: string
  icon: 'spark' | 'code' | 'pen' | 'languages'
}
export type ModelInput = Omit<ModelConfig, 'id'> & { id?: string; apiKey?: string }
export type AssistantInput = Omit<AssistantConfig, 'id'> & { id?: string }

export interface StoredConfig {
  providers?: ProviderConfig[]
  tasks?: QuickTask[]
  models?: ModelConfig[]
  assistants?: AssistantConfig[]
  activeAssistantId?: string
  providerId: ProviderId
  baseURL: string
  modelId: string
  hotkey: string
  theme?: Theme
}

export const DEFAULT_CONFIG: StoredConfig = {
  providerId: 'openai',
  baseURL: '',
  modelId: '',
  theme: 'system',
  hotkey: 'CommandOrControl+Shift+Space'
}

export interface PublicConfig {
  providers?: PublicProvider[]
  tasks?: QuickTask[]
  models?: PublicModel[]
  assistants?: AssistantConfig[]
  activeAssistantId?: string
  providerId: ProviderId
  baseURL: string
  modelId: string
  hasApiKey: boolean
  hotkey: string
  theme?: Theme
}

export interface ResolvedConfig {
  protocol?: ApiProtocol
  temperature?: number
  keyOptional?: boolean
  presetId?: string
  thinking?: ThinkingMode
  thinkingEffort?: ThinkingEffort
  thinkingBudget?: number
  systemPrompt?: string
  assistantId?: string
  providerId: ProviderId
  baseURL: string
  modelId: string
  apiKey: string
  hotkey: string
  theme?: Theme
}
