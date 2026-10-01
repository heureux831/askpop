import { useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, X, KeyRound } from 'lucide-react'
import { PROVIDER_PRESETS, providerNeedsKey, type ProviderInput, type PublicProvider } from '@shared/providers'
import type { ModelInput, PublicModel, ProviderId } from '@shared/config'
import ProviderLogo from '../shared/ProviderLogo'
import { Field, Feedback, type BaseProps } from './Editors'

export default function ProviderEditor({ provider, models, ...props }: BaseProps & { provider?: PublicProvider; models: PublicModel[] }) {
  const [form, setForm] = useState<ProviderInput>(provider ? { ...provider, apiKey: '' } : { presetId: 'custom', name: '', baseURL: '', protocol: 'openai', apiKey: '' })
  const [dirty, setDirty] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<PublicModel | 'new' | null>(null), [deleting, setDeleting] = useState<PublicModel | null>(null)
  const update = (patch: Partial<ProviderInput>) => { setForm((v) => ({ ...v, ...patch })); setDirty(true); setSaved(false); props.onDirty() }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      const cfg = await window.api.providers.save(form)
      setForm((v) => ({ ...v, apiKey: '' })); setDirty(false); setSaved(true)
      props.onSaved(cfg, provider?.id ?? cfg.providers?.at(-1)?.id)
    } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }
  return <div className="detail-form provider-detail">
    <header className="detail-heading"><div className="provider-heading"><ProviderLogo presetId={form.presetId} size={32} /><div><h2>{provider ? provider.name : '添加服务商'}</h2><p>一个连接，管理多个模型。</p></div></div><span className={`connection-status ${provider && (provider.hasApiKey || !providerNeedsKey(provider)) ? 'is-ready' : ''}`}><span />{provider && !providerNeedsKey(provider) ? '本机连接' : provider?.hasApiKey ? '已配置' : '待配置'}</span></header>
    <div className="form-scroll">
      <form id="provider-form" onSubmit={submit}>
        {!provider && <Field label="服务商预设"><select aria-label="服务商预设" value={form.presetId} onChange={(e) => { const p = PROVIDER_PRESETS.find((p) => p.id === e.target.value)!; update({ presetId: p.id, name: p.id === 'custom' ? '' : p.name, baseURL: p.baseURL, protocol: p.protocol }) }}>{PROVIDER_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <div className="field-pair"><Field label="服务商名称"><input aria-label="服务商名称" value={form.name} onChange={(e) => update({ name: e.target.value })} maxLength={80} required /></Field><Field label="接口类型"><select aria-label="接口类型" value={form.protocol} onChange={(e) => update({ protocol: e.target.value as ProviderInput['protocol'] })}><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic</option></select></Field></div>
        <Field label="API 地址"><input aria-label="API 地址" className="mono-input" type="url" value={form.baseURL} onChange={(e) => update({ baseURL: e.target.value })} placeholder="https://api.example.com/v1" required /></Field>
        <Field label="API Key" hint={provider?.hasApiKey ? '留空保留已保存的 Key，此服务商下的模型共享使用。' : form.presetId === 'ollama' ? '本机 Ollama 无需 Key。' : '仅在本机保存，此服务商下的模型共享使用。'}><div className="secret-input"><KeyRound size={15} /><input aria-label="API Key" type="password" autoComplete="new-password" value={form.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder={provider?.hasApiKey ? '••••••••  已保存' : '输入 API Key'} /></div></Field>
      </form>
      <Feedback error={error} saved={saved} />
      <div className="models-heading"><div><h3>模型</h3><p>API ID 用于请求，显示名称用于选择。</p></div><button className="secondary-button" disabled={!provider || dirty} type="button" onClick={() => setEditing('new')}><Plus size={14} />添加模型</button></div>
      {(!provider || dirty) && <p className="field-hint">先保存服务商，再管理下方模型。</p>}
      {models.length ? <div className="model-table"><div className="model-table-head"><span>显示名称 / API ID</span><span>温度</span><span /></div>{models.map((m) => <div className="model-table-row" key={m.id}><div><strong>{m.name}</strong><code>{m.modelId}</code></div><span className="temperature-value">{m.temperature ?? '默认'}</span><div className="model-row-actions"><button type="button" aria-label={`编辑模型 ${m.name}`} disabled={dirty} onClick={() => setEditing(m)}><Pencil size={14} /></button><button type="button" aria-label={`删除模型 ${m.name}`} disabled={dirty} onClick={() => setDeleting(m)}><Trash2 size={14} /></button></div></div>)}</div> : <div className="models-empty">还没有模型。添加服务商提供的 API 模型 ID 即可开始。</div>}
    </div>
    <footer className="editor-actions">{provider && <button className="text-button danger" type="button" onClick={props.onDelete}><Trash2 size={14} />删除服务商</button>}<button className="primary-button" type="submit" form="provider-form" disabled={saving}>{saving ? '正在保存…' : '保存服务商'}</button></footer>
    {editing && provider && <ModelDialog provider={provider} model={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(cfg) => { props.onSaved(cfg); setEditing(null) }} />}
    {deleting && <div className="modal-backdrop"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-label="删除模型"><h2>删除模型？</h2><p>{deleting.name}</p><div><button className="secondary-button" onClick={() => setDeleting(null)}>取消</button><button className="danger-button" disabled={saving} onClick={async () => { setSaving(true); setError(''); try { props.onSaved(await window.api.models.delete(deleting.id)) } catch (e) { setError((e as Error).message) } finally { setDeleting(null); setSaving(false) } }}>确认删除</button></div></div></div>}
  </div>
}

function ModelDialog({ provider, model, onClose, onSaved }: { provider: PublicProvider; model?: PublicModel; onClose(): void; onSaved: BaseProps['onSaved'] }) {
  const [modelId, setModelId] = useState(model?.modelId ?? ''), [name, setName] = useState(model?.name ?? ''), [temperature, setTemperature] = useState(model?.temperature?.toString() ?? '')
  const [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const [customName, setCustomName] = useState(Boolean(model && model.name !== model.modelId))
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    const providerId: ProviderId = ['openai', 'anthropic', 'deepseek'].includes(provider.presetId) ? provider.presetId as ProviderId : 'custom'
    const input: ModelInput = { ...model, providerConfigId: provider.id, providerId, baseURL: provider.baseURL, name: name.trim() || modelId.trim(), modelId, temperature: temperature === '' ? undefined : Number(temperature), ...(model && modelId.trim() !== model.modelId ? { presetId: undefined, thinking: undefined, thinkingEffort: undefined, thinkingBudget: undefined } : {}) }
    try { onSaved(await window.api.models.save(input)) } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="model-dialog" role="dialog" aria-modal="true" aria-labelledby="model-dialog-title" onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
    <header><div><h2 id="model-dialog-title">{model ? '编辑模型' : '添加模型'}</h2><p>{provider.name}</p></div><button className="icon-button" type="button" aria-label="关闭模型编辑" onClick={onClose}><X size={17} /></button></header>
    <Field label="API 模型 ID" hint="填写服务商接受的准确模型 ID。"><input aria-label="API 模型 ID" className="mono-input" autoFocus required value={modelId} onChange={(e) => { setModelId(e.target.value); if (!customName) setName(e.target.value) }} placeholder="例如：deepseek-flash" /></Field>
    <Field label="显示名称" hint="默认与 API ID 相同，可改为容易辨认的名字。"><input aria-label="显示名称" value={name} onChange={(e) => { setName(e.target.value); setCustomName(e.target.value !== modelId && e.target.value !== '') }} placeholder={modelId || '默认与 API ID 相同'} maxLength={100} /></Field>
    <Field label="温度" hint={`留空使用服务商默认值。范围 0～${provider.protocol === 'anthropic' ? 1 : 2}，部分推理模型不支持或会忽略温度。`}><input aria-label="温度" type="number" min={0} max={provider.protocol === 'anthropic' ? 1 : 2} step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="服务商默认" /></Field>
    <Feedback error={error} saved={false} /><footer><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving}>保存模型</button></footer>
  </form></div>
}
