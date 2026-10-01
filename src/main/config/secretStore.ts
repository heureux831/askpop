import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import Database from 'better-sqlite3'
import { app, safeStorage } from 'electron'

const LEGACY_SLOT = '__legacy__'
let secretPath = ''
let database: Database.Database | null = null

export function closeSecretStore(): void {
  database?.close()
  database = null
}

/** Override the SQLite path for isolated tests. */
export function setSecretPath(path: string): void {
  closeSecretStore()
  secretPath = path
}

function getSecretFilePath(): string {
  return secretPath || join(app.getPath('userData'), 'secrets.sqlite')
}

function getDatabase(): Database.Database {
  if (database) return database
  const path = getSecretFilePath()
  mkdirSync(dirname(path), { recursive: true })
  // Set permissions before SQLite opens the file, including on an existing database.
  closeSync(openSync(path, 'a', 0o600))
  chmodSync(path, 0o600)
  const db = new Database(path)
  try {
    db.pragma('journal_mode = DELETE')
    db.pragma('secure_delete = ON')
    db.exec('CREATE TABLE IF NOT EXISTS api_keys (slot TEXT PRIMARY KEY NOT NULL, value TEXT)')
    database = db
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

function writeSlot(slot: string, value: string | null): void {
  // A NULL row marks an intentional removal and prevents old encrypted files resurfacing.
  getDatabase().prepare('INSERT INTO api_keys (slot, value) VALUES (?, ?) ON CONFLICT(slot) DO UPDATE SET value = excluded.value').run(slot, value)
}

function legacySecretPath(): string {
  return join(dirname(getSecretFilePath()), 'secrets.bin')
}

function modelSecretPath(modelId: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(modelId)) throw new Error('模型标识无效')
  return join(dirname(getSecretFilePath()), 'model-secrets', `${modelId}.bin`)
}

function readSlot(slot: string, legacyPath: string): string | null | undefined {
  const row = getDatabase().prepare('SELECT value FROM api_keys WHERE slot = ?').get(slot) as { value: string | null } | undefined
  if (row) return row.value
  if (!existsSync(legacyPath)) return undefined

  // Only old ciphertext needs Keychain access. A failed migration never blocks a new Key.
  let plain: string
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    plain = safeStorage.decryptString(Buffer.from(readFileSync(legacyPath, 'utf8'), 'base64'))
  } catch {
    return null
  }
  if (!plain) return null
  writeSlot(slot, plain)
  return plain
}

export function setModelApiKey(modelId: string, plain: string): void {
  modelSecretPath(modelId)
  writeSlot(modelId, plain)
}

export function getModelApiKey(modelId: string): string | null {
  const value = readSlot(modelId, modelSecretPath(modelId))
  return value === undefined && modelId === 'legacy-model' ? getApiKey() : value ?? null
}

export function removeModelApiKey(modelId: string): void {
  const path = modelSecretPath(modelId)
  getDatabase().transaction(() => {
    writeSlot(modelId, null)
    if (modelId === 'legacy-model') writeSlot(LEGACY_SLOT, null)
  })()
  if (existsSync(path)) unlinkSync(path)
  if (modelId === 'legacy-model' && existsSync(legacySecretPath())) unlinkSync(legacySecretPath())
}

export function setApiKey(plain: string): void {
  writeSlot(LEGACY_SLOT, plain || null)
  if (!plain && existsSync(legacySecretPath())) unlinkSync(legacySecretPath())
}

export function getApiKey(): string | null {
  return readSlot(LEGACY_SLOT, legacySecretPath()) ?? null
}
