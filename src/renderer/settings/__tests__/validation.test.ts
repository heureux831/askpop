import { describe, expect, it } from 'vitest'
import { validate } from '../validation'

describe('validate', () => {
  it('custom 供应商未填 baseURL 时返回错误', () => {
    const r = validate({ providerId: 'custom', baseURL: '', modelId: 'm', apiKey: 'k' }, false)
    expect(r.baseURL).toBeTruthy()
  })

  it('未填 apiKey 时返回错误', () => {
    const r = validate({ providerId: 'openai', baseURL: '', modelId: '', apiKey: '' }, false)
    expect(r.apiKey).toBeTruthy()
  })

  it('openai 且填了 key 时全部通过', () => {
    const r = validate({ providerId: 'openai', baseURL: '', modelId: '', apiKey: 'k' }, false)
    expect(r).toEqual({})
  })

  it('已有 key 时允许留空 apiKey', () => {
    const r = validate({ providerId: 'openai', baseURL: '', modelId: '', apiKey: '' }, true)
    expect(r).toEqual({})
  })
})
