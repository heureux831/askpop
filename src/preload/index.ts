import { contextBridge, ipcRenderer } from 'electron'

import { IPC } from '../shared/ipc'
import type { PublicConfig, StoredConfig } from '../shared/config'

type Unsubscriber = () => void

const api = {
  config: {
    get: (): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.configGet),
    set: (cfg: Partial<StoredConfig>): Promise<void> => ipcRenderer.invoke(IPC.channels.configSet, cfg),
    setKey: (apiKey: string): Promise<void> => ipcRenderer.invoke(IPC.channels.configSetKey, { apiKey })
  },
  chat: {
    stream: (req: { messages: unknown[]; system?: string }): void => ipcRenderer.send(IPC.channels.chatStream, req),
    abort: (): void => ipcRenderer.send(IPC.channels.chatAbort),
    onChunk: (cb: (text: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { text: string }) => cb(p.text)
      ipcRenderer.on(IPC.events.chatChunk, l)
      return () => ipcRenderer.removeListener(IPC.events.chatChunk, l)
    },
    onDone: (cb: () => void): Unsubscriber => {
      const l = () => cb()
      ipcRenderer.on(IPC.events.chatDone, l)
      return () => ipcRenderer.removeListener(IPC.events.chatDone, l)
    },
    onError: (cb: (message: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { message: string }) => cb(p.message)
      ipcRenderer.on(IPC.events.chatError, l)
      return () => ipcRenderer.removeListener(IPC.events.chatError, l)
    }
  },
  quick: {
    hide: (): void => ipcRenderer.send(IPC.channels.quickHide),
    setPin: (pinned: boolean): void => ipcRenderer.send(IPC.channels.quickSetPin, { pinned }),
    onShown: (cb: () => void): Unsubscriber => {
      const l = () => cb()
      ipcRenderer.on(IPC.events.quickShown, l)
      return () => ipcRenderer.removeListener(IPC.events.quickShown, l)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
