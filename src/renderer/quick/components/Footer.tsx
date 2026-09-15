import { ArrowLeft, CircleArrowLeft, Copy, Loader2, Pin } from 'lucide-react'
import type { ButtonHTMLAttributes, FC } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Tooltip } from './ui'

interface Props {
  route: string
  canUseBackspace?: boolean
  loading?: boolean
  isPinned: boolean
  setIsPinned: (p: boolean) => void
  clearClipboard?: () => void
  onEsc: () => void
  onCopy?: () => void
}

const Footer: FC<Props> = ({ route, canUseBackspace, loading, clearClipboard, onEsc, isPinned, setIsPinned, onCopy }) => {
  useHotkeys('esc', () => onEsc())
  useHotkeys('c', () => { if (!loading && onCopy) onCopy() })

  const escLabel = loading ? 'Esc 暂停' : route === 'home' ? 'Esc 关闭' : 'Esc 返回'

  return (
    <div className="flex flex-row justify-between py-1.5 text-xs text-muted-foreground">
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <FooterAction onClick={onEsc}>
          {loading ? <Loader2 size={12} className="animate-spin text-error" /> : <CircleArrowLeft size={14} />}
          {escLabel}
        </FooterAction>
        {route === 'home' && !canUseBackspace && (
          <FooterAction onClick={() => clearClipboard?.()}>
            <ArrowLeft size={14} />
            Backspace 清除
          </FooterAction>
        )}
        {route !== 'home' && !loading && (
          <FooterAction onClick={() => onCopy?.()}>
            <Copy size={14} />
            复制
          </FooterAction>
        )}
      </div>
      <button type="button" onClick={() => setIsPinned(!isPinned)} className="mr-1 flex items-center" aria-pressed={isPinned} aria-label="固定">
        <Tooltip content="固定">
          <Pin size={14} className={isPinned ? 'rotate-[40deg] text-primary transition-transform' : 'transition-transform'} />
        </Tooltip>
      </button>
    </div>
  )
}

const FooterAction: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, ...props }) => (
  <button
    type="button"
    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className ?? ''}`}
    {...props}
  />
)

export default Footer
