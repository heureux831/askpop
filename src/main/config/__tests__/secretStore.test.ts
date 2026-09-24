import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getModelApiKey, setModelApiKey, removeModelApiKey, getApiKey, setApiKey, setCipherProvider, setSecretPath } from '../secretStore'

describe('secretStore', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-secret-'))
    setSecretPath(join(dir, 'secrets.bin'))
    // 注入一个可逆的伪加解密：Base64，模拟 safeStorage.encryptString/decryptString
    setCipherProvider({
      encrypt: (s: string) => Buffer.from(s, 'utf8').toString('base64'),
      decrypt: (b: Buffer) => {
        const encoded = b.toString('utf8')
        const decoded = Buffer.from(encoded, 'base64')
        if (decoded.toString('base64') !== encoded) throw new Error('invalid ciphertext')
        return decoded.toString('utf8')
      }
    })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('未设置时返回 null', () => {
    expect(getApiKey()).toBeNull()
  })

  it('设置后能读回明文', () => {
    setApiKey('sk-test-123')
    expect(getApiKey()).toBe('sk-test-123')
  })

  it('密钥落盘为密文而非明文', () => {
    setApiKey('sk-secret')
    const raw = require('fs').readFileSync(join(dir, 'secrets.bin'), 'utf8')
    expect(raw).not.toContain('sk-secret')
  })

  it('密文无法解密时返回 null 而不抛异常', () => {
    require('fs').writeFileSync(join(dir, 'secrets.bin'), Buffer.from('garbage', 'utf8'))
    expect(getApiKey()).toBeNull()
  })
  it('删除迁移的服务商凭据时同时清理旧 Key 回退文件', () => {
    setApiKey('old-key')
    setModelApiKey('legacy-model', 'new-key')
    removeModelApiKey('legacy-model')
    expect(getModelApiKey('legacy-model')).toBeNull()
    expect(getApiKey()).toBeNull()
  })

})
