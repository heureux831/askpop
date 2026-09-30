import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  isDestroyed: vi.fn(() => false), isVisible: vi.fn(() => true),
  isFocused: vi.fn(() => false), isMinimized: vi.fn(() => false),
  getPosition: vi.fn(() => [400, 180]), setPosition: vi.fn(),
  getBounds: vi.fn(() => ({ x: 400, y: 180, width: 600, height: 480 })),
  show: vi.fn(), focus: vi.fn(), restore: vi.fn(),
  setAlwaysOnTop: vi.fn(), setVisibleOnAllWorkspaces: vi.fn(), on: vi.fn(),
  loadFile: vi.fn(), hide: vi.fn(),
  webContents: { on: vi.fn(), setWindowOpenHandler: vi.fn(), send: vi.fn() }
}))
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => fake),
  app: { hide: vi.fn(), isHidden: vi.fn(() => false), show: vi.fn() },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 300 })),
    getDisplayNearestPoint: vi.fn(() => ({ id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } }))
  },
  shell: {}
}))
import { app } from 'electron'
import { beginQuickDrag, createQuickWindow, endQuickDrag, hideQuickAssistant, moveQuickDrag, toggleQuickAssistant } from '../quickWindow'

describe('quick window dragging', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); createQuickWindow() })
  afterEach(() => { endQuickDrag(); vi.useRealTimers() })

  it('moves by absolute pointer delta without accumulating drift, and stops on release', () => {
    beginQuickDrag({ x: 664, y: 207 })
    moveQuickDrag({ x: 810, y: 290 })
    expect(fake.setPosition).toHaveBeenLastCalledWith(546, 263, false)
    moveQuickDrag({ x: 700, y: 240 })
    expect(fake.setPosition).toHaveBeenLastCalledWith(436, 213, false)
    endQuickDrag()
    moveQuickDrag({ x: 900, y: 300 })
    expect(fake.setPosition).toHaveBeenCalledTimes(2)
  })

  it('ignores invalid coordinates and movement without an active drag', () => {
    moveQuickDrag({ x: 1, y: 2 })
    beginQuickDrag({ x: NaN, y: 2 })
    moveQuickDrag({ x: 1, y: 2 })
    expect(fake.setPosition).not.toHaveBeenCalled()
    beginQuickDrag({ x: 1, y: 2 })
    moveQuickDrag({ x: 1, y: Infinity })
    moveQuickDrag(null)
    expect(fake.setPosition).not.toHaveBeenCalled()
  })

  it('expires an interrupted drag so the window cannot follow later movement', () => {
    beginQuickDrag({ x: 1, y: 2 })
    vi.advanceTimersByTime(30_000)
    moveQuickDrag({ x: 3, y: 4 })
    expect(fake.setPosition).not.toHaveBeenCalled()
  })

  it('shows the assistant when it is visible but not focused', () => {
    toggleQuickAssistant()
    expect(fake.show).toHaveBeenCalledOnce()
    expect(fake.focus).toHaveBeenCalledOnce()
    expect(fake.hide).not.toHaveBeenCalled()
  })

  it('hides only the assistant when the focused window is toggled off', () => {
    fake.isFocused.mockReturnValueOnce(true)
    toggleQuickAssistant()
    expect(fake.hide).toHaveBeenCalledOnce()
    expect(app.hide).not.toHaveBeenCalled()
  })

  it.skipIf(process.platform !== 'darwin')('restores a macOS-hidden app before showing the assistant', () => {
    vi.mocked(app.isHidden).mockReturnValueOnce(true)
    fake.isVisible.mockReturnValueOnce(false)
    toggleQuickAssistant()
    expect(app.show).toHaveBeenCalledOnce()
    expect(fake.show).toHaveBeenCalledOnce()
  })

  it('hiding the assistant does not hide the application', () => {
    hideQuickAssistant()
    expect(fake.hide).toHaveBeenCalledOnce()
    expect(app.hide).not.toHaveBeenCalled()
  })
})
