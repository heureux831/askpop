import { Copy, X } from 'lucide-react'
import type { FC } from 'react'

interface Props {
  clipboardText: string
  clearClipboard: () => void
}

const ClipboardPreview: FC<Props> = ({ clipboardText, clearClipboard }) => {
  if (!clipboardText) return null
  return (
    <div className="mb-2.5 rounded-lg bg-muted p-3">
      <div className="flex w-full items-center text-muted-foreground">
        <Copy className="nodrag size-3.5 shrink-0 cursor-pointer" />
        <p className="nodrag mx-3 min-w-0 flex-1 overflow-hidden text-xs [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {clipboardText}
        </p>
        <button
          type="button"
          onClick={clearClipboard}
          className="nodrag flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="关闭">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export default ClipboardPreview
