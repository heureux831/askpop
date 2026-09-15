import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONFIG, type StoredConfig } from '@shared/config'
import { loadConfig, saveConfig, setConfigPath } from '../store'

describe('config store', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-store-'))
    setConfigPath(join(dir, 'config.json'))
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('文件不存在时返回默认配置', () => {
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('保存后能读回，并写入磁盘 JSON', () => {
    const cfg: StoredConfig = { providerId: 'anthropic', baseURL: '', modelId: 'claude-3-5-sonnet-20241022', hotkey: 'Cmd+Space' }
    saveConfig(cfg)
    expect(loadConfig()).toEqual(cfg)
    const raw = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
    expect(raw.providerId).toBe('anthropic')
  })

  it('读到非法 JSON 时回退默认值且不抛异常', () => {
    writeFileSync(join(dir, 'config.json'), '{not json', 'utf8')
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('部分字段缺失时用默认值补齐', () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ providerId: 'custom' }), 'utf8')
    expect(loadConfig()).toEqual({ ...DEFAULT_CONFIG, providerId: 'custom' })
  })
})
