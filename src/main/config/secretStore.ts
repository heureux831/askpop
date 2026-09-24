import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { app, safeStorage } from 'electron'

interface CipherProvider {
  encrypt(plain: string): string
  decrypt(data: Buffer): string
}

let secretPath = ''
let cipher: CipherProvider | null = null

export function setSecretPath(path: string): void {
  secretPath = path
}

export function setCipherProvider(p: CipherProvider | null): void {
  cipher = p
}

function getSecretFilePath(): string {
  if (secretPath) return secretPath
  return join(app.getPath('userData'), 'secrets.bin')
}

function getCipher(): CipherProvider {
  if (cipher) return cipher
  return {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (data) => safeStorage.decryptString(Buffer.from(data.toString('utf8'), 'base64'))
  }
}

function modelSecretPath(modelId: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(modelId)) throw new Error('模型标识无效')
  return join(dirname(getSecretFilePath()), 'model-secrets', `${modelId}.bin`)
}

export function setModelApiKey(modelId: string, plain: string): void {
  const path = modelSecretPath(modelId)
  mkdirSync(dirname(path), { recursive: true })
  const encrypted = getCipher().encrypt(plain)
  writeFileSync(`${path}.tmp`, encrypted, { mode: 0o600 })
  renameSync(`${path}.tmp`, path)
}

export function getModelApiKey(modelId: string): string | null {
  const path = modelSecretPath(modelId)
  if (!existsSync(path)) return modelId === 'legacy-model' ? getApiKey() : null
  try { return getCipher().decrypt(readFileSync(path)) } catch { return null }
}

export function removeModelApiKey(modelId: string): void {
  const path = modelSecretPath(modelId)
  if (existsSync(path)) unlinkSync(path)
  if (modelId === 'legacy-model' && existsSync(getSecretFilePath())) unlinkSync(getSecretFilePath())
}

export function setApiKey(plain: string): void {
  if (!plain) {
    setSecretFilePathAndClear()
    return
  }
  const encrypted = getCipher().encrypt(plain)
  writeFileSync(getSecretFilePath(), Buffer.from(encrypted, 'utf8'))
}

export function getApiKey(): string | null {
  if (!existsSync(getSecretFilePath())) return null
  try {
    return getCipher().decrypt(readFileSync(getSecretFilePath()))
  } catch {
    return null
  }
}

function setSecretFilePathAndClear(): void {
  try {
    writeFileSync(getSecretFilePath(), Buffer.alloc(0))
  } catch {
    // 忽略清除失败
  }
}
