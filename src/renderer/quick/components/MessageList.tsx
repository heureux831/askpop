import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../useChatStream'

export default function MessageList({ messages, isStreaming }: { messages: ChatMessage[]; isStreaming: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  useEffect(() => {
    const el = scrollRef.current
    if (el && follow.current) el.scrollTop = el.scrollHeight
  }, [messages])
  return (
    <div ref={scrollRef} onScroll={() => {
      const el = scrollRef.current!
      follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    }} className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto pb-5">
      {messages.map((m) => (
        <div key={m.id} className={m.role === 'user'
          ? 'max-w-full self-end whitespace-pre-wrap break-words rounded-[10px] bg-muted px-4 py-2.5 text-sm'
          : 'markdown min-w-0 max-w-full self-start text-sm'}>
          {m.role === 'assistant'
            ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>{m.content || (isStreaming ? '…' : '')}</ReactMarkdown>
            : m.content}
        </div>
      ))}
    </div>
  )
}
