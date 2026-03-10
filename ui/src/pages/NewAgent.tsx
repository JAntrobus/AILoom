import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Bot, Cpu, Hash, Loader2,
  Plus, Trash2, Brain, ListOrdered,
} from 'lucide-react'
import { api } from '../api/client'
import type { Platform, Skill } from '../types'
import GlassCard from '../components/GlassCard'

type Step = 'info' | 'behaviour' | 'platform' | 'model' | 'review'

const providerColors: Record<string, string> = {
  openai: 'from-emerald-600 to-teal-600',
  anthropic: 'from-amber-600 to-orange-600',
  azure: 'from-blue-600 to-cyan-600',
  google: 'from-red-600 to-pink-600',
  custom: 'from-violet-600 to-purple-600',
}

export default function NewAgent() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('info')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [models, setModels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [stepInput, setStepInput] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    system_prompt: '',
    steps: [] as string[],
    skill_ids: [] as string[],
    platform_id: '',
    model: '',
  })

  useEffect(() => {
    Promise.all([api.getPlatforms(), api.getSkills()])
      .then(([p, s]) => { setPlatforms(p); setSkills(s) })
  }, [])

  useEffect(() => {
    if (!form.platform_id) { setModels([]); return }
    api.getPlatformModels(form.platform_id).then(r => {
      setModels(r.models)
      setForm(f => ({ ...f, model: r.models[0] ?? '' }))
    })
  }, [form.platform_id])

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function addStep() {
    const t = stepInput.trim()
    if (!t) return
    set('steps', [...form.steps, t])
    setStepInput('')
  }

  function removeStep(i: number) {
    set('steps', form.steps.filter((_, idx) => idx !== i))
  }

  function toggleSkill(id: string) {
    set('skill_ids', form.skill_ids.includes(id)
      ? form.skill_ids.filter(s => s !== id)
      : [...form.skill_ids, id])
  }

  const wizardSteps: { id: Step; label: string }[] = [
    { id: 'info',      label: 'Info' },
    { id: 'behaviour', label: 'Behaviour' },
    { id: 'platform',  label: 'Platform' },
    { id: 'model',     label: 'Model' },
    { id: 'review',    label: 'Review' },
  ]
  const idx = wizardSteps.findIndex(s => s.id === step)

  const canNext = {
    info:      form.name.trim().length > 0,
    behaviour: true,
    platform:  !!form.platform_id,
    model:     !!form.model,
    review:    true,
  }[step]

  async function handleCreate() {
    setSaving(true)
    try {
      await api.createAgent({
        name: form.name.trim(),
        description: form.description.trim(),
        platform_id: form.platform_id,
        model: form.model,
        system_prompt: form.system_prompt.trim(),
        steps: form.steps,
        skill_ids: form.skill_ids,
      })
      navigate('/agents')
    } finally { setSaving(false) }
  }

  const selectedPlatform = platforms.find(p => p.id === form.platform_id)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/agents')} className="btn-ghost -ml-1 px-2 text-slate-500">
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 className="page-title">New Agent</h1>
          <p className="page-subtitle">Configure an AI agent for your workflows</p>
        </div>
      </div>

      {/* Step bar */}
      <div className="flex items-center gap-0 mb-8">
        {wizardSteps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border transition-all ${
              i < idx ? 'bg-violet-600 border-violet-600 text-white' :
              i === idx ? 'border-violet-500 text-violet-300 bg-violet-600/20' :
              'border-white/10 text-slate-600'
            }`}>{i < idx ? <Check size={13} /> : i + 1}</div>
            <span className={`ml-2 text-xs font-medium ${i === idx ? 'text-white' : 'text-slate-600'}`}>{s.label}</span>
            {i < wizardSteps.length - 1 && <div className={`flex-1 h-px mx-4 ${i < idx ? 'bg-violet-600' : 'bg-white/8'}`} />}
          </div>
        ))}
      </div>

      <GlassCard>
        {/* Info */}
        {step === 'info' && (
          <div className="space-y-5">
            <div>
              <label className="label">Agent Name *</label>
              <input className="input" placeholder="e.g. Research Agent" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input min-h-[80px] resize-none" placeholder="What does this agent do?" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
        )}

        {/* Behaviour */}
        {step === 'behaviour' && (
          <div className="space-y-5">
            <div>
              <label className="label flex items-center gap-2">
                <Brain size={13} className="text-violet-400" />
                System Prompt
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Define the agent's persona, role, and high-level objectives.
                The agent uses this as the foundation for all its responses.
              </p>
              <textarea
                className="input resize-y font-mono text-xs leading-relaxed"
                style={{ minHeight: '120px' }}
                placeholder={"You are an expert research analyst. Your role is to gather information from multiple sources, evaluate credibility, and synthesise findings into clear, structured briefs...\n\nAlways cite your sources and note the confidence level of each claim."}
                value={form.system_prompt}
                onChange={e => set('system_prompt', e.target.value)}
              />
            </div>

            <div>
              <label className="label flex items-center gap-2">
                <ListOrdered size={13} className="text-violet-400" />
                Step-by-Step Instructions
              </label>
              <p className="text-xs text-slate-500 mb-3">
                The ordered steps this agent should follow when executing a task.
                These are stored in the agent's own memory and refined over time.
              </p>
              <div className="space-y-1.5 mb-3">
                {form.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                    <span className="text-xs text-slate-600 font-mono flex-shrink-0 pt-0.5">{i + 1}.</span>
                    <span className="text-xs text-slate-300 flex-1 leading-relaxed">{s}</span>
                    <button onClick={() => removeStep(i)} className="p-0.5 text-slate-600 hover:text-red-400 flex-shrink-0">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  placeholder="Add a step…"
                  value={stepInput}
                  onChange={e => setStepInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }}
                />
                <button onClick={addStep} className="btn-ghost px-3"><Plus size={13} /></button>
              </div>
            </div>

            {skills.length > 0 && (
              <div>
                <label className="label">Default Skills</label>
                <p className="text-xs text-slate-500 mb-3">Skills this agent can use in any workflow it is assigned to.</p>
                <div className="space-y-2">
                  {skills.map(sk => (
                    <button
                      key={sk.id}
                      onClick={() => toggleSkill(sk.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        form.skill_ids.includes(sk.id)
                          ? 'border-violet-500/50 bg-violet-600/10'
                          : 'border-white/8 hover:border-white/15 hover:bg-white/3'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        sk.type === 'script' ? 'bg-violet-600/20 text-violet-400' : 'bg-emerald-600/20 text-emerald-400'
                      }`}>
                        {sk.type === 'script' ? 'Py' : 'Ctx'}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-white">{sk.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{sk.description}</p>
                      </div>
                      {form.skill_ids.includes(sk.id) && <Check size={13} className="text-violet-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Platform */}
        {step === 'platform' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">Choose the AI platform this agent will use.</p>
            {platforms.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm mb-3">No platforms configured yet.</p>
                <button onClick={() => navigate('/platforms')} className="btn-primary">Configure a platform first</button>
              </div>
            ) : platforms.map(p => (
              <button
                key={p.id}
                onClick={() => set('platform_id', p.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  form.platform_id === p.id
                    ? 'border-violet-500/50 bg-violet-600/10'
                    : 'border-white/8 hover:border-white/15 hover:bg-white/3'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${providerColors[p.provider] ?? providerColors.custom}`}>
                  <Cpu size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{p.provider} · {p.models.length} models</p>
                </div>
                {p.is_connected && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>}
                {form.platform_id === p.id && <Check size={14} className="text-violet-400" />}
              </button>
            ))}
          </div>
        )}

        {/* Model */}
        {step === 'model' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              Select a model from {selectedPlatform?.name ?? 'the platform'}.
            </p>
            {models.map(m => (
              <button
                key={m}
                onClick={() => set('model', m)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  form.model === m
                    ? 'border-violet-500/50 bg-violet-600/10'
                    : 'border-white/8 hover:border-white/15 hover:bg-white/3'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
                  <Hash size={14} className="text-slate-500" />
                </div>
                <span className="text-sm font-mono text-white">{m}</span>
                {form.model === m && <Check size={14} className="text-violet-400 ml-auto" />}
              </button>
            ))}
          </div>
        )}

        {/* Review */}
        {step === 'review' && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-5">Review &amp; Create Agent</h3>
            <dl className="space-y-3">
              {[
                ['Name', form.name],
                ['Description', form.description || '—'],
                ['System prompt', form.system_prompt ? <span className="line-clamp-2 text-xs font-mono">{form.system_prompt}</span> : '—'],
                ['Steps', form.steps.length > 0 ? `${form.steps.length} step${form.steps.length !== 1 ? 's' : ''}` : '—'],
                ['Skills', form.skill_ids.length > 0 ? `${form.skill_ids.length} selected` : '—'],
                ['Platform', selectedPlatform?.name ?? '—'],
                ['Model', <span key="model" className="font-mono text-sm">{form.model}</span>],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex gap-4 py-2 border-b border-white/5 last:border-0">
                  <dt className="text-xs text-slate-500 w-28 flex-shrink-0 pt-0.5">{k}</dt>
                  <dd className="text-sm text-slate-300 flex-1">{v as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-5 border-t border-white/8">
          <button onClick={() => setStep(wizardSteps[idx - 1]?.id as Step ?? 'info')} disabled={idx === 0} className="btn-ghost disabled:opacity-30">
            <ArrowLeft size={14} /> Back
          </button>
          {step !== 'review' ? (
            <button onClick={() => setStep(wizardSteps[idx + 1].id as Step)} disabled={!canNext} className="btn-primary disabled:opacity-40">
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
              Create Agent
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
