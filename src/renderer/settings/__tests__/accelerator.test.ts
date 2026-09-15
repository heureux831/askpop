import { describe, expect, it } from 'vitest'

import { formatAccelerator, normalizeKey } from '../accelerator'

describe('normalizeKey', () => {
  it('把特殊键映射为 Electron accelerator 键名', () => {
    expect(normalizeKey(' ')).toBe('Space')
    expect(normalizeKey('ArrowUp')).toBe('Up')
    expect(normalizeKey('ArrowDown')).toBe('Down')
    expect(normalizeKey('Escape')).toBe('Esc')
    expect(normalizeKey('Enter')).toBe('Return')
  })

  it('单字符键转大写', () => {
    expect(normalizeKey('a')).toBe('A')
    expect(normalizeKey('1')).toBe('1')
  })

  it('纯修饰键返回空串（不捕获）', () => {
    expect(normalizeKey('Shift')).toBe('')
    expect(normalizeKey('Control')).toBe('')
    expect(normalizeKey('Meta')).toBe('')
  })
})

describe('formatAccelerator', () => {
  it('组合键生成 Electron accelerator 字符串', () => {
    expect(formatAccelerator({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: ' ' })).toBe(
      'Command+Shift+Space'
    )
    expect(formatAccelerator({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: false, key: 'k' })).toBe(
      'Control+K'
    )
    expect(formatAccelerator({ metaKey: false, ctrlKey: false, altKey: true, shiftKey: false, key: 'ArrowUp' })).toBe(
      'Alt+Up'
    )
  })

  it('只有修饰键时返回空串', () => {
    expect(formatAccelerator({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'Meta' })).toBe('')
  })
})
