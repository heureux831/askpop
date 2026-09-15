import { app, globalShortcut } from 'electron'
import { getPublicConfig } from './config/resolve'
import { registerHotkey } from './hotkey'
import { registerIpcHandlers } from './ipc/handlers'
import { createQuickWindow } from './windows/quickWindow'
import { openSettingsWindow } from './windows/settingsWindow'

app.whenReady().then(() => {
  createQuickWindow()
  registerIpcHandlers()
  registerHotkey()
  maybePromptSetup()
})

function maybePromptSetup(): void {
  if (!getPublicConfig().hasApiKey) {
    openSettingsWindow()
  }
}

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => app.quit())
