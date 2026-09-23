import { globalShortcut } from 'electron'
import { getPublicConfig } from './config/resolve'
import { toggleQuickAssistant } from './windows/quickWindow'

let currentHotkey = ''

export function registerHotkey(accel = getPublicConfig().hotkey): void {
  accel = accel.replace(/\b(CommandOrControl|CmdOrCtrl|Cmd)\b/g, 'Command')
  if (accel === currentHotkey && globalShortcut.isRegistered(accel)) return
  let registered = false
  try {
    registered = Boolean(accel) && globalShortcut.register(accel, toggleQuickAssistant)
  } catch {
    throw new Error('快捷键格式无效，请重新录入组合键。')
  }
  if (!registered) throw new Error('快捷键已被占用或无法注册，请换一个组合键。原快捷键保持有效。')
  if (currentHotkey) globalShortcut.unregister(currentHotkey)
  currentHotkey = accel
}
