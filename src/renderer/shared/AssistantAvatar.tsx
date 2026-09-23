import { Code2, Feather, Languages, Sparkles } from 'lucide-react'
import type { AssistantConfig } from '@shared/config'
export default function AssistantAvatar({ icon = 'spark', small = false }: { icon?: AssistantConfig['icon']; small?: boolean }) {
  const Icon = { spark: Sparkles, code: Code2, pen: Feather, languages: Languages }[icon]
  return <span className={`assistant-avatar avatar-${icon} ${small ? 'avatar-small' : ''}`}><Icon size={small ? 14 : 20} strokeWidth={1.8} /></span>
}
