import { ipcMain, nativeTheme, clipboard, BrowserWindow } from 'electron'

import { saveProvider, deleteProvider, saveTasks, saveModel, deleteModel, saveAssistant, deleteAssistant, selectAssistant } from '../config/catalog'
import { IPC } from '@shared/ipc'
import { streamManager } from '../chat/streamManager'
import { getPublicConfig } from '../config/resolve'
import { setApiKey } from '../config/secretStore'
import { loadConfig, saveConfig } from '../config/store'
import { registerHotkey } from '../hotkey'
import { hideQuickAssistant, setPinQuickAssistant, getQuickWindow, beginQuickDrag, moveQuickDrag, endQuickDrag } from '../windows/quickWindow'
import { openSettingsWindow } from '../windows/settingsWindow'

function notifyConfigChanged(): void {
  const config = getPublicConfig()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.events.configChanged, config)
  }
}

export function registerIpcHandlers(): void {
  for (const [channel, action] of [
    [IPC.channels.providerSave, saveProvider], [IPC.channels.providerDelete, deleteProvider], [IPC.channels.tasksSave, saveTasks],
    [IPC.channels.modelSave, saveModel], [IPC.channels.modelDelete, deleteModel],
    [IPC.channels.assistantSave, saveAssistant], [IPC.channels.assistantDelete, deleteAssistant],
    [IPC.channels.assistantSelect, selectAssistant]
  ] as const) {
    ipcMain.handle(channel, (_event, payload) => {
      (action as (value: any) => void)(payload)
      notifyConfigChanged()
      return getPublicConfig()
    })
  }
  ipcMain.handle(IPC.channels.clipboardRead, () => clipboard.readText())
  ipcMain.handle(IPC.channels.clipboardWrite, (_event, text: string) => clipboard.writeText(text))
  ipcMain.handle(IPC.channels.configGet, () => getPublicConfig())

  ipcMain.handle(IPC.channels.configSet, (_e, cfg: Partial<Parameters<typeof saveConfig>[0]>) => {
    const previous = loadConfig()
    const next = { ...previous, ...cfg }
    registerHotkey(next.hotkey)
    try {
      saveConfig(next)
    } catch (error) {
      registerHotkey(previous.hotkey)
      throw error
    }
    nativeTheme.themeSource = next.theme ?? 'system'
    notifyConfigChanged()
  })

  ipcMain.handle(IPC.channels.configSetKey, (_e, { apiKey }: { apiKey: string }) => {
    setApiKey(apiKey)
    notifyConfigChanged()
  })

  ipcMain.on(IPC.channels.chatStream, (event, req) => {
    void streamManager.run(event.sender, req)
  })

  ipcMain.on(IPC.channels.chatAbort, (event) => {
    streamManager.abortFor(event.sender)
  })

  ipcMain.on(IPC.channels.quickDragStart, (event, point: unknown) => {
    if (event.sender.id === getQuickWindow()?.webContents.id) beginQuickDrag(point)
  })
  ipcMain.on(IPC.channels.quickDragMove, (event, point: unknown) => {
    if (event.sender.id === getQuickWindow()?.webContents.id) moveQuickDrag(point)
  })
  ipcMain.on(IPC.channels.quickDragEnd, (event) => {
    if (event.sender.id === getQuickWindow()?.webContents.id) endQuickDrag()
  })
  ipcMain.on(IPC.channels.quickHide, () => hideQuickAssistant())
  ipcMain.on(IPC.channels.quickSetPin, (_e, { pinned }: { pinned: boolean }) => setPinQuickAssistant(pinned))
  ipcMain.on(IPC.channels.settingsOpen, () => openSettingsWindow())
}
