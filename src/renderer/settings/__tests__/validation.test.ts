import { describe, expect, it } from 'vitest'
import { validate } from '../validation'

describe('validate', () => {
  it('custom 供应商未填 baseURL 时返回错误', () => {
    const r = validate({ providerId: 'custom', baseURL: '', modelId: 'm', apiKey: 'k' })
    expect(r.baseURL).toBeTruthy()
  })

  it('未填 apiKey 时返回错误', () => {
    const r = validate({ providerId: 'openai', baseURL: '', modelId: '', apiKey: '' })
    expect(r.apiKey).toBeTruthy()
  })

  it('openai 且填了 key 时全部通过', () => {
    const r = validate({ providerId: 'openai', baseURL: '', modelId: '', apiKey: 'k' })
    expect(r).toEqual({})
  })
})
