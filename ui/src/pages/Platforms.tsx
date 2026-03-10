import { useEffect, useState } from 'react'
import { Cpu, Plus, Trash2, CheckCircle2, XCircle, ChevronUp, X } from 'lucide-react'
import { api } from '../api/client'
import type { Platform, PlatformCreate, ProviderType } from '../types'
import GlassCard from '../components/GlassCard'

const PROVIDERS: { value: ProviderType; label: string; hint: string; color: string }[] = [
  { value: 'openai',    label: 'OpenAI',    hint: 'sk-...',         color: 'from-emerald-600 to-teal-600' },
  { value: 'anthropic', label: 'Anthropic', hint: 'sk-ant-...',     color: 'from-amber-600 to-orange-600' },
  { value: 'azure',     label: 'Azure AI',  hint: 'Azure API key',  color: 'from-blue-600 to-cyan-600' },
  { value: 'google',    label: 'Google AI', hint: 'AIza...',        color: 'from-red-600 to-pink-600' },
  { value: 'custom',    label: 'Custom',    hint: 'API key',        color: 'from-violet-600 to-purple-600' },
]

const colorMap = Object.fromEntries(PROVIDERS.map(p => [p.value, p.color]))

export default function Platforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<PlatformCreate>({ name: '', provider: 'openai', api_key: '' })

  useEffect(() => { api.getPlatforms().then(p => { setPlatforms(p); setLoading(false) }) }, [])

  function setF<K extends keyof PlatformCreate>(k: K, v: PlatformCreate[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleAdd() {
    if (!form.name || !form.api_key) { setError('Name and API key are required'); return }
    setSaving(true); setError('')
    try {
      const p = await api.createPlatform(form)
      setPlatforms(prev => [...prev, p])
      setForm({ name: '', provider: 'openai', api_key: '' })
      setShowForm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add platform')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this platform?')) return
    await api.deletePlatform(id)
    setPlatforms(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Platforms</h1>
          <p className="page-subtitle">Manage your AI provider connections</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          {showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Add Platform'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-white mb-5">Connect a new platform</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Platform Name</label>
              <input className="input" placeholder="My OpenAI Account" value={form.name} onChange={e => setF('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Provider</label>
              <select className="input" value={form.provider} onChange={e => setF('provider', e.target.value as ProviderType)}>
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">API Key</label>
              <input className="input font-mono" type="password" placeholder={PROVIDERS.find(p => p.value === form.provider)?.hint ?? 'API key'} value={form.api_key} onChange={e => setF('api_key', e.target.value)} />
            </div>
            <div>
              <label className="label">Base URL (optional)</label>
              <input className="input" placeholder="https://api.openai.com/v1" value={form.base_url ?? ''} onChange={e => setF('base_url', e.target.value || undefined)} />
            </div>
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <XCircle size={13} /> {error}
              <button onClick={() => setError('')} className="ml-auto"><X size={11} /></button>
            </div>
          )}
          <div className="flex justify-end mt-5 pt-4 border-t border-white/8">
            <button onClick={handleAdd} disabled={saving} className="btn-primary">
              {saving ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={14} />}
              Connect Platform
            </button>
          </div>
        </GlassCard>
      )}

      {/* Platform grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : platforms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Cpu size={32} className="text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">No platforms connected</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4"><Plus size={14} /> Add your first platform</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {platforms.map(p => {
            const prov = PROVIDERS.find(x => x.value === p.provider)
            return (
              <GlassCard key={p.id} className="group" padding={false}>
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${colorMap[p.provider] ?? colorMap.custom} shadow-lg`}>
                      <Cpu size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{prov?.label ?? p.provider}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {p.is_connected
                        ? <CheckCircle2 size={14} className="text-emerald-400" />
                        : <XCircle size={14} className="text-red-400" />}
                      <span className={`text-xs ${p.is_connected ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.is_connected ? 'Connected' : 'Error'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {p.api_key_hint && (
                      <div className="flex justify-between text-slate-500">
                        <span>API Key</span>
                        <span className="font-mono text-slate-400">{p.api_key_hint}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500">
                      <span>Models</span>
                      <span className="text-slate-400">{p.models.length} available</span>
                    </div>
                  </div>

                  {p.models.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.models.slice(0, 3).map(m => (
                        <span key={m} className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/5 text-slate-500 border border-white/8">{m}</span>
                      ))}
                      {p.models.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-600">+{p.models.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end px-5 py-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
