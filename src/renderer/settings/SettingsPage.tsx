import { useEffect, useState } from 'react'
import { Boxes, ChevronRight, Plus, Search, Settings2, Sparkles, Users, X, ListOrdered } from 'lucide-react'
import { type PublicConfig } from '@shared/config'
import AssistantAvatar from '../shared/AssistantAvatar'
import { AssistantEditor, GeneralEditor } from './Editors'

import ProviderEditor from './ProviderEditor'
import TasksEditor from './TasksEditor'
import ProviderLogo from '../shared/ProviderLogo'

type Section = 'assistants' | 'models' | 'tasks' | 'general'
export default function SettingsPage() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [section, setSection] = useState<Section>('assistants'), [selected, setSelected] = useState('')
  const [search, setSearch] = useState(''), [dirty, setDirty] = useState(false), [error, setError] = useState('')
  const [pending, setPending] = useState<(() => void) | null>(null), [deleting, setDeleting] = useState(false), [busy, setBusy] = useState(false)
  useEffect(() => { void window.api.config.get().then((cfg) => { setConfig(cfg); setSection(cfg.hasApiKey ? 'assistants' : 'models'); setSelected(cfg.hasApiKey ? cfg.activeAssistantId ?? '' : cfg.providers?.[0]?.id ?? '') }).catch((error) => setError(String(error))) }, [])
  useEffect(() => window.api.config.onChanged(setConfig), [])
  const navigate = (action: () => void) => { if (dirty) setPending(() => action); else action() }
  const choose = (id: string) => navigate(() => { setSelected(id); setDirty(false); setError('') })
  const changeSection = (next: Section) => navigate(() => { setSection(next); setSelected(next === 'assistants' ? config?.activeAssistantId ?? '' : config?.providers?.[0]?.id ?? ''); setSearch(''); setDirty(false); setError('') })
  const providers = config?.providers ?? [], models = config?.models ?? [], assistants = config?.assistants ?? []
  const assistant = assistants.find((a) => a.id === selected), provider = providers.find((m) => m.id === selected)
  const onSaved = (cfg: PublicConfig, id?: string) => { setConfig(cfg); setDirty(false); if (id) setSelected(id) }
  const remove = async () => {
    setBusy(true)
    try {
      const cfg = section === 'models' ? await window.api.providers.delete(selected) : await window.api.assistants.delete(selected)
      setConfig(cfg); setSelected(section === 'models' ? cfg.providers?.[0]?.id ?? '' : cfg.assistants?.[0]?.id ?? ''); setDirty(false); setDeleting(false); setError('')
    } catch (error) { setError((error as Error).message); setDeleting(false) } finally { setBusy(false) }
  }
  const items = (section === 'models' ? providers : assistants).filter((item) => `${item.name} ${'baseURL' in item ? item.baseURL : item.systemPrompt}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="settings-shell">
    <aside className="settings-sidebar">
      <div className="sidebar-traffic-space" />
      <div className="workspace-brand"><span className="brand-symbol"><Sparkles size={19} /></span><div>唤问<small>你的随身工作台</small></div></div>
      <nav aria-label="设置导航">{([{ id: 'assistants', label: '助手管理', Icon: Users }, { id: 'models', label: '模型服务', Icon: Boxes }, { id: 'tasks', label: '快捷任务', Icon: ListOrdered }, { id: 'general', label: '通用设置', Icon: Settings2 }] as const).map(({ id, label, Icon }) => <button key={id} className={section === id ? 'nav-active' : ''} onClick={() => changeSection(id)}><Icon size={17} /><span>{label}</span>{id !== 'general' && <small>{id === 'models' ? providers.length : id === 'tasks' ? config?.tasks?.length ?? 4 : assistants.length}</small>}</button>)}</nav>
      <div className="sidebar-note"><span className="local-dot" /> 配置保存在本机<small>随时唤起，专注当下。</small></div>
    </aside>
    <div className="settings-main">
      <header className="settings-topbar"><span>设置</span><ChevronRight size={13} /><strong>{section === 'models' ? '模型服务' : section === 'assistants' ? '助手管理' : section === 'tasks' ? '快捷任务' : '通用设置'}</strong>{dirty && <span className="unsaved-dot">未保存</span>}</header>
      {error && <div className="workspace-error" role="alert">{error}<button aria-label="关闭错误" onClick={() => setError('')}><X size={14} /></button></div>}
      {!config ? <div className="empty-state">正在读取配置…</div> : section === 'general' ? <GeneralEditor key="general" config={config} onDirty={() => setDirty(true)} onSaved={onSaved} /> : section === 'tasks' ? <TasksEditor key="tasks" config={config} onDirty={() => setDirty(true)} onSaved={onSaved} /> : <div className="workspace-columns">
        <section className="entity-list">
          <div className="entity-list-heading"><h1>{section === 'models' ? '服务商' : '我的助手'}</h1><button className="add-button" aria-label={section === 'models' ? '添加服务商' : '创建助手'} onClick={() => choose('new')}><Plus size={17} /></button></div>
          <div className="search-field"><Search size={14} /><input aria-label={section === 'models' ? '搜索服务商' : '搜索助手'} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={section === 'models' ? '搜索服务商…' : '搜索助手…'} /></div>
          <div className="entity-list-scroll">{items.map((item) => <button className={`entity-row ${selected === item.id ? 'entity-selected' : ''}`} key={item.id} onClick={() => choose(item.id)}>
            {'icon' in item ? <AssistantAvatar icon={item.icon} /> : <ProviderLogo presetId={item.presetId} />}
            <span className="entity-text"><strong>{item.name}</strong><small>{'baseURL' in item ? `${models.filter((m) => m.providerConfigId === item.id).length} 个模型` : models.find((m) => m.id === item.modelConfigId)?.name ?? '未选择模型'}</small></span>
            {'hasApiKey' in item ? <span className={`entity-dot ${item.hasApiKey ? 'ready' : ''}`} title={item.hasApiKey ? '已配置 Key' : '待配置 Key'} /> : config.activeAssistantId === item.id && <span className="current-badge">当前</span>}
          </button>)}{items.length === 0 && <p className="list-empty">{search ? '没有匹配的结果' : section === 'models' ? '添加一个服务商连接你的模型。' : '还没有助手，点击 + 创建。'}</p>}</div>
          <div className="list-footnote">{section === 'models' ? '服务商统一管理地址和 Key。' : '不同任务，不同的专属助手。'}</div>
        </section>
        <section className="entity-detail">{selected === 'new' || (section === 'models' ? provider : assistant)
          ? section === 'models'
            ? <ProviderEditor key={`provider-${selected}`} provider={provider} models={models.filter((m) => m.providerConfigId === selected)} onDirty={() => setDirty(true)} onSaved={onSaved} onDelete={() => setDeleting(true)} />
            : <AssistantEditor key={`assistant-${selected}`} assistant={assistant} models={models} providers={providers} onDirty={() => setDirty(true)} onSaved={onSaved} onDelete={() => setDeleting(true)} />
          : <div className="empty-state"><Sparkles size={28} /><h2>{section === 'models' ? '连接你的服务商' : '每项工作，都有合适的助手'}</h2><p>{section === 'models' ? '填入 API 配置，让助手开始工作。' : '选择一个模型，再告诉它应该怎样帮助你。'}</p><button className="primary-button" onClick={() => choose('new')}>{section === 'models' ? '添加服务商' : '创建助手'}</button></div>}</section>
      </div>}
    </div>
    {(pending || deleting) && <div className="modal-backdrop"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{deleting ? `删除${section === 'models' ? '服务商' : '助手'}？` : '有尚未保存的更改'}</h2><p>{deleting ? `“${provider?.name ?? assistant?.name}”将从列表中移除。` : '继续切换会放弃本次编辑。'}</p><div><button className="secondary-button" autoFocus onClick={() => { setPending(null); setDeleting(false) }}>返回编辑</button><button className={deleting ? 'danger-button' : 'primary-button'} disabled={busy} onClick={() => { if (deleting) void remove(); else { pending?.(); setPending(null) } }}>{deleting ? '确认删除' : '放弃更改'}</button></div></div></div>}
  </div>
}
