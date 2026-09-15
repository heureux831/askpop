import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
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
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8')
}
