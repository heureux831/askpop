import { CornerDownLeft, FileText, Languages, Lightbulb, MessageSquare } from 'lucide-react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import type { QuickTask } from '@shared/tasks'
import { Scrollbar } from './ui'
export type MiniRoute = 'home' | 'chat'
interface Props { text: string; tasks: QuickTask[]; onChoose(task: QuickTask): void }
export interface FeatureMenusRef { nextFeature(): void; prevFeature(): void; useFeature(): void; resetSelectedIndex(): void }
const icons = { chat: MessageSquare, translate: Languages, summary: FileText, explanation: Lightbulb }
const FeatureMenus = forwardRef<FeatureMenusRef, Props>(({ text, tasks, onChoose }, ref) => {
  const [selected, setSelected] = useState(0)
  const selectedIndex = Math.min(selected, Math.max(0, tasks.length - 1))
  const choose = (task?: QuickTask) => { if (text && task) onChoose(task) }
  useImperativeHandle(ref, () => ({
    nextFeature: () => setSelected((p) => tasks.length ? (p + 1) % tasks.length : 0),
    prevFeature: () => setSelected((p) => tasks.length ? (p + tasks.length - 1) % tasks.length : 0),
    useFeature: () => choose(tasks[selectedIndex]), resetSelectedIndex: () => setSelected(0)
  }), [tasks, selectedIndex, text, onChoose])
  return <Scrollbar className="h-auto shrink-0"><div className="feature-list">{tasks.map((task, index) => {
    const Icon = icons[task.icon] ?? MessageSquare
    return <button type="button" key={task.id} aria-label={task.title} onMouseEnter={() => setSelected(index)} onClick={() => choose(task)} className={`flex w-full cursor-pointer flex-row items-center gap-3 rounded-lg border-0 bg-transparent px-4 py-2 text-left transition-colors select-none hover:bg-accent ${index === selectedIndex ? 'bg-accent' : ''}`}><Icon className="size-4" /><span className="feature-text"><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</span>{index === selectedIndex && <CornerDownLeft className="size-4 text-muted-foreground" />}</button>
  })}</div></Scrollbar>
})
FeatureMenus.displayName = 'FeatureMenus'
export default FeatureMenus
