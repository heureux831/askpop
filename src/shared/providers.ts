export type ApiProtocol = 'openai' | 'anthropic'
export interface ProviderPreset {
  id: string
  name: string
  baseURL: string
  protocol: ApiProtocol
  icon: string
  keyOptional?: boolean
}
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', protocol: 'openai', icon: 'openai' },
  { id: 'anthropic', name: 'Anthropic', baseURL: 'https://api.anthropic.com/v1', protocol: 'anthropic', icon: 'anthropic' },
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', protocol: 'openai', icon: 'deepseek-color' },
  { id: 'gemini', name: 'Google Gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', protocol: 'openai', icon: 'gemini-color' },
  { id: 'qwen', name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai', icon: 'qwen-color' },
  { id: 'zhipu', name: '智谱 AI', baseURL: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai', icon: 'zhipu-color' },
  { id: 'moonshot', name: '月之暗面', baseURL: 'https://api.moonshot.cn/v1', protocol: 'openai', icon: 'moonshot' },
  { id: 'siliconflow', name: '硅基流动', baseURL: 'https://api.siliconflow.cn/v1', protocol: 'openai', icon: 'siliconcloud-color' },
  { id: 'openrouter', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', protocol: 'openai', icon: 'openrouter' },
  { id: 'groq', name: 'Groq', baseURL: 'https://api.groq.com/openai/v1', protocol: 'openai', icon: 'groq' },
  { id: 'mistral', name: 'Mistral AI', baseURL: 'https://api.mistral.ai/v1', protocol: 'openai', icon: 'mistral-color' },
  { id: 'ollama', name: 'Ollama', baseURL: 'http://localhost:11434/v1', protocol: 'openai', icon: 'ollama', keyOptional: true },
  { id: 'custom', name: '自定义服务商', baseURL: '', protocol: 'openai', icon: 'custom' }
]
export interface ProviderConfig {
  id: string
  presetId: string
  name: string
  baseURL: string
  protocol: ApiProtocol
  // Legacy connections keep their encrypted credential slot without copying secrets.
  credentialId?: string
}
export interface PublicProvider extends ProviderConfig { hasApiKey: boolean }
export type ProviderInput = Omit<ProviderConfig, 'id' | 'credentialId'> & { id?: string; apiKey?: string }
export function providerNeedsKey(provider: ProviderConfig): boolean {
  if (provider.presetId !== 'ollama') return true
  try { return !['localhost', '127.0.0.1', '[::1]'].includes(new URL(provider.baseURL).hostname) } catch { return true }
}
