import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { safeStorage } from 'electron'

vi.mock('electron', () => ({
  app: { getPath: vi.fn() },
  safeStorage: { isEncryptionAvailable: vi.fn(), encryptString: vi.fn(), decryptString: vi.fn() }
}))

import { closeSecretStore, getModelApiKey, setModelApiKey, removeModelApiKey, getApiKey, setApiKey, setSecretPath } from '../secretStore'

describe('SQLite secretStore', () => {
  let dir: string
  let path: string

  const writeLegacyKey = (file: string, plain: string) => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(`legacy:${plain}`).toString('base64'))
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-secret-'))
    path = join(dir, 'secrets.sqlite')
    setSecretPath(path)
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
    vi.mocked(safeStorage.decryptString).mockImplementation((data) => {
      const decoded = data.toString()
      if (!decoded.startsWith('legacy:')) throw new Error('invalid ciphertext')
      return decoded.slice(7)
    })
  })

  afterEach(() => {
    setSecretPath('')
    vi.resetAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('未设置时返回 null', () => {
    expect(getApiKey()).toBeNull()
    expect(getModelApiKey('missing')).toBeNull()
  })

  it('系统加密不可用时也能保存 Key，不调用系统加密', () => {
    setApiKey('sk-test-123')
    setModelApiKey('deepseek', 'sk-deepseek')
    expect(getApiKey()).toBe('sk-test-123')
    expect(getModelApiKey('deepseek')).toBe('sk-deepseek')
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
    expect(safeStorage.encryptString).not.toHaveBeenCalled()
    expect(safeStorage.decryptString).not.toHaveBeenCalled()
    expect(existsSync(join(dir, 'secrets.bin'))).toBe(false)
    expect(existsSync(join(dir, 'model-secrets'))).toBe(false)
  })

  it('保存为可重新打开的 SQLite 文件，权限仅限当前用户', () => {
    setModelApiKey('deepseek', 'sk-secret')
    expect(readFileSync(path).subarray(0, 16).toString()).toBe('SQLite format 3\0')
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600)
    closeSecretStore()
    expect(getModelApiKey('deepseek')).toBe('sk-secret')
  })

  it('不同凭据槽互不覆盖，SQL 特殊字符按原值存取', () => {
    const key = "sk-' ; DROP TABLE api_keys; --\n中文"
    setModelApiKey('account-one', key)
    setModelApiKey('account-two', 'another-key')
    expect(getModelApiKey('account-one')).toBe(key)
    expect(getModelApiKey('account-two')).toBe('another-key')
    removeModelApiKey('account-one')
    expect(getModelApiKey('account-one')).toBeNull()
    expect(getModelApiKey('account-two')).toBe('another-key')
  })

  it('数据库写入失败时保留已有 Key', () => {
    setModelApiKey('deepseek', 'old-key')
    const db = new Database(path)
    try {
      db.exec("CREATE TRIGGER reject_update BEFORE UPDATE ON api_keys BEGIN SELECT RAISE(ABORT, 'test-write-failure'); END")
      expect(() => setModelApiKey('deepseek', 'new-key')).toThrow('test-write-failure')
      expect(getModelApiKey('deepseek')).toBe('old-key')
    } finally { db.close() }
  })

  it('损坏的数据库不会被清空或覆盖', () => {
    writeFileSync(path, 'invalid database')
    expect(() => setApiKey('new-key')).toThrow()
    expect(readFileSync(path, 'utf8')).toBe('invalid database')
  })

  it('可解密的旧单 Key 文件迁移后不再依赖钥匙串', () => {
    writeLegacyKey(join(dir, 'secrets.bin'), 'old-key')
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    expect(getModelApiKey('legacy-model')).toBe('old-key')
    expect(safeStorage.decryptString).toHaveBeenCalledTimes(1)
    closeSecretStore()
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
    expect(getModelApiKey('legacy-model')).toBe('old-key')
    expect(safeStorage.decryptString).toHaveBeenCalledTimes(1)
  })

  it('迁移独立模型凭据且优先于单 Key 回退文件', () => {
    writeLegacyKey(join(dir, 'secrets.bin'), 'single-key')
    writeLegacyKey(join(dir, 'model-secrets', 'legacy-model.bin'), 'model-key')
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    expect(getModelApiKey('legacy-model')).toBe('model-key')
    closeSecretStore()
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
    expect(getModelApiKey('legacy-model')).toBe('model-key')
    expect(safeStorage.decryptString).toHaveBeenCalledTimes(1)
  })

  it('旧 Key 无法解密时保留旧文件，允许重新填写', () => {
    const oldPath = join(dir, 'model-secrets', 'deepseek.bin')
    writeLegacyKey(oldPath, 'old-key')
    const previous = readFileSync(oldPath)
    expect(getModelApiKey('deepseek')).toBeNull()
    expect(safeStorage.decryptString).not.toHaveBeenCalled()
    setModelApiKey('deepseek', 'replacement-key')
    expect(getModelApiKey('deepseek')).toBe('replacement-key')
    expect(readFileSync(oldPath)).toEqual(previous)
  })

  it('旧文件损坏时不阻塞重新填写', () => {
    writeFileSync(join(dir, 'secrets.bin'), 'garbage')
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    expect(getApiKey()).toBeNull()
    setApiKey('replacement-key')
    expect(getApiKey()).toBe('replacement-key')
  })

  it('迁移写入失败时保留旧文件并可重试', () => {
    getApiKey()
    writeLegacyKey(join(dir, 'secrets.bin'), 'old-key')
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    const db = new Database(path)
    try {
      db.exec("CREATE TRIGGER reject_insert BEFORE INSERT ON api_keys BEGIN SELECT RAISE(ABORT, 'test-migration-failure'); END")
      expect(() => getApiKey()).toThrow('test-migration-failure')
      expect(existsSync(join(dir, 'secrets.bin'))).toBe(true)
      db.exec('DROP TRIGGER reject_insert')
      expect(getApiKey()).toBe('old-key')
    } finally { db.close() }
  })

  it('删除迁移的服务商凭据时清理旧 Key，重启后不会恢复', () => {
    const oldPath = join(dir, 'model-secrets', 'legacy-model.bin')
    writeLegacyKey(join(dir, 'secrets.bin'), 'old-key')
    writeLegacyKey(oldPath, 'model-key')
    setApiKey('old-key')
    setModelApiKey('legacy-model', 'new-key')
    removeModelApiKey('legacy-model')
    expect(existsSync(oldPath)).toBe(false)
    expect(existsSync(join(dir, 'secrets.bin'))).toBe(false)
    // Even a restored old backup cannot resurrect an intentionally removed Key.
    writeLegacyKey(oldPath, 'stale-key')
    closeSecretStore()
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    expect(getModelApiKey('legacy-model')).toBeNull()
    expect(getApiKey()).toBeNull()
    expect(safeStorage.decryptString).not.toHaveBeenCalled()
  })

  it('清空旧单 Key 后不重新读取旧备份', () => {
    setApiKey('saved-key')
    setApiKey('')
    writeLegacyKey(join(dir, 'secrets.bin'), 'stale-key')
    closeSecretStore()
    expect(getApiKey()).toBeNull()
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
  })

  it('覆盖和删除 Key 时清除数据库中原有文本', () => {
    setModelApiKey('deepseek', 'unique-old-key-for-secure-delete')
    setModelApiKey('deepseek', 'unique-new-key-for-secure-delete')
    expect(readFileSync(path).includes(Buffer.from('unique-old-key-for-secure-delete'))).toBe(false)
    removeModelApiKey('deepseek')
    expect(readFileSync(path).includes(Buffer.from('unique-new-key-for-secure-delete'))).toBe(false)
  })

  it('拒绝无效凭据标识', () => {
    expect(() => setModelApiKey('../escape', 'key')).toThrow('标识无效')
    expect(() => getModelApiKey('../escape')).toThrow('标识无效')
    expect(() => removeModelApiKey('../escape')).toThrow('标识无效')
  })
})
