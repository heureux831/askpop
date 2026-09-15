import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
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
