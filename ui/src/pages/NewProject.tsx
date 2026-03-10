import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, FolderKanban, GitBranch, Loader2,
  MessageSquareText, FileCode2, FileInput, Globe, Webhook,
} from 'lucide-react'
import { api } from '../api/client'
import type { Workflow, InputType } from '../types'
import GlassCard from '../components/GlassCard'

type Step = 'details' | 'input' | 'workflow' | 'review'

const INPUT_TYPES: { id: InputType; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'text',    label: 'Text Prompt',  desc: 'User types or pastes the task description directly.',       icon: <MessageSquareText size={18} className="text-violet-400" /> },
  { id: 'file',    label: 'File Upload',  desc: 'A document, code file, or CSV is uploaded as input.',       icon: <FileCode2 size={18} className="text-blue-400" /> },
  { id: 'api',     label: 'API / GitHub', desc: 'Data arrives via an API call (PR, ticket, payload…).',      icon: <FileInput size={18} className="text-emerald-400" /> },
  { id: 'url',     label: 'URL / Web',    desc: 'The agent fetches and processes a web URL.',                 icon: <Globe size={18} className="text-amber-400" /> },
  { id: 'webhook', label: 'Webhook',      desc: 'An external system POSTs data to trigger a run.',           icon: <Webhook size={18} className="text-red-400" /> },
]

