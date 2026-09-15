import { ipcMain } from 'electron'

import { IPC } from '@shared/ipc'
import { streamManager } from '../chat/streamManager'
import { getPublicConfig } from '../config/resolve'
import { setApiKey } from '../config/secretStore'
import { loadConfig, saveConfig } from '../config/store'
import { registerHotkey } from '../hotkey'
import { hideQuickAssistant, setPinQuickAssistant } from '../windows/quickWindow'
import { openSettingsWindow } from '../windows/settingsWindow'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.channels.configGet, () => getPublicConfig())

  ipcMain.handle(IPC.channels.configSet, (_e, cfg: Partial<Parameters<typeof saveConfig>[0]>) => {
    saveConfig({ ...loadConfig(), ...cfg })
    registerHotkey()
  })

  ipcMain.handle(IPC.channels.configSetKey, (_e, { apiKey }: { apiKey: string }) => {
    setApiKey(apiKey)
  })

  ipcMain.on(IPC.channels.chatStream, (event, req) => {
    void streamManager.run(event.sender, req)
  })

  ipcMain.on(IPC.channels.chatAbort, (event) => {
    streamManager.abortFor(event.sender)
  })

  ipcMain.on(IPC.channels.quickHide, () => hideQuickAssistant())
  ipcMain.on(IPC.channels.quickSetPin, (_e, { pinned }: { pinned: boolean }) => setPinQuickAssistant(pinned))
  ipcMain.on(IPC.channels.settingsOpen, () => openSettingsWindow())
}
