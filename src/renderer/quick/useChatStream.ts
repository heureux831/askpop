import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const offChunk = window.api.chat.onChunk((text) => {
      const assistantId = messagesRef.current[messagesRef.current.length - 1]?.id
      setMessages((m) =>
        m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + text } : msg))
      )
    })
    const offDone = window.api.chat.onDone(() => setIsStreaming(false))
    const offError = window.api.chat.onError((message) => {
      setError(message)
      setIsStreaming(false)
    })
    return () => {
      offChunk()
      offDone()
      offError()
    }
  }, [])

  const send = useCallback((text: string, opts?: { system?: string }) => {
    const userMsg: ChatMessage = { id: `u${idRef.current++}`, role: 'user', content: text }
    const assistantMsg: ChatMessage = { id: `a${idRef.current++}`, role: 'assistant', content: '' }
    const history = [...messagesRef.current, userMsg]
    setMessages((m) => [...m, userMsg, assistantMsg])
    setIsStreaming(true)
    setError(null)
    window.api.chat.stream({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      system: opts?.system
    })
  }, [])

  const stop = useCallback(() => {
    window.api.chat.abort()
    setIsStreaming(false)
  }, [])
  const reset = useCallback(() => {
    setMessages([])
    setIsStreaming(false)
    setError(null)
  }, [])

  return { messages, isStreaming, error, send, stop, reset }
}
