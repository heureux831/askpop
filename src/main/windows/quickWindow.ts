import { BrowserWindow, app, screen, shell } from 'electron'
import { join } from 'path'

import { IPC } from '@shared/ipc'

let win: BrowserWindow | null = null
let isPinned = false

export function createQuickWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 550,
    height: 400,
    minWidth: 350,
    minHeight: 380,
    maxWidth: 1024,
    maxHeight: 768,
    frame: false,
    show: false,
    alwaysOnTop: true,
    useContentSize: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    type: 'panel',
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'followWindow',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('blur', () => {
    if (!isPinned) hideQuickAssistant()
  })
  win.on('show', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.events.quickShown, undefined)
    }
  })

  // 严格导航安全：非本应用 URL 一律拦截，安全的走系统浏览器
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/quick.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/quick.html'))
  }
  return win
}

function isAppUrl(url: string): boolean {
  return process.env['ELECTRON_RENDERER_URL'] ? url.startsWith(process.env['ELECTRON_RENDERER_URL']) : url.startsWith('file://')
}

export function getQuickWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function showQuickAssistant(): void {
  const w = getQuickWindow()
  if (!w) return
  if (w.isMinimized()) w.restore()
  const bounds = w.getBounds()
  const cursor = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const windowDisplay = screen.getDisplayNearestPoint(bounds)
  if (cursor.id !== windowDisplay.id) {
    const { x, y, width, height } = cursor.bounds
    w.setPosition(Math.round(x + (width - bounds.width) / 2), Math.round(y + (height - bounds.height) / 2))
  }
  w.show()
  w.focus()
}

export function hideQuickAssistant(): void {
  const w = getQuickWindow()
  w?.hide()
  const anyOtherVisible = BrowserWindow.getAllWindows().some(
    (win) => win !== w && !win.isDestroyed() && win.isVisible()
  )
  if (!anyOtherVisible) {
    app.hide()
  }
}

export function toggleQuickAssistant(): void {
  const w = getQuickWindow()
  if (w?.isVisible()) hideQuickAssistant()
  else showQuickAssistant()
}

export function setPinQuickAssistant(pinned: boolean): void {
  isPinned = pinned
}
