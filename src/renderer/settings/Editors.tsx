import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, ChevronDown, KeyRound, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { PROVIDERS, type AssistantConfig, type AssistantInput, type ModelInput, type PublicModel, type PublicConfig, type Theme } from '@shared/config'
import AssistantAvatar from '../shared/AssistantAvatar'
import { formatAccelerator } from './accelerator'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="form-field"><label><span className="field-label field-label-block">{label}</span>{children}</label>{hint && <span className="field-hint">{hint}</span>}</div>
}
function Feedback({ error, saved }: { error: string; saved: boolean }) {
  return <>{error && <p className="form-error" role="alert">{error}</p>}{saved && <p className="save-feedback" role="status"><Check size={14} /> 更改已保存</p>}</>
}
interface BaseProps { onDirty(): void; onSaved(config: PublicConfig, id?: string): void; onDelete?(): void }

export function ModelEditor({ model, ...props }: BaseProps & { model?: PublicModel }) {
  const [form, setForm] = useState<ModelInput>(model ? { id: model.id, name: model.name, providerId: model.providerId, modelId: model.modelId, baseURL: model.baseURL, apiKey: '' } : { name: '', providerId: 'openai', modelId: 'gpt-4o', baseURL: 'https://api.openai.com/v1', apiKey: '' })
  const [error, setError] = useState(''), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false)
  const update = (patch: Partial<ModelInput>) => { setForm((v) => ({ ...v, ...patch })); setSaved(false); props.onDirty() }
  const provider = PROVIDERS.find((p) => p.id === form.providerId)!
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      const config = await window.api.models.save(form)
      setForm((v) => ({ ...v, apiKey: '' })); setSaved(true)
      props.onSaved(config, form.id ?? config.models?.at(-1)?.id)
    } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }
  return <form className="detail-form" onSubmit={submit}>
    <header className="detail-heading"><div><h2>{model ? '编辑模型' : '连接一个模型'}</h2><p>配置一次，即可供多个助手使用。</p></div><span className={`connection-status ${model?.hasApiKey ? 'is-ready' : ''}`}><span />{model?.hasApiKey ? '已配置' : '待配置'}</span></header>
    <div className="form-scroll">
      <Field label="配置名称" hint="给这个连接起一个容易辨认的名字。"><input aria-label="配置名称" autoFocus value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="例如：DeepSeek 日常" maxLength={80} required /></Field>
      <div className="form-divider" />
      <Field label="供应商"><div className="select-wrap"><select aria-label="供应商" value={form.providerId} onChange={(e) => { const provider = PROVIDERS.find((p) => p.id === e.target.value)!; update({ providerId: provider.id, modelId: provider.defaultModel, baseURL: provider.defaultBaseURL, apiKey: '' }) }}>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select><ChevronDown size={14} /></div></Field>
      <Field label="模型 ID" hint="填写服务商提供的准确模型名称，也可选择预设。"><input aria-label="模型 ID" value={form.modelId} onChange={(e) => update({ modelId: e.target.value })} list="model-presets" placeholder="例如：deepseek-chat" className="mono-input" required /><datalist id="model-presets">{provider.models.map((id) => <option key={id} value={id} />)}</datalist></Field>
      <Field label="API 地址" hint="支持官方接口和兼容接口，通常以 /v1 结尾。"><input aria-label="API 地址" type="url" value={form.baseURL} onChange={(e) => update({ baseURL: e.target.value })} placeholder="https://api.example.com/v1" className="mono-input" required /></Field>
      <Field label="API Key" hint={model?.hasApiKey ? '已安全保存。留空保留当前 Key。' : '仅在本机加密保存，不会显示已保存的 Key。'}><div className="secret-input"><KeyRound size={15} /><input aria-label="API Key" type="password" autoComplete="new-password" value={form.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder={model?.hasApiKey ? '••••••••  已保存' : '输入 API Key'} required={!model?.hasApiKey} /></div></Field>
      <Feedback error={error} saved={saved} />
    </div>
    <footer className="editor-actions">{model && <button type="button" className="text-button danger" onClick={props.onDelete}><Trash2 size={14} />删除模型</button>}<button className="primary-button" disabled={saving} type="submit">{saving ? '正在保存…' : '保存模型'}</button></footer>
  </form>
}

const templates = [
  { label: '日常问答', icon: 'spark', prompt: '你是一位可靠的日常助手。用简洁、清晰的中文回答问题；遇到不确定的信息请明确说明。' },
  { label: '代码搭档', icon: 'code', prompt: '你是一位经验丰富的软件工程师。先分析问题，再给出可执行的解决方案和必要代码。说明重要的假设与边界，回答保持简洁。' },
  { label: '写作润色', icon: 'pen', prompt: '你是一位中文编辑。保留原文的含义和语气，改善用词、结构与可读性。默认直接给出润色后的文本，不添加无关解释。' }
] as const

