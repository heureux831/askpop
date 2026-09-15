import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import ClipboardPreview from './components/ClipboardPreview'
import FeatureMenus, { type FeatureMenusRef, type MiniRoute } from './components/FeatureMenus'
import Footer from './components/Footer'
import InputBar from './components/InputBar'
import MessageList from './components/MessageList'
import { Separator } from './components/ui'
import TranslateWindow from './components/TranslateWindow'
import { useChatStream } from './useChatStream'
import { useClipboard } from './useClipboard'

export default function HomeWindow() {
  const [route, setRoute] = useState<MiniRoute>('home')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [input, setInput] = useState('')
  const [isPinned, setIsPinned] = useState(false)

  const { messages, isStreaming, error, send, stop, reset } = useChatStream()
  const { clipboardText, readClipboard, clearClipboard } = useClipboard(true)
  const menusRef = useRef<FeatureMenusRef>(null)

  const setPin = useCallback((p: boolean) => {
    window.api.quick.setPin(p)
    setIsPinned(p)
  }, [])

  const requestText = useMemo(() => {
    const trimmed = input.trim()
    if (!isFirstMessage || !clipboardText) return trimmed
    if (!trimmed || clipboardText === trimmed) return clipboardText
    return `${clipboardText}\n\n${trimmed}`
  }, [clipboardText, input, isFirstMessage])

  const onWindowShow = useCallback(() => {
    void readClipboard()
  }, [readClipboard])

  // 每次窗口 show 时重新读剪贴板
  useEffect(() => window.api.quick.onShown(onWindowShow), [onWindowShow])

  const handleSend = useCallback(
    (prompt?: string) => {
      const text = [prompt, requestText].filter(Boolean).join('\n\n')
      if (!text.trim()) return
      setIsFirstMessage(false)
      setInput('')
      send(text)
    },
    [requestText, send]
  )

  const handleEsc = useCallback(() => {
    if (isStreaming) {
      stop()
      return
    }
    if (route === 'home') {
      window.api.quick.hide()
      return
    }
    reset()
    setRoute('home')
    setInput('')
    menusRef.current?.resetSelectedIndex()
  }, [isStreaming, route, stop, reset])

  const handleCopy = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    if (last?.content) void navigator.clipboard.writeText(last.content)
  }, [messages])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    switch (e.code) {
      case 'Enter':
      case 'NumpadEnter':
        if (isStreaming) return
        e.preventDefault()
        if (requestText) {
          if (route === 'home') menusRef.current?.useFeature()
          else {
            setRoute('chat')
            handleSend()
          }
        }
        break
      case 'Backspace':
        if (input.length === 0) clearClipboard()
        break
      case 'ArrowUp':
        if (route === 'home') {
          e.preventDefault()
          menusRef.current?.prevFeature()
        }
        break
      case 'ArrowDown':
        if (route === 'home') {
          e.preventDefault()
          menusRef.current?.nextFeature()
        }
        break
      case 'Escape':
        handleEsc()
        break
    }
  }

  const body = () => {
    if (route === 'translate') {
      return <TranslateWindow text={requestText} />
    }
    if (route !== 'home') {
      return (
        <>
          <MessageList messages={messages} isStreaming={isStreaming} />
          {error && (
            <div className="rounded border border-error-border bg-error-subtle px-3 py-2 text-[13px]">
              {error === 'NO_API_KEY' ? '尚未配置 API Key，请打开设置填写。' : error}
            </div>
          )}
        </>
      )
    }
    return (
      <>
        <ClipboardPreview clipboardText={clipboardText} clearClipboard={clearClipboard} />
        <main className="flex flex-1 flex-col overflow-hidden">
          <FeatureMenus setRoute={setRoute} onSendMessage={handleSend} text={requestText} ref={menusRef} />
        </main>
      </>
    )
  }

  return (
    <div className="flex h-full w-full flex-1 flex-col px-2.5 py-2 [-webkit-app-region:drag]">
      <InputBar
        text={input}
        placeholder="输入问题或选择下方功能…"
        loading={isStreaming}
        handleKeyDown={handleKeyDown}
        handleChange={(e) => setInput(e.target.value)}
      />
      <Separator className="my-2.5" />
      {body()}
      <Separator className="my-2.5" />
      <Footer
        route={route}
        loading={isStreaming}
        isPinned={isPinned}
        setIsPinned={setPin}
        clearClipboard={clearClipboard}
        onEsc={handleEsc}
        onCopy={handleCopy}
        canUseBackspace={input.length > 0 || clipboardText.length === 0}
      />
    </div>
  )
}
