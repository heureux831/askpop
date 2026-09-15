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
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini', 'o1']
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-20250219', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5']
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  { id: 'custom', label: 'Custom（OpenAI 兼容）', defaultBaseURL: '', defaultModel: '', models: [] }
]

export interface StoredConfig {
  providerId: ProviderId
  baseURL: string
  modelId: string
  hotkey: string
}

export const DEFAULT_CONFIG: StoredConfig = {
  providerId: 'openai',
  baseURL: '',
  modelId: '',
  hotkey: 'CommandOrControl+Shift+Space'
}

export interface PublicConfig {
  providerId: ProviderId
  baseURL: string
  modelId: string
  hasApiKey: boolean
  hotkey: string
}

export interface ResolvedConfig {
  providerId: ProviderId
  baseURL: string
  modelId: string
  apiKey: string
  hotkey: string
}
