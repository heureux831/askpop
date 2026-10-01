import { join } from 'path'
import { app, dialog, globalShortcut, nativeTheme } from 'electron'
import { getPublicConfig } from './config/resolve'
import { closeSecretStore } from './config/secretStore'
import { registerHotkey } from './hotkey'
import { registerIpcHandlers } from './ipc/handlers'
import { createQuickWindow, showQuickAssistant } from './windows/quickWindow'
import { openSettingsWindow } from './windows/settingsWindow'

// Keep the development and packaged app on the same data directory.
app.setName('quick-assistant-app')
if (app.isPackaged) app.setPath('userData', join(app.getPath('appData'), 'quick-assistant-app'))

app.whenReady().then(() => {
  nativeTheme.themeSource = getPublicConfig().theme ?? 'system'
  createQuickWindow()
  registerIpcHandlers()
  try {
    registerHotkey()
  } catch (error) {
    openSettingsWindow()
    void dialog.showMessageBox({ type: 'warning', message: '快捷键不可用', detail: (error as Error).message })
  }
  if (!getPublicConfig().hasApiKey) openSettingsWindow()
})

app.on('activate', () => showQuickAssistant())
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeSecretStore()
})
app.on('window-all-closed', () => app.quit())
