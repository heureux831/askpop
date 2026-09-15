import { globalShortcut } from 'electron'

import { getPublicConfig } from './config/resolve'
import { toggleQuickAssistant } from './windows/quickWindow'

export function registerHotkey(): void {
  globalShortcut.unregisterAll()
  const accel = getPublicConfig().hotkey
  if (accel) {
    globalShortcut.register(accel, () => toggleQuickAssistant())
  }
}
