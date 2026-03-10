import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Play, SquareX, CheckCircle2,
  Layers, GitBranch, ListOrdered, ChevronRight,
  Plus, Trash2, FileInput, Brain, Webhook, Globe,
  FileCode2, MessageSquareText,
} from 'lucide-react'
import { api } from '../api/client'
import type { Project, Run, Workflow, Agent, MemoryFile } from '../types'
import GlassCard from '../components/GlassCard'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'
import WorkflowDiagram from '../components/WorkflowDiagram'
import MemoryViewer from '../components/MemoryViewer'

function timeAgo(iso?: string) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function duration(start?: string, end?: string) {
  if (!start) return '—'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const sec = Math.round((e - s) / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

const inputTypeIcons: Record<string, React.ReactNode> = {
  text:    <MessageSquareText size={14} className="text-violet-400" />,
  file:    <FileCode2 size={14} className="text-blue-400" />,
  api:     <FileInput size={14} className="text-emerald-400" />,
  url:     <Globe size={14} className="text-amber-400" />,
  webhook: <Webhook size={14} className="text-red-400" />,
}

const inputTypeLabels: Record<string, string> = {
  text:    'Text Prompt',
  file:    'File Upload',
  api:     'API / GitHub',
  url:     'URL / Web',
  webhook: 'Webhook',
}

type Tab = 'overview' | 'input' | 'workflow' | 'runs'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [project, setProject] = useState<Project | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [runMemories, setRunMemories] = useState<Record<string, MemoryFile[]>>({})
  const [expandedRunMem, setExpandedRunMem] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.getProject(id),
      api.getProjectRuns(id),
      api.getAgents(),
    ]).then(async ([p, r, a]) => {
      setProject(p)
      setRuns(r.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      setAgents(a)
      if (p.workflow_id) {
        const wf = await api.getWorkflow(p.workflow_id)
        setWorkflow(wf)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  // Poll for run updates every 3s if there are running runs
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running')
    if (!hasRunning || !id) return
    const timer = setInterval(() => {
      api.getProjectRuns(id).then(r =>
        setRuns(r.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      )
    }, 3000)
    return () => clearInterval(timer)
  }, [runs, id])

  async function handleRun() {
    if (!id || !project?.workflow_id) return
    setLaunching(true)
    try {
      const run = await api.createRun(id)
      setRuns(prev => [run, ...prev])
      setTab('runs')
    } finally {
      setLaunching(false)
    }
  }

  async function handleDeleteRun(runId: string) {
    if (!confirm('Delete this run?')) return
    await api.deleteRun(runId)
    setRuns(prev => prev.filter(r => r.id !== runId))
  }

  async function toggleRunMemory(runId: string) {
    const next = new Set(expandedRunMem)
    if (next.has(runId)) { next.delete(runId); setExpandedRunMem(next); return }
    next.add(runId); setExpandedRunMem(next)
    if (!runMemories[runId]) {
      const mems = await api.getRunMemory(runId)
      setRunMemories(prev => ({ ...prev, [runId]: mems }))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )

  if (!project) return (
    <div className="text-center py-20 text-slate-500">Project not found</div>
  )

  const completedRuns = runs.filter(r => r.status === 'completed').length
  const failedRuns = runs.filter(r => r.status === 'failed').length
  const activeRun = runs.find(r => r.status === 'running')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Layers size={14} /> },
    { id: 'input', label: 'Input & Prompt', icon: <FileInput size={14} /> },
    { id: 'workflow', label: 'Workflow', icon: <GitBranch size={14} /> },
    { id: 'runs', label: `Runs (${runs.length})`, icon: <ListOrdered size={14} /> },
  ]

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button onClick={() => navigate('/projects')} className="btn-ghost mb-4 -ml-1 text-slate-500 hover:text-slate-300 px-2">
          <ArrowLeft size={14} /> Projects
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-slate-400 text-sm max-w-xl">{project.description}</p>
            <div className="flex gap-1.5 mt-2">
              {project.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeRun && (
              <Link
                to={`/projects/${id}/runs/${activeRun.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
                           bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Run in progress
                <ChevronRight size={11} />
              </Link>
            )}
            <button
              onClick={handleRun}
              disabled={!project.workflow_id || launching}
              className="btn-primary"
            >
              {launching
                ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
                : <Play size={14} />}
              Run
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Runs', value: runs.length, icon: <ListOrdered size={16} className="text-violet-400" /> },
                { label: 'Completed', value: completedRuns, icon: <CheckCircle2 size={16} className="text-emerald-400" /> },
                { label: 'Failed', value: failedRuns, icon: <SquareX size={16} className="text-red-400" /> },
              ].map(stat => (
                <GlassCard key={stat.label}>
                  <div className="flex items-center gap-3">
                    {stat.icon}
                    <div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-xs text-slate-500">{stat.label}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Recent runs preview */}
            <GlassCard>
              <h3 className="text-sm font-semibold text-white mb-4">Recent Runs</h3>
              {runs.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No runs yet.{' '}
                  <button onClick={handleRun} className="text-violet-400 hover:text-violet-300">Start one →</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {runs.slice(0, 5).map(run => (
                    <Link
                      key={run.id}
                      to={`/projects/${id}/runs/${run.id}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <StatusBadge status={run.status} size="sm" />
                      <span className="text-xs text-slate-400 flex-1">{timeAgo(run.created_at)}</span>
                      <span className="text-xs text-slate-500">{duration(run.started_at, run.completed_at)}</span>
                      <ChevronRight size={11} className="text-slate-600 group-hover:text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          <div className="space-y-4">
            <GlassCard>
              <h3 className="text-sm font-semibold text-white mb-3">Details</h3>
              <dl className="space-y-2 text-xs">
                {[
                  ['Status', <StatusBadge status={project.status} size="sm" />],
                  ['Input type', <span className="flex items-center gap-1.5">{inputTypeIcons[project.input_type] ?? inputTypeIcons.text}{inputTypeLabels[project.input_type] ?? project.input_type}</span>],
                  ['Created', timeAgo(project.created_at)],
                  ['Last run', timeAgo(project.last_run_at)],
                  ['Workflow', workflow?.name ?? <span className="text-slate-600">None</span>],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-slate-300">{v as React.ReactNode}</dd>
                  </div>
                ))}
              </dl>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ── Input & Prompt ── */}
      {tab === 'input' && (
        <div className="space-y-4 max-w-3xl">
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              {inputTypeIcons[project.input_type] ?? inputTypeIcons.text}
              <h3 className="text-sm font-semibold text-white">
                Input Type: {inputTypeLabels[project.input_type] ?? project.input_type}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              {project.input_type === 'text' && 'Data enters this project as a text prompt typed or pasted by the user.'}
              {project.input_type === 'file' && 'Data enters this project as an uploaded file (document, code, CSV…).'}
              {project.input_type === 'api' && 'Data enters this project via an API call (e.g. a GitHub PR, JIRA ticket, or webhook payload).'}
              {project.input_type === 'url' && 'Data enters this project by fetching a URL or web page.'}
              {project.input_type === 'webhook' && 'Data enters this project via an incoming webhook POST request.'}
            </p>

            <div className="mb-5">
              <label className="label mb-2 flex items-center gap-2">
                <MessageSquareText size={12} className="text-violet-400" />
                Task Prompt
              </label>
              <div className="p-4 rounded-xl bg-black/20 border border-white/8 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                {project.prompt || <span className="text-slate-600 italic">No prompt configured yet.</span>}
              </div>
            </div>

            {project.input_config && (
              <div>
                <label className="label mb-2">Input Configuration (JSON)</label>
                <div className="p-4 rounded-xl bg-black/20 border border-white/8 text-[11px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(project.input_config!), null, 2) }
                    catch { return project.input_config }
                  })()}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ── Workflow ── */}
      {tab === 'workflow' && (
        <GlassCard>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white">
              {workflow ? workflow.name : 'No workflow assigned'}
            </h3>
          </div>
          {workflow ? (
            <WorkflowDiagram workflow={workflow} agents={agents} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitBranch size={32} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">No workflow assigned to this project.</p>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Runs ── */}
      {tab === 'runs' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{runs.length} total run{runs.length !== 1 ? 's' : ''}</p>
            <button onClick={handleRun} disabled={!project.workflow_id} className="btn-primary">
              <Plus size={13} /> New Run
            </button>
          </div>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
              No runs yet
            </div>
          ) : (
            runs.map(run => {
              const done = run.steps.filter(s => s.status === 'completed').length
              const pct = run.steps.length > 0 ? (done / run.steps.length) * 100 : 0
              const memOpen = expandedRunMem.has(run.id)
              return (
                <GlassCard key={run.id} className="group" padding={false}>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={run.status} />
                        <span className="text-xs text-slate-400">{timeAgo(run.created_at)}</span>
                        <span className="text-xs text-slate-600">{duration(run.started_at, run.completed_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRunMemory(run.id)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                            memOpen
                              ? 'border-violet-500/30 bg-violet-600/15 text-violet-400'
                              : 'border-white/8 text-slate-600 hover:text-slate-400 hover:border-white/15'
                          }`}
                        >
                          <Brain size={11} />
                          Memory
                        </button>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <Link
                            to={`/projects/${id}/runs/${run.id}`}
                            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                          >
                            Details <ChevronRight size={10} />
                          </Link>
                          <button onClick={() => handleDeleteRun(run.id)} className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {run.status === 'running' && (
                      <ProgressBar value={pct} color="blue" animated showLabel size="sm" />
                    )}
                    <div className="flex gap-2 mt-2">
                      {run.steps.map(s => (
                        <span key={s.id} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          s.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                          s.status === 'running'   ? 'bg-blue-500/15 text-blue-400' :
                          s.status === 'failed'    ? 'bg-red-500/15 text-red-400' :
                          'bg-white/5 text-slate-500'
                        }`}>{s.agent_name}</span>
                      ))}
                    </div>
                  </div>
                  {/* Run memory panel */}
                  {memOpen && (
                    <div className="px-4 pb-4 border-t border-white/5">
                      <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mt-3 mb-2">Shared Run Memory</p>
                      <MemoryViewer
                        memories={runMemories[run.id] ?? []}
                        emptyMessage="No memory files written for this run yet."
                      />
                    </div>
                  )}
                </GlassCard>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
