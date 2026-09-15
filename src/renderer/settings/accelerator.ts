const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'Command'])

export function normalizeKey(key: string): string {
  if (MODIFIER_KEYS.has(key)) return ''
  switch (key) {
    case ' ':
      return 'Space'
    case 'ArrowUp':
      return 'Up'
    case 'ArrowDown':
      return 'Down'
    case 'ArrowLeft':
      return 'Left'
    case 'ArrowRight':
      return 'Right'
    case 'Escape':
      return 'Esc'
    case 'Enter':
      return 'Return'
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

export interface Modifiers {
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  key: string
}

export function formatAccelerator(e: Modifiers): string {
  const parts: string[] = []
  if (e.metaKey) parts.push('Command')
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = normalizeKey(e.key)
  if (!key) return ''
  parts.push(key)
  return parts.join('+')
}
