import { useEffect, useState } from 'react'

import { PROVIDERS, type ProviderId } from '@shared/config'

import { validate, type FormValues } from './validation'

export default function SettingsPage() {
  const [form, setForm] = useState<FormValues>({ providerId: 'openai', baseURL: '', modelId: '', apiKey: '' })
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+Space')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  useEffect(() => {
    void window.api.config.get().then((cfg) => {
      setForm((f) => ({ ...f, providerId: cfg.providerId, baseURL: cfg.baseURL, modelId: cfg.modelId, apiKey: '' }))
      setHotkey(cfg.hotkey)
      setHasApiKey(cfg.hasApiKey)
    })
  }, [])

  const provider = PROVIDERS.find((p) => p.id === form.providerId) ?? PROVIDERS[0]

  const save = async () => {
    const errs = validate(form, hasApiKey)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    await window.api.config.set({
      providerId: form.providerId,
      baseURL: form.providerId === 'custom' ? form.baseURL : '',
      modelId: form.modelId,
      hotkey
    })
    if (form.apiKey.trim()) await window.api.config.setKey(form.apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold">快捷助手设置</h1>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          供应商
          <select
            value={form.providerId}
            onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value as ProviderId }))}
            className="rounded border border-input bg-background px-3 py-2">
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {form.providerId === 'custom' && (
          <label className="flex flex-col gap-1 text-sm">
            Base URL
            <input
              value={form.baseURL}
              onChange={(e) => setForm((f) => ({ ...f, baseURL: e.target.value }))}
              placeholder="https://api.example.com/v1"
              className="rounded border border-input bg-background px-3 py-2"
            />
            {errors.baseURL && <span className="text-xs text-error">{errors.baseURL}</span>}
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          模型 ID
          <input
            value={form.modelId}
            onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
            placeholder={provider.defaultModel || '手动输入 model ID'}
            className="rounded border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          API Key
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder="留空表示不修改"
            className="rounded border border-input bg-background px-3 py-2"
          />
          {errors.apiKey && <span className="text-xs text-error">{errors.apiKey}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          全局快捷键
          <input value={hotkey} onChange={(e) => setHotkey(e.target.value)} className="rounded border border-input bg-background px-3 py-2" />
        </label>

        <button type="button" onClick={save} className="rounded bg-primary px-4 py-2 text-primary-foreground">
          {saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  )
}
