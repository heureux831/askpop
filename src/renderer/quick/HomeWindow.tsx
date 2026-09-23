import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { GripHorizontal, Settings2, Sparkles } from 'lucide-react'
import type { PublicConfig } from '@shared/config'
import AssistantPicker from './components/AssistantPicker'

import ClipboardPreview from './components/ClipboardPreview'
import FeatureMenus, { type FeatureMenusRef, type MiniRoute } from './components/FeatureMenus'
import Footer from './components/Footer'
import InputBar from './components/InputBar'
import MessageList from './components/MessageList'
import TranslateWindow, { SYSTEM_TRANSLATE } from './components/TranslateWindow'
import { useChatStream } from './useChatStream'
import { useClipboard } from './useClipboard'

export default function HomeWindow() {
  const [route, setRoute] = useState<MiniRoute>('home')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [input, setInput] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [configError, setConfigError] = useState('')
  const assistantStamp = useRef('')
  const dragging = useRef(false)

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragging.current) window.api.quick.moveDrag({ x: event.screenX, y: event.screenY })
    }
    const end = () => {
      if (dragging.current) window.api.quick.endDrag()
      dragging.current = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      end()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
    }
  }, [])


  const { messages, isStreaming, error, send, stop, reset } = useChatStream()
  const { clipboardText, readClipboard, clearClipboard } = useClipboard(true)
  const menusRef = useRef<FeatureMenusRef>(null)

  useEffect(() => {
    const receive = (cfg: PublicConfig) => {
      const active = cfg.assistants?.find((a) => a.id === cfg.activeAssistantId)
      const model = cfg.models?.find((m) => m.id === active?.modelConfigId)
      const stamp = JSON.stringify([active, model])
      if (assistantStamp.current && assistantStamp.current !== stamp) {
        reset(); setRoute('home'); setIsFirstMessage(true); setInput('')
      }
      assistantStamp.current = stamp
      setConfig(cfg)
    }
    void window.api.config.get().then(receive).catch((error) => setConfigError(String(error)))
    return window.api.config.onChanged(receive)
  }, [reset])
  const activeAssistant = config?.assistants?.find((a) => a.id === config.activeAssistantId)
  const activeModel = config?.models?.find((m) => m.id === activeAssistant?.modelConfigId)
  const selectAssistant = async (id: string) => {
    if (id === config?.activeAssistantId) return
    setConfigError('')
    reset()
    try { setConfig(await window.api.assistants.select(id)) } catch (error) { setConfigError((error as Error).message) }
  }

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
    (prompt?: string, translate = false) => {
      const text = [prompt, requestText].filter(Boolean).join('\n\n')
      if (!text.trim()) return
      if (!activeAssistant) { window.api.settings.open(); return }
      setIsFirstMessage(false)
      setInput('')
      send(text, { assistantId: activeAssistant.id, ...(translate ? { system: SYSTEM_TRANSLATE, replace: true } : {}) })
    },
    [requestText, send, activeAssistant]
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
    setIsFirstMessage(true)
    setInput('')
    void readClipboard()
    menusRef.current?.resetSelectedIndex()
  }, [isStreaming, route, stop, reset, readClipboard])

  const handleCopy = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    if (last?.content) void window.api.clipboard.writeText(last.content)
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
            handleSend(undefined, route === 'translate')
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
    if (route !== 'home') {
      return (
        <>
          {route === 'translate'
            ? <TranslateWindow messages={messages} isStreaming={isStreaming} />
            : <MessageList messages={messages} isStreaming={isStreaming} />}
          {error && (
            <div role="alert" className="rounded border border-error-border bg-error-subtle px-3 py-2 text-[13px]">
              {error === 'NO_API_KEY'
                ? '尚未配置 API Key，请打开设置填写。'
                : error === 'NO_MODEL'
                  ? '尚未配置模型，请打开设置选择。'
                  : error}
              <button type="button" className="ml-2 underline" onClick={() => window.api.settings.open()}>打开设置</button>
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
    <div className="quick-shell">
      <header className="quick-titlebar" data-testid="window-drag-region" title="按住顶部拖动窗口"
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest('button, input, select, a, .nodrag')) return
          event.preventDefault()
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          window.api.quick.beginDrag({ x: event.screenX, y: event.screenY })
        }}>
        <div className="quick-brand"><Sparkles size={16} /><span>唤问</span></div>
        <span className="window-grip"><GripHorizontal size={18} /></span>
        <AssistantPicker config={config} onSelect={selectAssistant} />
        <button className="icon-button nodrag" aria-label="设置" title="打开设置" onClick={() => window.api.settings.open()}><Settings2 size={17} /></button>
      </header>
      <div className="quick-content">
      {configError && <div className="form-error" role="alert">{configError}</div>}
      <InputBar
        text={input}
        placeholder="输入问题或选择下方功能…"
        loading={isStreaming}
        onSubmit={() => { if (!isStreaming && requestText) { if (route === 'home') menusRef.current?.useFeature(); else handleSend(undefined, route === 'translate') } }}
        handleKeyDown={handleKeyDown}
        handleChange={(e) => setInput(e.target.value)}
      />
      <div className="quick-body">{body()}</div>
      </div>
      <Footer
        modelName={activeModel?.name}
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
