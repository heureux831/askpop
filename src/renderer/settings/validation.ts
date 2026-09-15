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
  return errors
}
