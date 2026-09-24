import { existsSync, readFileSync, writeFileSync, renameSync, copyFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

import { DEFAULT_CONFIG, type StoredConfig } from '@shared/config'

let configPath = ''

export function setConfigPath(path: string): void {
  configPath = path
}

export function getConfigPath(): string {
  if (configPath) return configPath
  return join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): StoredConfig {
  const path = getConfigPath()
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredConfig>
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(cfg: StoredConfig): void {
  const path = getConfigPath()
  mkdirSync(dirname(path), { recursive: true })
  if (cfg.models && existsSync(path) && !existsSync(`${path}.v1.bak`)) {
    const previous = JSON.parse(readFileSync(path, 'utf8'))
    if (!previous.models) copyFileSync(path, `${path}.v1.bak`)
  }
  if (cfg.providers && existsSync(path) && !existsSync(`${path}.v3.bak`)) {
    const previous = JSON.parse(readFileSync(path, 'utf8'))
    if (!previous.providers) copyFileSync(path, `${path}.v3.bak`)
  }
  writeFileSync(`${path}.tmp`, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 })
  renameSync(`${path}.tmp`, path)
}
