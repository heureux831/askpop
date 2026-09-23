import { useCallback, useEffect, useRef, useState } from 'react'

export function useClipboard(enabled: boolean) {
  const [clipboardText, setClipboardText] = useState('')
  const lastRef = useRef<string | null>(null)

  const readClipboard = useCallback(async () => {
    if (!enabled) return
    try {
      const text = await window.api.clipboard.readText()
      if (text !== lastRef.current) {
        lastRef.current = text
        setClipboardText(text.trim())
      }
    } catch {
      // 剪贴板读取被拒时静默忽略
    }
  }, [enabled])

  const clearClipboard = useCallback(() => {
    setClipboardText('')
    lastRef.current = null
  }, [])

  useEffect(() => {
    void readClipboard()
  }, [readClipboard])

  return { clipboardText, readClipboard, clearClipboard }
}
