import { useEffect, useState } from 'react'
import {
  Plus, Wrench, Search, Trash2, Code2, FileText,
  ChevronDown, ChevronRight, Tag, Loader2, X, Check,
} from 'lucide-react'
import { api } from '../api/client'
import type { Skill, SkillCreate, SkillType } from '../types'
import GlassCard from '../components/GlassCard'

const LANGUAGES = ['python', 'javascript', 'bash', 'typescript', 'ruby', 'go']

const langColors: Record<string, string> = {
  python:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  javascript: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  typescript: 'bg-blue-400/15 text-blue-300 border-blue-400/20',
  bash:       'bg-slate-500/15 text-slate-400 border-slate-500/20',
  ruby:       'bg-red-500/15 text-red-400 border-red-500/20',
  go:         'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
}

function typeBadge(type: SkillType) {
  return type === 'script'
    ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
}

const DEFAULT_FORM: SkillCreate = {
  name: '', description: '', type: 'script',
  language: 'python', content: '', tags: [],
}

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SkillCreate>({ ...DEFAULT_FORM })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    api.getSkills().then(s => { setSkills(s); setLoading(false) })
  }, [])

  function toggle(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function set<K extends keyof SkillCreate>(k: K, v: SkillCreate[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function addTag() {
    const t = tagInput.trim()
    if (!t || form.tags?.includes(t)) return
    set('tags', [...(form.tags ?? []), t])
    setTagInput('')
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const sk = await api.createSkill({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        language: form.type === 'prompt' ? '' : (form.language ?? 'python'),
      })
      setSkills(prev => [sk, ...prev])
      setForm({ ...DEFAULT_FORM })
      setShowNew(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this skill?')) return
    await api.deleteSkill(id)
    setSkills(prev => prev.filter(s => s.id !== id))
  }

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Skills</h1>
          <p className="page-subtitle">{skills.length} skill{skills.length !== 1 ? 's' : ''} — scripts and prompt context for your agents</p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="btn-primary">
          {showNew ? <X size={14} /> : <Plus size={14} />}
          {showNew ? 'Cancel' : 'New Skill'}
        </button>
      </div>

      {/* ── New skill form ── */}
      {showNew && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-white mb-5">Create Skill</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" placeholder="e.g. Web Search" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  {(['script', 'prompt'] as SkillType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { set('type', t); if (t === 'prompt') set('language', '') }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-all ${
                        form.type === t ? 'border-violet-500/50 bg-violet-600/15 text-violet-300' : 'border-white/8 text-slate-500 hover:border-white/15'
                      }`}
                    >
                      {t === 'script' ? <Code2 size={12} /> : <FileText size={12} />}
                      {t === 'script' ? 'Script' : 'Prompt context'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <input className="input" placeholder="What does this skill do?" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            {form.type === 'script' && (
              <div>
                <label className="label">Language</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(l => (
                    <button
                      key={l}
                      onClick={() => set('language', l)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${
                        form.language === l
                          ? `border-violet-500/50 bg-violet-600/15 text-violet-300`
                          : 'border-white/8 text-slate-500 hover:border-white/15'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">{form.type === 'script' ? 'Source Code' : 'Prompt Content'}</label>
              <textarea
                className="input font-mono text-xs leading-relaxed resize-y"
                style={{ minHeight: '180px' }}
                placeholder={form.type === 'script'
                  ? 'def run(input: str) -> str:\n    # your skill logic here\n    return result'
                  : 'Add any additional context or instructions that should be injected into the agent prompt…'}
                value={form.content}
                onChange={e => set('content', e.target.value)}
              />
            </div>

            <div>
              <label className="label">Tags</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {(form.tags ?? []).map(t => (
                  <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-[11px] text-slate-400">
                    {t}
                    <button onClick={() => set('tags', (form.tags ?? []).filter(x => x !== t))} className="hover:text-red-400">
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Add tag…" value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
                <button onClick={addTag} className="btn-ghost px-3"><Plus size={13} /></button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/8">
              <button onClick={handleCreate} disabled={saving || !form.name.trim()} className="btn-primary disabled:opacity-40">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Create Skill
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-9" placeholder="Search skills…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Wrench size={32} className="text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm mb-4">No skills found</p>
          <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={14} />Create your first skill</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sk => {
            const open = expanded.has(sk.id)
            return (
              <GlassCard key={sk.id} padding={false} className="overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => toggle(sk.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left group">
                    <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${
                      sk.type === 'script' ? 'bg-violet-600/20 border border-violet-500/30' : 'bg-emerald-600/20 border border-emerald-500/30'
                    }`}>
                      {sk.type === 'script' ? <Code2 size={15} className="text-violet-400" /> : <FileText size={15} className="text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{sk.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${typeBadge(sk.type)}`}>
                          {sk.type}
                        </span>
                        {sk.language && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${langColors[sk.language] ?? langColors.bash}`}>
                            {sk.language}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{sk.description}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      {sk.tags.map(t => (
                        <span key={t} className="hidden sm:flex items-center gap-1 text-[10px] text-slate-600">
                          <Tag size={9} />{t}
                        </span>
                      ))}
                      {open
                        ? <ChevronDown size={13} className="text-slate-500" />
                        : <ChevronRight size={13} className="text-slate-600 group-hover:text-slate-400" />}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(sk.id)}
                    className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Expanded content */}
                {open && (
                  <div className="px-5 pb-4 border-t border-white/5">
                    <pre className="mt-3 p-4 bg-black/30 border border-white/8 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-72">
                      {sk.content || <span className="text-slate-600 italic">No content</span>}
                    </pre>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
