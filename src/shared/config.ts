export type ProviderId = 'openai' | 'anthropic' | 'custom'

export interface ProviderDef {
  id: ProviderId
  label: string
  defaultBaseURL: string
  defaultModel: string
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'openai', label: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022'
  },
  { id: 'custom', label: 'Custom（OpenAI 兼容）', defaultBaseURL: '', defaultModel: '' }
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
