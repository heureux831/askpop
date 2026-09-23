import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ globalShortcut: { register: vi.fn(), unregister: vi.fn(), isRegistered: vi.fn() } }))
vi.mock('../config/resolve', () => ({ getPublicConfig: vi.fn() }))
vi.mock('../windows/quickWindow', () => ({ toggleQuickAssistant: vi.fn() }))
import { globalShortcut } from 'electron'
beforeEach(() => { vi.resetModules(); vi.resetAllMocks() })
it('注册失败保留旧快捷键，成功才移除旧快捷键', async () => {
  const { registerHotkey } = await import('../hotkey')
  vi.mocked(globalShortcut.register).mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(true)
  registerHotkey('Command+1')
  expect(() => registerHotkey('Command+2')).toThrow('已被占用')
  expect(globalShortcut.unregister).not.toHaveBeenCalled()
  registerHotkey('Command+3')
  expect(globalShortcut.unregister).toHaveBeenCalledWith('Command+1')
})
it('保存相同快捷键不会重复注册', async () => {
  const { registerHotkey } = await import('../hotkey')
  vi.mocked(globalShortcut.register).mockReturnValue(true)
  registerHotkey('Command+1')
  vi.mocked(globalShortcut.isRegistered).mockReturnValue(true)
  registerHotkey('Command+1')
  expect(globalShortcut.register).toHaveBeenCalledTimes(1)
})

it('重新录入默认快捷键时识别 CommandOrControl 和 Command 为同一个键', async () => {
  const { registerHotkey } = await import('../hotkey')
  vi.mocked(globalShortcut.register).mockReturnValue(true)
  registerHotkey('CommandOrControl+Shift+Space')
  vi.mocked(globalShortcut.isRegistered).mockReturnValue(true)
  registerHotkey('Command+Shift+Space')
  expect(globalShortcut.register).toHaveBeenCalledTimes(1)
})
