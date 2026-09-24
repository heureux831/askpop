import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_CONFIG } from '@shared/config'
import { saveConfig, loadConfig, setConfigPath } from '../store'
import { setApiKey, setCipherProvider, setSecretPath, getModelApiKey } from '../secretStore'
import { saveProvider, deleteProvider, saveTasks, saveModel, deleteModel, saveAssistant, deleteAssistant, selectAssistant, withCatalog } from '../catalog'
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
    expect(JSON.parse(readFileSync(join(dir, 'config.json.v3.bak'), 'utf8')).modelId).toBe('old-model')
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
  it('引用中的模型不能删除，删除模型后保留服务商共享 Key，删除服务商后清除 Key', () => {
    expect(() => deleteModel('legacy-model')).toThrow('仍被助手使用')
    saveModel({ name: '临时模型', providerId: 'custom', baseURL: 'https://two.test/v1', modelId: 'model-two', apiKey: 'key-two' })
    const id = withCatalog(loadConfig()).models[1].id
    saveAssistant({ name: '临时助手', modelConfigId: id, systemPrompt: '', icon: 'spark' })
    const aid = withCatalog(loadConfig()).assistants[1].id
    selectAssistant(aid); deleteAssistant(aid); deleteModel(id)
    expect(getPublicConfig().activeAssistantId).toBe('default-assistant')
    expect(getModelApiKey(id)).toBe('key-two')
    deleteProvider(`provider-${id}`)
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
  it('保存和读取模型预设、开关及思考强度，保留已有 Key', () => {
    const model = withCatalog(loadConfig()).models[0]
    saveModel({ ...model, presetId: 'deepseek/flash', modelId: 'deepseek-v4-flash', thinking: 'disabled', apiKey: '' })
    expect(getResolvedConfig()).toMatchObject({ presetId: 'deepseek/flash', thinking: 'disabled', apiKey: 'legacy-secret' })
    saveModel({ ...getPublicConfig().models![0], thinking: 'enabled', thinkingEffort: 'low' })
    expect(getResolvedConfig()).toMatchObject({ thinking: 'enabled', thinkingEffort: 'low' })
    saveModel({ ...getPublicConfig().models![0], thinking: 'default', thinkingEffort: undefined })
    expect(getResolvedConfig().thinking).toBe('default')
    expect(getResolvedConfig().thinkingEffort).toBeUndefined()
  })
  it('错误思考配置不会覆盖已保存的 Key 或配置', () => {
    const model = withCatalog(loadConfig()).models[0]
    expect(() => saveModel({ ...model, thinking: 'enabled', apiKey: 'should-not-save' })).toThrow('预设')
    expect(getResolvedConfig().apiKey).toBe('legacy-secret')
    expect(getPublicConfig().models![0].thinking).toBeUndefined()
  })

  it('服务商统一保存 Key，多个模型共享连接、支持显示名称和温度', () => {
    saveProvider({ presetId: 'deepseek', name: '开发账号', protocol: 'openai', baseURL: 'https://example.test/v1', apiKey: 'shared-secret' })
    const provider = getPublicConfig().providers!.at(-1)!
    for (const [modelId, name, temperature] of [['api-a', '', 0], ['api-b', '显示 B', 1.2]] as const) saveModel({ providerConfigId: provider.id, providerId: 'custom', baseURL: provider.baseURL, modelId, name, temperature })
    const models = getPublicConfig().models!.filter((m) => m.providerConfigId === provider.id)
    expect(models.map((m) => m.name)).toEqual(['api-a', '显示 B'])
    expect(models.every((m) => m.hasApiKey)).toBe(true)
    saveAssistant({ name: '测试', modelConfigId: models[0].id, systemPrompt: 'system', icon: 'spark' })
    const aid = getPublicConfig().assistants!.at(-1)!.id
    expect(getResolvedConfig(aid)).toMatchObject({ apiKey: 'shared-secret', modelId: 'api-a', temperature: 0 })
    saveProvider({ ...provider, baseURL: 'https://other.test/v1', apiKey: '' })
    expect(getResolvedConfig(aid)).toMatchObject({ baseURL: 'https://other.test/v1', apiKey: 'shared-secret' })
    expect(() => deleteProvider(provider.id)).toThrow('仍被助手使用')
    expect(readFileSync(join(dir, 'config.json'), 'utf8')).not.toContain('shared-secret')
    expect(JSON.stringify(getPublicConfig())).not.toContain('shared-secret')
    expect(() => saveModel({ ...models[0], temperature: NaN })).toThrow('温度')
    expect(() => saveModel({ ...models[0], id: undefined })).toThrow('相同')
  })
  it('迁移不合并不同模型的凭据，读取不修改配置，保存时保留旧字段', () => {
    saveModel({ name: '另一个账号', providerId: 'custom', baseURL: 'https://example.test/v1', modelId: 'same-service', apiKey: 'other-secret' })
    const before = readFileSync(join(dir, 'config.json'), 'utf8')
    const cfg = getPublicConfig()
    expect(cfg.models![0].providerConfigId).not.toBe(cfg.models![1].providerConfigId)
    expect(readFileSync(join(dir, 'config.json'), 'utf8')).toBe(before)
    expect(getResolvedConfig().apiKey).toBe('legacy-secret')
  })
  it('任务保存顺序、标题、提示词，拒绝重复和空列表', () => {
    const tasks = getPublicConfig().tasks!.slice().reverse()
    tasks[0] = { ...tasks[0], title: '审稿', prompt: '找出逻辑问题' }
    saveTasks(tasks)
    expect(getPublicConfig().tasks).toEqual(tasks)
    expect(() => saveTasks([])).toThrow('1～30')
    expect(() => saveTasks([tasks[0], tasks[0]])).toThrow('重复')
    expect(getPublicConfig().tasks).toEqual(tasks)
  })

  it('本机 Ollama 无需密钥，远程地址仍要求密钥', () => {
    saveProvider({ presetId: 'ollama', name: '本机', protocol: 'openai', baseURL: 'http://localhost:11434/v1' })
    const provider = getPublicConfig().providers!.at(-1)!
    saveModel({ providerConfigId: provider.id, providerId: 'custom', baseURL: provider.baseURL, modelId: 'my-local-model', name: '' })
    const model = getPublicConfig().models!.at(-1)!
    saveAssistant({ name: '本机助手', modelConfigId: model.id, systemPrompt: '', icon: 'spark' })
    const id = getPublicConfig().assistants!.at(-1)!.id
    expect(getResolvedConfig(id)).toMatchObject({ keyOptional: true, apiKey: '' })
    expect(model.hasApiKey).toBe(true)
    saveProvider({ ...provider, baseURL: 'https://remote.example.test/v1' })
    expect(getResolvedConfig(id).keyOptional).toBe(false)
    expect(getPublicConfig().models!.at(-1)!.hasApiKey).toBe(false)
  })

})
