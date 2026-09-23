import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Settings2, Sparkles } from 'lucide-react'
import type { PublicConfig } from '@shared/config'
import AssistantAvatar from '../../shared/AssistantAvatar'

export default function AssistantPicker({ config, onSelect }: { config: PublicConfig | null; onSelect(id: string): Promise<void> }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const active = config?.assistants?.find((a) => a.id === config.activeAssistantId)
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])
  return <div className="assistant-picker nodrag" ref={root} onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); root.current?.querySelector('button')?.focus() }
  }}>
    <button className="assistant-trigger" aria-label="选择助手" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}><AssistantAvatar icon={active?.icon} small /><span>{active?.name ?? '选择助手'}</span><ChevronDown size={12} /></button>
    {open && <div className="assistant-menu" role="menu" aria-label="助手列表">
      <div className="assistant-menu-label">切换助手，开始新对话</div>
      {config?.assistants?.map((assistant) => <button role="menuitemradio" aria-checked={assistant.id === config.activeAssistantId} disabled={busy} key={assistant.id} onClick={async () => { setBusy(true); try { await onSelect(assistant.id); setOpen(false) } finally { setBusy(false) } }}>
        <AssistantAvatar icon={assistant.icon} small /><span><strong>{assistant.name}</strong><small>{config.models?.find((m) => m.id === assistant.modelConfigId)?.name ?? '未选择模型'}</small></span>{assistant.id === config.activeAssistantId && <Check size={14} />}
      </button>)}
      {!config?.assistants?.length && <p className="picker-empty"><Sparkles size={16} />还没有助手</p>}
      <button className="manage-assistants" role="menuitem" onClick={() => { setOpen(false); window.api.settings.open() }}><Settings2 size={15} />管理助手</button>
    </div>}
  </div>
}