export function AssistantEditor({ assistant, models, ...props }: BaseProps & { assistant?: AssistantConfig; models: PublicModel[] }) {
  const [form, setForm] = useState<AssistantInput>(assistant ? { ...assistant } : { name: '', modelConfigId: models[0]?.id ?? '', systemPrompt: '', icon: 'spark' })
  const [error, setError] = useState(''), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false)
  const update = (patch: Partial<AssistantInput>) => { setForm((v) => ({ ...v, ...patch })); setSaved(false); props.onDirty() }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      const config = await window.api.assistants.save(form)
      setSaved(true); props.onSaved(config, form.id ?? config.assistants?.at(-1)?.id)
    } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }
  return <form className="detail-form" onSubmit={submit}>
    <header className="detail-heading"><div><h2>{assistant ? '编辑助手' : '创建你的助手'}</h2><p>为不同任务，设定不同的思考方式。</p></div><AssistantAvatar icon={form.icon} /></header>
    <div className="form-scroll">
      <Field label="助手名称"><input aria-label="助手名称" autoFocus value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="例如：代码搭档" maxLength={60} required /></Field>
      <div className="form-field"><span className="field-label">助手图标</span><div className="icon-options">{(['spark', 'code', 'pen', 'languages'] as const).map((icon, i) => <button type="button" key={icon} aria-label={['通用图标', '代码图标', '写作图标', '翻译图标'][i]} aria-pressed={form.icon === icon} onClick={() => update({ icon })}><AssistantAvatar icon={icon} /></button>)}</div></div>
      <Field label="使用模型" hint="模型的 API 配置在「模型管理」中维护。"><div className="select-wrap"><select aria-label="使用模型" value={form.modelConfigId} onChange={(e) => update({ modelConfigId: e.target.value })} required>{!models.length && <option value="">请先添加模型</option>}{models.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.modelId}{m.hasApiKey ? '' : '（待配置）'}</option>)}</select><ChevronDown size={14} /></div></Field>
      <div className="form-divider" />
      <Field label="系统提示词" hint="描述助手的角色、回答方式和约束。留空时使用模型的默认行为。"><textarea aria-label="系统提示词" rows={8} value={form.systemPrompt} onChange={(e) => update({ systemPrompt: e.target.value })} placeholder="你是一位…\n请使用…的方式回答。" /></Field>
      <div className="prompt-tools"><span>从模板开始</span><div>{templates.map((t) => <button type="button" key={t.icon} onClick={() => update({ systemPrompt: t.prompt, icon: t.icon })}>{t.label}</button>)}</div></div>
      <Feedback error={error} saved={saved} />
    </div>
    <footer className="editor-actions">{assistant && <button type="button" className="text-button danger" onClick={props.onDelete}><Trash2 size={14} />删除助手</button>}<button className="primary-button" type="submit" disabled={saving || !models.length}>{saving ? '正在保存…' : '保存助手'}</button></footer>
  </form>
}

export function GeneralEditor({ config, ...props }: BaseProps & { config: PublicConfig }) {
  const [hotkey, setHotkey] = useState(config.hotkey), [theme, setTheme] = useState<Theme>(config.theme ?? 'system')
  const [capturing, setCapturing] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false)
  return <form className="detail-form general-form" onSubmit={async (event) => {
    event.preventDefault(); setError(''); setSaving(true)
    try { await window.api.config.set({ hotkey, theme }); props.onSaved(await window.api.config.get()); setSaved(true) } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }}>
    <header className="detail-heading"><div><h2>让助手融入你的习惯</h2><p>随时唤起，保持专注。</p></div></header>
    <div className="form-scroll">
      <Field label="全局快捷键" hint="点击后按下组合键。按 Esc 取消录入。"><button type="button" aria-label="全局快捷键" className={`hotkey-input ${capturing ? 'is-capturing' : ''}`} onClick={() => setCapturing(true)} onBlur={() => setCapturing(false)} onKeyDown={(event) => {
        if (!capturing) return
        event.preventDefault()
        if (event.key === 'Escape') { setCapturing(false); return }
        const key = formatAccelerator(event)
        if (key) { setHotkey(key); setCapturing(false); setSaved(false); props.onDirty() }
      }}>{capturing ? '请按下组合键…' : hotkey.replace('CommandOrControl', '⌘').replace('Command', '⌘').replace('Shift', '⇧').replace('Control', '⌃').replace('Alt', '⌥').replaceAll('+', '  ')}</button></Field>
      <div className="form-divider" />
      <div className="form-field"><span className="field-label">外观</span><div className="theme-options">{([{ id: 'system', label: '跟随系统', Icon: Monitor }, { id: 'light', label: '浅色', Icon: Sun }, { id: 'dark', label: '深色', Icon: Moon }] as const).map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={theme === id} onClick={() => { setTheme(id); setSaved(false); props.onDirty() }}><Icon size={21} /><span>{label}</span>{theme === id && <Check size={12} />}</button>)}</div></div>
      <Feedback error={error} saved={saved} />
    </div>
    <footer className="editor-actions"><button className="primary-button" disabled={saving} type="submit">{saving ? '正在保存…' : '保存设置'}</button></footer>
  </form>
}
