import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Brain } from 'lucide-react'
export default function ReasoningBox({ text, thinking }: { text: string; thinking: boolean }) {
  const [expanded, setExpanded] = useState(thinking)
  const scroll = useRef<HTMLDivElement>(null), follow = useRef(true)
  useEffect(() => { setExpanded(thinking) }, [thinking])
  useEffect(() => { if (scroll.current && follow.current) scroll.current.scrollTop = scroll.current.scrollHeight }, [text, expanded])
  return <section className={`reasoning-box ${expanded ? 'reasoning-expanded' : ''}`} aria-label="思考过程">
    <button type="button" className="reasoning-heading" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}><Brain size={13} /><span>{thinking ? '正在思考' : '思考过程'}</span>{thinking && <span className="reasoning-pulse" />}<ChevronDown size={13} /></button>
    {expanded && <div className="reasoning-content" ref={scroll} tabIndex={0} aria-label="思考内容" onScroll={() => { const el = scroll.current!; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24 }}>{text}</div>}
  </section>
}
