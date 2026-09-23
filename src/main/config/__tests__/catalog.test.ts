import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_CONFIG } from '@shared/config'
import { saveConfig, loadConfig, setConfigPath } from '../store'
import { setApiKey, setCipherProvider, setSecretPath, getModelApiKey } from '../secretStore'
import { saveModel, deleteModel, saveAssistant, deleteAssistant, selectAssistant, withCatalog } from '../catalog'
import { getPublicConfig, getResolvedConfig } from '../resolve'

describe('模型和助手配置', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-catalog-'))
    setConfigPath(join(dir, 'config.json')); setSecretPath(join(dir, 'secrets.bin'))
    setCipherProvider({ encrypt: (s) => Buffer.from(s).toString('base64'), decrypt: (b) => Buffer.from(b.toString(), 'base64').toString() })
    saveConfig({ ...DEFAULT_CONFIG, providerId: 'custom', baseURL: 'https://example.test/v1', modelId: 'old-model' })
    setApiKey('legacy-secret')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  it('旧配置和 Key 保留为默认模型／日常助手，并在首次写入保留旧配置备份', () => {
    const cfg = getPublicConfig()
    expect(cfg.models?.[0]).toMatchObject({ id: 'legacy-model', modelId: 'old-model', hasApiKey: true })
    expect(getResolvedConfig('default-assistant').apiKey).toBe('legacy-secret')
    saveAssistant({ name: '新助手', modelConfigId: 'legacy-model', systemPrompt: 'custom prompt', icon: 'code' })
    expect(JSON.parse(readFileSync(join(dir, 'config.json.v1.bak'), 'utf8')).modelId).toBe('old-model')
    expect(getResolvedConfig('default-assistant').apiKey).toBe('legacy-secret')
  })
  it('模型各自使用独立 Key，助手按选择解析模型与提示词', () => {
    saveModel({ name: '第二模型', providerId: 'custom', baseURL: 'https://two.test/v1', modelId: 'model-two', apiKey: 'key-two' })
    const id = withCatalog(loadConfig()).models[1].id
    saveAssistant({ name: '代码搭档', modelConfigId: id, systemPrompt: '你是代码审阅专家', icon: 'code' })
    const assistant = withCatalog(loadConfig()).assistants[1]
    selectAssistant(assistant.id)
    expect(getResolvedConfig()).toMatchObject({ apiKey: 'key-two', baseURL: 'https://two.test/v1', modelId: 'model-two', systemPrompt: '你是代码审阅专家' })
    expect(getResolvedConfig('default-assistant').apiKey).toBe('legacy-secret')
    expect(JSON.stringify(getPublicConfig())).not.toContain('key-two')
    expect(readFileSync(join(dir, 'config.json'), 'utf8')).not.toContain('key-two')
    expect(readFileSync(join(dir, 'model-secrets', `${id}.bin`), 'utf8')).not.toContain('key-two')
  })
  it('编辑模型时留空 Key 保持原值', () => {
    const model = withCatalog(loadConfig()).models[0]
    saveModel({ ...model, name: '重命名', apiKey: '' })
    expect(getModelApiKey(model.id)).toBe('legacy-secret')
  })
  it('引用中的模型不能删除，删除助手后可删除其模型和独立 Key', () => {
    expect(() => deleteModel('legacy-model')).toThrow('仍被助手使用')
    saveModel({ name: '临时模型', providerId: 'custom', baseURL: 'https://two.test/v1', modelId: 'model-two', apiKey: 'key-two' })
    const id = withCatalog(loadConfig()).models[1].id
    saveAssistant({ name: '临时助手', modelConfigId: id, systemPrompt: '', icon: 'spark' })
    const aid = withCatalog(loadConfig()).assistants[1].id
    selectAssistant(aid); deleteAssistant(aid); deleteModel(id)
    expect(getPublicConfig().activeAssistantId).toBe('default-assistant')
    expect(getModelApiKey(id)).toBeNull()
  })
  it('删除全部助手后保持空状态，不会重新创建默认助手', () => {
    deleteAssistant('default-assistant')
    expect(getPublicConfig().assistants).toEqual([])
    expect(() => getResolvedConfig()).toThrow('创建并选择')
  })
  it('拒绝无效配置和不存在的引用', () => {
    expect(() => saveModel({ name: 'bad', providerId: 'custom', baseURL: 'file:///tmp', modelId: 'm', apiKey: 'k' })).toThrow('HTTP')
    expect(() => saveAssistant({ name: 'bad', modelConfigId: 'missing', systemPrompt: '', icon: 'spark' })).toThrow('已配置的模型')
    expect(() => selectAssistant('missing')).toThrow('不存在')
    expect(() => getResolvedConfig('missing')).toThrow('创建并选择')
  })
})
