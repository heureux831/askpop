import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const activeRequest = useRef<string | null>(null)
  const idRef = useRef(0)

  useEffect(() => {
    const offChunk = window.api.chat.onChunk((text, requestId) => {
      if (!activeRequest.current || requestId !== activeRequest.current) return
      const last = messagesRef.current.at(-1)
      if (!last || last.role !== 'assistant') return
      messagesRef.current = messagesRef.current.map((m) => m.id === last.id ? { ...m, content: m.content + text } : m)
      setMessages(messagesRef.current)
    })
    const offReasoning = window.api.chat.onReasoning((text, requestId) => {
      if (!activeRequest.current || requestId !== activeRequest.current) return
      const last = messagesRef.current.at(-1)
      if (!last || last.role !== 'assistant') return
      messagesRef.current = messagesRef.current.map((m) => m.id === last.id ? { ...m, reasoning: (m.reasoning ?? '') + text } : m)
      setMessages(messagesRef.current)
    })
    const finish = (requestId: string) => {
      if (requestId !== activeRequest.current) return false
      activeRequest.current = null
      setIsStreaming(false)
      return true
    }
    const offDone = window.api.chat.onDone(finish)
    const offError = window.api.chat.onError((message, requestId) => {
      if (finish(requestId)) setError(message)
    })
    return () => {
      activeRequest.current = null
      window.api.chat.abort()
      offChunk()
      offReasoning()
      offDone()
      offError()
    }
  }, [])

  const send = useCallback((text: string, opts?: { system?: string; replace?: boolean; assistantId?: string; taskId?: string }) => {
    const requestId = `request-${idRef.current++}`
    activeRequest.current = requestId
    const userMsg: ChatMessage = { id: `u${idRef.current++}`, role: 'user', content: text }
    const assistantMsg: ChatMessage = { id: `a${idRef.current++}`, role: 'assistant', content: '' }
    const history = [...(opts?.replace ? [] : messagesRef.current.filter((m) => m.content)), userMsg]
    messagesRef.current = [...history, assistantMsg]
    setMessages(messagesRef.current)
    setIsStreaming(true)
    setError(null)
    window.api.chat.stream({
      requestId,
      assistantId: opts?.assistantId,
      taskId: opts?.taskId,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      system: opts?.system
    })
  }, [])

  const stop = useCallback(() => {
    activeRequest.current = null
    window.api.chat.abort()
    setIsStreaming(false)
  }, [])
  const reset = useCallback(() => {
    stop()
    messagesRef.current = []
    setMessages([])
    setError(null)
  }, [stop])

  return { messages, isStreaming, error, send, stop, reset }
}
