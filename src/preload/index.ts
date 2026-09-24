import type { ProviderInput } from '@shared/providers'
import type { QuickTask } from '@shared/tasks'
import { contextBridge, ipcRenderer } from 'electron'

import { IPC } from '../shared/ipc'
import type { PublicConfig, StoredConfig, ModelInput, AssistantInput } from '../shared/config'

type Unsubscriber = () => void

const api = {
  clipboard: {
    readText: (): Promise<string> => ipcRenderer.invoke(IPC.channels.clipboardRead),
    writeText: (text: string): Promise<void> => ipcRenderer.invoke(IPC.channels.clipboardWrite, text)
  },
  providers: {
    save: (input: ProviderInput): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.providerSave, input),
    delete: (id: string): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.providerDelete, id)
  },
  tasks: { save: (tasks: QuickTask[]): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.tasksSave, tasks) },
  models: {
    save: (input: ModelInput): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.modelSave, input),
    delete: (id: string): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.modelDelete, id)
  },
  assistants: {
    save: (input: AssistantInput): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.assistantSave, input),
    delete: (id: string): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.assistantDelete, id),
    select: (id: string): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.assistantSelect, id)
  },
  config: {
    onChanged: (cb: (config: PublicConfig) => void): Unsubscriber => {
      const listener = (_e: unknown, config: PublicConfig) => cb(config)
      ipcRenderer.on(IPC.events.configChanged, listener)
      return () => ipcRenderer.removeListener(IPC.events.configChanged, listener)
    },
    get: (): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.configGet),
    set: (cfg: Partial<StoredConfig>): Promise<void> => ipcRenderer.invoke(IPC.channels.configSet, cfg),
    setKey: (apiKey: string): Promise<void> => ipcRenderer.invoke(IPC.channels.configSetKey, { apiKey })
  },
  chat: {
    stream: (req: { requestId: string; assistantId?: string; taskId?: string; messages: unknown[]; system?: string }): void => ipcRenderer.send(IPC.channels.chatStream, req),
    abort: (): void => ipcRenderer.send(IPC.channels.chatAbort),
    onReasoning: (cb: (text: string, requestId: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { text: string; requestId: string }) => cb(p.text, p.requestId)
      ipcRenderer.on(IPC.events.chatReasoning, l)
      return () => ipcRenderer.removeListener(IPC.events.chatReasoning, l)
    },
    onChunk: (cb: (text: string, requestId: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { text: string; requestId: string }) => cb(p.text, p.requestId)
      ipcRenderer.on(IPC.events.chatChunk, l)
      return () => ipcRenderer.removeListener(IPC.events.chatChunk, l)
    },
    onDone: (cb: (requestId: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { requestId: string }) => cb(p.requestId)
      ipcRenderer.on(IPC.events.chatDone, l)
      return () => ipcRenderer.removeListener(IPC.events.chatDone, l)
    },
    onError: (cb: (message: string, requestId: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { message: string; requestId: string }) => cb(p.message, p.requestId)
      ipcRenderer.on(IPC.events.chatError, l)
      return () => ipcRenderer.removeListener(IPC.events.chatError, l)
    }
  },
  quick: {
    beginDrag: (point: { x: number; y: number }): void => ipcRenderer.send(IPC.channels.quickDragStart, point),
    moveDrag: (point: { x: number; y: number }): void => ipcRenderer.send(IPC.channels.quickDragMove, point),
    endDrag: (): void => ipcRenderer.send(IPC.channels.quickDragEnd),
    hide: (): void => ipcRenderer.send(IPC.channels.quickHide),
    setPin: (pinned: boolean): void => ipcRenderer.send(IPC.channels.quickSetPin, { pinned }),
    onShown: (cb: () => void): Unsubscriber => {
      const l = () => cb()
      ipcRenderer.on(IPC.events.quickShown, l)
      return () => ipcRenderer.removeListener(IPC.events.quickShown, l)
    }
  },
  settings: {
    open: (): void => ipcRenderer.send(IPC.channels.settingsOpen)
  }
}

contextBridge.exposeInMainWorld('api', api)