export default function NewProject() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('details')
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    tags: '',
    workflow_id: '',
    input_type: 'text' as InputType,
    prompt: '',
    input_config: '',
  })

  useEffect(() => { api.getWorkflows().then(setWorkflows) }, [])

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const canProceedDetails = form.name.trim().length > 0

  async function handleCreate() {
    setSaving(true)
    try {
      const p = await api.createProject({
        name: form.name.trim(),
        description: form.description.trim(),
        workflow_id: form.workflow_id || undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        input_type: form.input_type,
        prompt: form.prompt.trim(),
        input_config: form.input_config.trim() || undefined,
      })
      navigate(`/projects/${p.id}`)
    } finally {
      setSaving(false)
    }
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'input',   label: 'Input' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'review',  label: 'Review' },
  ]
  const stepIdx = steps.findIndex(s => s.id === step)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/projects')} className="btn-ghost -ml-1 px-2 text-slate-500">
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 className="page-title">New Project</h1>
          <p className="page-subtitle">Configure your AI agent workflow project</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border transition-all ${
              i < stepIdx ? 'bg-violet-600 border-violet-600 text-white' :
              i === stepIdx ? 'border-violet-500 text-violet-300 bg-violet-600/20' :
              'border-white/10 text-slate-600'
            }`}>
              {i < stepIdx ? <Check size={13} /> : i + 1}
            </div>
            <span className={`ml-2 text-xs font-medium ${i === stepIdx ? 'text-white' : 'text-slate-600'}`}>{s.label}</span>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-4 ${i < stepIdx ? 'bg-violet-600' : 'bg-white/8'}`} />
            )}
          </div>
        ))}
      </div>

      <GlassCard>
        {/* ── Step: Details ── */}
        {step === 'details' && (
          <div className="space-y-5">
            <div>
              <label className="label">Project Name *</label>
              <input className="input" placeholder="e.g. Blog Post Generator" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="What will this project do?"
                value={form.description}
                onChange={e => update('description', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Tags (comma-separated)</label>
              <input className="input" placeholder="e.g. content, seo, writing" value={form.tags} onChange={e => update('tags', e.target.value)} />
            </div>
          </div>
        )}

        {/* ── Step: Input ── */}
        {step === 'input' && (
          <div className="space-y-5">
            <div>
              <label className="label mb-3">How does data enter this project?</label>
              <div className="grid grid-cols-1 gap-2">
                {INPUT_TYPES.map(it => (
                  <button
                    key={it.id}
                    onClick={() => update('input_type', it.id)}
                    className={`flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all ${
                      form.input_type === it.id
                        ? 'border-violet-500/50 bg-violet-600/10'
                        : 'border-white/8 hover:border-white/15 hover:bg-white/3'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
                      form.input_type === it.id ? 'bg-violet-600/20 border border-violet-500/30' : 'bg-white/5 border border-white/8'
                    }`}>
                      {it.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{it.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{it.desc}</p>
                    </div>
                    {form.input_type === it.id && <Check size={14} className="text-violet-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Task Prompt</label>
              <p className="text-xs text-slate-500 mb-2">
                Describe exactly what you want the agent workflow to do with the incoming data.
                This is the core instruction fed to the first agent.
              </p>
              <textarea
                className="input resize-y font-mono text-xs leading-relaxed"
                style={{ minHeight: '120px' }}
                placeholder="e.g. Research and write a 1,000-word SEO blog post on the given topic. Include at least 3 sources and optimise for the primary keyword..."
                value={form.prompt}
                onChange={e => update('prompt', e.target.value)}
              />
            </div>

            {(form.input_type === 'api' || form.input_type === 'webhook') && (
              <div>
                <label className="label">Input Configuration (JSON, optional)</label>
                <textarea
                  className="input resize-y font-mono text-xs leading-relaxed"
                  style={{ minHeight: '80px' }}
                  placeholder={'{\n  "source": "github",\n  "repo": "org/repo"\n}'}
                  value={form.input_config}
                  onChange={e => update('input_config', e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Step: Workflow ── */}
        {step === 'workflow' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">Select a workflow to define which agents run and in what order.</p>
            {workflows.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No workflows available yet.
              </div>
            ) : (
              workflows.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => update('workflow_id', wf.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                    form.workflow_id === wf.id
                      ? 'border-violet-500/50 bg-violet-600/10 text-white'
                      : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/15 hover:bg-white/5'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    form.workflow_id === wf.id ? 'bg-violet-600/30 border border-violet-500/40' : 'bg-white/5 border border-white/8'
                  }`}>
                    <GitBranch size={15} className={form.workflow_id === wf.id ? 'text-violet-400' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{wf.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {wf.nodes.filter(n => n.type === 'agent').length} agent step{wf.nodes.filter(n => n.type === 'agent').length !== 1 ? 's' : ''}
                      {wf.skill_ids?.length > 0 && ` · ${wf.skill_ids.length} skill${wf.skill_ids.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {form.workflow_id === wf.id && (
                    <Check size={14} className="text-violet-400 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
            <button
              onClick={() => update('workflow_id', '')}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                form.workflow_id === ''
                  ? 'border-slate-500/40 bg-white/5'
                  : 'border-white/5 hover:border-white/10 hover:bg-white/3'
              }`}
            >
              <p className="text-sm text-slate-400">No workflow (manual execution)</p>
            </button>
          </div>
        )}

        {/* ── Step: Review ── */}
        {step === 'review' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white mb-4">Review &amp; Create</h3>
            <dl className="space-y-3">
              {[
                ['Name', form.name || <span className="text-slate-600">—</span>],
                ['Description', form.description || <span className="text-slate-600">—</span>],
                ['Tags', form.tags || <span className="text-slate-600">None</span>],
                ['Input type', INPUT_TYPES.find(t => t.id === form.input_type)?.label ?? form.input_type],
                ['Prompt', form.prompt ? <span className="line-clamp-2 text-xs font-mono">{form.prompt}</span> : <span className="text-slate-600">—</span>],
                ['Workflow', workflows.find(w => w.id === form.workflow_id)?.name ?? <span className="text-slate-600">None</span>],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex gap-4 py-2 border-b border-white/5 last:border-0">
                  <dt className="text-xs text-slate-500 w-24 flex-shrink-0 pt-0.5">{k}</dt>
                  <dd className="text-sm text-slate-300 flex-1">{v as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 pt-5 border-t border-white/8">
          <button
            onClick={() => setStep(steps[stepIdx - 1]?.id as Step ?? 'details')}
            disabled={stepIdx === 0}
            className="btn-ghost disabled:opacity-30"
          >
            <ArrowLeft size={14} /> Back
          </button>
          {step !== 'review' ? (
            <button
              onClick={() => setStep(steps[stepIdx + 1].id as Step)}
              disabled={step === 'details' && !canProceedDetails}
              className="btn-primary disabled:opacity-40"
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <FolderKanban size={14} />}
              Create Project
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
