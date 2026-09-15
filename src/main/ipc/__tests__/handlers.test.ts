import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))

vi.mock('../../config/resolve', () => ({
  getPublicConfig: vi.fn()
}))

vi.mock('../../config/store', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn()
}))

vi.mock('../../config/secretStore', () => ({
  setApiKey: vi.fn()
}))

vi.mock('../../chat/streamManager', () => ({
  streamManager: {
    run: vi.fn(),
    abortFor: vi.fn()
  }
}))

vi.mock('../../windows/quickWindow', () => ({
  hideQuickAssistant: vi.fn(),
  setPinQuickAssistant: vi.fn()
}))

import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { PublicConfig } from '@shared/config'
import { registerIpcHandlers } from '../handlers'
import { getPublicConfig } from '../../config/resolve'
import { loadConfig, saveConfig } from '../../config/store'
import { setApiKey } from '../../config/secretStore'
import { streamManager } from '../../chat/streamManager'
import { hideQuickAssistant, setPinQuickAssistant } from '../../windows/quickWindow'

function handleFor(channel: string): (...args: any[]) => any {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no handle registered for ${channel}`)
  return call[1] as unknown as (...args: any[]) => any
}

function listenerFor(channel: string): (...args: any[]) => any {
  const call = vi.mocked(ipcMain.on).mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no on registered for ${channel}`)
  return call[1] as unknown as (...args: any[]) => any
}

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerIpcHandlers()
  })

  it('config:get 委托给 getPublicConfig，返回公开配置（不含原始密钥）', () => {
    const publicCfg: PublicConfig = { providerId: 'openai', baseURL: 'https://api.openai.com/v1', modelId: 'gpt-4o', hasApiKey: true, hotkey: 'h' }
    vi.mocked(getPublicConfig).mockReturnValue(publicCfg)

    const result = handleFor(IPC.channels.configGet)()

    expect(getPublicConfig).toHaveBeenCalledTimes(1)
    expect(result).toBe(publicCfg)
    expect(result).not.toHaveProperty('apiKey')
  })

  it('config:set 合并 loadConfig 结果后委托给 saveConfig', () => {
    vi.mocked(loadConfig).mockReturnValue({ providerId: 'openai', baseURL: '', modelId: '', hotkey: 'h' })

    handleFor(IPC.channels.configSet)(undefined, { modelId: 'gpt-4o' })

    expect(loadConfig).toHaveBeenCalledTimes(1)
    expect(saveConfig).toHaveBeenCalledWith({ providerId: 'openai', baseURL: '', modelId: 'gpt-4o', hotkey: 'h' })
  })

  it('config:setKey 委托给 setApiKey', () => {
    handleFor(IPC.channels.configSetKey)(undefined, { apiKey: 'sk-123' })

    expect(setApiKey).toHaveBeenCalledWith('sk-123')
  })

  it('chat:stream 委托给 streamManager.run', () => {
    const sender = { id: 1 }
    const req = { messages: [{ role: 'user', content: 'hi' }] }

    listenerFor(IPC.channels.chatStream)({ sender }, req)

    expect(vi.mocked(streamManager.run)).toHaveBeenCalledWith(sender, req)
  })

  it('chat:abort 委托给 streamManager.abortFor', () => {
    const sender = { id: 1 }

    listenerFor(IPC.channels.chatAbort)({ sender })

    expect(vi.mocked(streamManager.abortFor)).toHaveBeenCalledWith(sender)
  })

  it('quick:hide 委托给 hideQuickAssistant', () => {
    listenerFor(IPC.channels.quickHide)()

    expect(hideQuickAssistant).toHaveBeenCalledTimes(1)
  })

  it('quick:setPin 委托给 setPinQuickAssistant', () => {
    listenerFor(IPC.channels.quickSetPin)(undefined, { pinned: true })

    expect(setPinQuickAssistant).toHaveBeenCalledWith(true)
  })
})
