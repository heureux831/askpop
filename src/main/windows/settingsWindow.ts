import { BrowserWindow } from 'electron'
import { join } from 'path'

let win: BrowserWindow | null = null

export function openSettingsWindow(): void {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: 640,
    height: 560,
    title: '快捷助手设置',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.on('closed', () => (win = null))
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/settings.html'))
  }
}
