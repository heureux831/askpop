import { app, globalShortcut } from 'electron'
import { getPublicConfig } from './config/resolve'
import { registerIpcHandlers } from './ipc/handlers'
import { createQuickWindow, toggleQuickAssistant } from './windows/quickWindow'
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

function registerHotkey(): void {
  const accel = getPublicConfig().hotkey
  globalShortcut.register(accel, () => toggleQuickAssistant())
}

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => app.quit())
