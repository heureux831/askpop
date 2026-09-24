import { useState } from 'react'
import { ArrowUp, ArrowDown, Plus, Trash2, MessageSquare, Languages, FileText, Lightbulb } from 'lucide-react'
import type { PublicConfig } from '@shared/config'
import { DEFAULT_TASKS, type QuickTask } from '@shared/tasks'
import { Field, Feedback, type BaseProps } from './Editors'
const taskIcons = { chat: MessageSquare, translate: Languages, summary: FileText, explanation: Lightbulb }
export default function TasksEditor({ config, ...props }: BaseProps & { config: PublicConfig }) {
  const [tasks, setTasks] = useState<QuickTask[]>(config.tasks ?? DEFAULT_TASKS)
  const [selected, setSelected] = useState(tasks[0]?.id), [error, setError] = useState(''), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false)
  const task = tasks.find((t) => t.id === selected)
  const update = (next: QuickTask[]) => { setTasks(next); setSaved(false); props.onDirty() }
  const patch = (patch: Partial<QuickTask>) => update(tasks.map((t) => t.id === selected ? { ...t, ...patch } : t))
  const move = (index: number, offset: number) => { const next = [...tasks]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; update(next) }
  return <div className="workspace-columns">
    <section className="entity-list"><div className="entity-list-heading"><h1>快捷任务</h1><button className="add-button" aria-label="添加任务" disabled={tasks.length >= 30} onClick={() => { const id = crypto.randomUUID(); update([...tasks, { id, title: '新任务', description: '', prompt: '', icon: 'chat' }]); setSelected(id) }}><Plus size={17} /></button></div>
      <p className="task-list-hint">这里的顺序就是唤起窗口中的顺序。</p>
      <div className="entity-list-scroll">{tasks.map((t, i) => { const Icon = taskIcons[t.icon]; return <div className={`task-list-row ${selected === t.id ? 'entity-selected' : ''}`} key={t.id}><button onClick={() => setSelected(t.id)}><Icon size={16} /><strong>{t.title || '未命名任务'}</strong></button><div><button aria-label={`上移 ${t.title}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button><button aria-label={`下移 ${t.title}`} disabled={i === tasks.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button></div></div> })}</div>
      <div className="list-footnote">选中任务编辑，使用箭头调整顺序。</div>
    </section>
    <section className="entity-detail"><form className="detail-form tasks-detail" onSubmit={async (event) => { event.preventDefault(); setError(''); setSaving(true); try { props.onSaved(await window.api.tasks.save(tasks)); setSaved(true) } catch (e) { setError((e as Error).message) } finally { setSaving(false) } }}>
      <header className="detail-heading"><div><h2>编辑快捷任务</h2><p>同一个助手，也能切换不同的工作方式。</p></div></header>
      <div className="form-scroll">{task && <>
        <Field label="任务标题"><input aria-label="任务标题" required value={task.title} maxLength={40} onChange={(e) => patch({ title: e.target.value })} /></Field>
        <Field label="任务说明"><input aria-label="任务说明" value={task.description} maxLength={100} onChange={(e) => patch({ description: e.target.value })} placeholder="在唤起窗口中显示的一句话说明" /></Field>
        <Field label="任务图标"><select aria-label="任务图标" value={task.icon} onChange={(e) => patch({ icon: e.target.value as QuickTask['icon'] })}><option value="chat">对话</option><option value="translate">翻译</option><option value="summary">文档</option><option value="explanation">灵感</option></select></Field>
        <Field label="任务提示词" hint="追加在当前助手的 System Prompt 后面，每轮对话都生效。留空则只使用助手提示词。"><textarea aria-label="任务提示词" rows={7} value={task.prompt} onChange={(e) => patch({ prompt: e.target.value })} placeholder="例如：请将用户输入翻译为英文，只输出译文。" /></Field>
        <div className="prompt-composition"><span>助手 System Prompt</span><span>＋</span><strong>{task.title || '任务'}提示词</strong></div>
      </>}<Feedback error={error} saved={saved} /></div>
      <footer className="editor-actions"><button className="text-button danger" type="button" disabled={tasks.length <= 1} onClick={() => { const next = tasks.filter((t) => t.id !== selected); update(next); setSelected(next[0].id) }}><Trash2 size={14} />删除任务</button><button className="primary-button" disabled={saving}>保存任务</button></footer>
    </form></section>
  </div>
}
