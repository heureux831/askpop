import type { ProviderId } from '@shared/config'

export interface FormValues {
  providerId: ProviderId
  baseURL: string
  modelId: string
  apiKey: string
}

export function validate(v: FormValues, hasApiKey: boolean): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {}
  if (!hasApiKey && !v.apiKey.trim()) errors.apiKey = '请输入 API Key'
  if (v.providerId === 'custom' && !v.baseURL.trim()) errors.baseURL = 'Custom 供应商必须填写 Base URL'
  if (v.providerId === 'custom') {
    if (!v.modelId.trim()) errors.modelId = '请输入模型 ID'
    if (v.baseURL.trim()) {
      try {
        const url = new URL(v.baseURL.trim())
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
      } catch {
        errors.baseURL = '请输入有效的 HTTP 或 HTTPS 地址'
      }
    }
  }
  return errors
}
