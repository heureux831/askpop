import { BrowserWindow, app, screen, shell } from 'electron'
import { join } from 'path'

import { IPC } from '@shared/ipc'

let win: BrowserWindow | null = null
let isPinned = false
let dragOrigin: { window: number[]; pointer: { x: number; y: number } } | null = null
let dragTimeout: ReturnType<typeof setTimeout> | null = null

function isPoint(value: unknown): value is { x: number; y: number } {
  return !!value && typeof value === 'object' &&
    Number.isFinite((value as { x: number }).x) && Number.isFinite((value as { y: number }).y)
}

export function endQuickDrag(): void {
  dragOrigin = null
  if (dragTimeout) clearTimeout(dragTimeout)
  dragTimeout = null
}

export function beginQuickDrag(point: unknown): void {
  endQuickDrag()
  const window = getQuickWindow()
  if (!window?.isVisible() || !isPoint(point)) return
  dragOrigin = { window: window.getPosition(), pointer: point }
  dragTimeout = setTimeout(endQuickDrag, 30_000)
}

export function moveQuickDrag(point: unknown): void {
  const window = getQuickWindow()
  if (!dragOrigin || !window?.isVisible() || !isPoint(point)) return
  window.setPosition(
    Math.round(dragOrigin.window[0] + point.x - dragOrigin.pointer.x),
    Math.round(dragOrigin.window[1] + point.y - dragOrigin.pointer.y), false
  )
}

export function createQuickWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 600,
    height: 480,
    minWidth: 440,
    minHeight: 380,
    maxWidth: 1024,
    maxHeight: 768,
    frame: false,
    movable: true,
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
    if (!isPinned && !dragOrigin) hideQuickAssistant()
  })
  win.on('closed', () => endQuickDrag())
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
  if (process.platform === 'darwin' && app.isHidden()) app.show()
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
  w.webContents.send(IPC.events.quickShown, undefined)
}

export function hideQuickAssistant(): void {
  endQuickDrag()
  const w = getQuickWindow()
  w?.hide()
}

export function toggleQuickAssistant(): void {
  const w = getQuickWindow()
  if (w?.isVisible() && w.isFocused()) hideQuickAssistant()
  else showQuickAssistant()
}

export function setPinQuickAssistant(pinned: boolean): void {
  isPinned = pinned
}
