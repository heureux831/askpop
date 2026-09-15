import { useEffect, useState } from 'react'

import { useChatStream } from '../useChatStream'

const SYSTEM_TRANSLATE = '你是一个翻译助手。请把用户输入的内容翻译成中文，只输出译文，不要解释。'

export default function TranslateWindow({ text }: { text: string }) {
  const { messages, isStreaming, send, reset, stop } = useChatStream()
  const [lastText, setLastText] = useState('')

  useEffect(() => () => stop(), [stop])

  useEffect(() => {
    if (text.trim() && text !== lastText) {
      setLastText(text)
      reset()
      send(text, { system: SYSTEM_TRANSLATE })
    }
  }, [text, lastText, reset, send])

  const result = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-3">
      <div className="text-xs text-muted-foreground">翻译为中文</div>
      <div className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm">
        {result || (isStreaming ? '…' : '')}
      </div>
    </div>
  )
}
