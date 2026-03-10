import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Play, SquareX, CheckCircle2,
  Layers, GitBranch, ListOrdered, ChevronRight,
  Plus, Trash2,
} from 'lucide-react'
import { api } from '../api/client'
import type { Project, Run, Workflow, Agent } from '../types'
import GlassCard from '../components/GlassCard'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'
import WorkflowDiagram from '../components/WorkflowDiagram'

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

type Tab = 'overview' | 'workflow' | 'runs'

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
              return (
                <GlassCard key={run.id} className="group" padding={false}>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={run.status} />
                        <span className="text-xs text-slate-400">{timeAgo(run.created_at)}</span>
                        <span className="text-xs text-slate-600">{duration(run.started_at, run.completed_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                </GlassCard>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
