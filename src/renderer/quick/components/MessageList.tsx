import type { FC } from 'react'

import type { ChatMessage } from '../useChatStream'

interface Props {
  messages: ChatMessage[]
  isStreaming: boolean
}

const MessageList: FC<Props> = ({ messages, isStreaming }) => {
  return (
    <div className="flex w-full flex-col gap-3 overflow-y-auto pb-5">
      {messages.map((m) => (
        <div
          key={m.id}
          className={m.role === 'user' ? 'self-end rounded-[10px] bg-muted px-4 py-2.5 text-sm' : 'self-start whitespace-pre-wrap text-sm'}
        >
          {m.content || (m.role === 'assistant' && isStreaming ? '…' : '')}
        </div>
      ))}
    </div>
  )
}

export default MessageList
