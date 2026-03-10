import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle, Clock, ChevronRight, Terminal, Loader2 } from 'lucide-react'
import { api } from '../api/client'
import type { Run, RunStep } from '../types'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'
import GlassCard from '../components/GlassCard'

function duration(start?: string, end?: string) {
  if (!start) return '—'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const sec = Math.round((e - s) / 1000)
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function fmt(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function StepCard({ step }: { step: RunStep }) {
  const [expanded, setExpanded] = useState(false)
  const isActive = step.status === 'running'
  return (
    <div className={`glass rounded-xl overflow-hidden transition-all ${isActive ? 'border-blue-500/30' : ''}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex-shrink-0">
          {step.status === 'completed' ? <CheckCircle2 size={18} className="text-emerald-400" />
          : step.status === 'running'   ? <Loader2 size={18} className="text-blue-400 animate-spin" />
          : step.status === 'failed'    ? <XCircle size={18} className="text-red-400" />
          : <Clock size={18} className="text-slate-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium text-white">{step.agent_name}</p>
            <StatusBadge status={step.status} size="sm" />
          </div>
          {isActive && <ProgressBar value={step.progress} color="blue" animated showLabel size="sm" />}
          {!isActive && step.output && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{step.output}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-500">{duration(step.started_at, step.completed_at)}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{fmt(step.started_at)}</p>
        </div>
        <ChevronRight size={13} className={`text-slate-600 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-3">
          {step.output && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Output</p>
              <p className="text-sm text-slate-300 leading-relaxed">{step.output}</p>
            </div>
          )}
          {step.logs.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Terminal size={11} className="text-slate-600" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Logs</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 space-y-0.5 font-mono text-xs">
                {step.logs.map((log, i) => (
                  <p key={i} className="text-slate-400">{log}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RunDetail() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId) return
    api.getRun(runId).then(r => { setRun(r); setLoading(false) })
  }, [runId])

  // Poll while running
  useEffect(() => {
    if (!runId || run?.status !== 'running') return
    const timer = setInterval(() => {
      api.getRun(runId).then(setRun)
    }, 2000)
    return () => clearInterval(timer)
  }, [run?.status, runId])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
  if (!run) return <div className="text-center py-20 text-slate-500">Run not found</div>

  const doneSteps = run.steps.filter(s => s.status === 'completed').length
  const overallPct = run.steps.length > 0 ? (doneSteps / run.steps.length) * 100 : 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate(`/projects/${projectId}`)} className="btn-ghost -ml-1 px-2 text-slate-500">
        <ArrowLeft size={14} /> {run.project_name}
      </button>

      {/* Header */}
      <GlassCard>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-bold text-white">{run.project_name}</h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-xs text-slate-500 font-mono">{run.id}</p>
          </div>
          <div className="text-right text-xs text-slate-500 flex-shrink-0">
            <p>Started {fmt(run.started_at)}</p>
            {run.completed_at && <p className="mt-0.5">Ended {fmt(run.completed_at)}</p>}
            <p className="mt-0.5 text-slate-400">{duration(run.started_at, run.completed_at)}</p>
          </div>
        </div>
        {run.status === 'running' && (
          <ProgressBar value={overallPct} color="blue" animated showLabel />
        )}
        {run.status === 'completed' && (
          <div className="flex items-center gap-2 mt-2 text-xs text-emerald-400">
            <CheckCircle2 size={13} />
            All {run.steps.length} step{run.steps.length !== 1 ? 's' : ''} completed successfully
          </div>
        )}
      </GlassCard>

      {/* Steps */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Steps ({run.steps.length})</h2>
        <div className="space-y-2">
          {run.steps.map(step => <StepCard key={step.id} step={step} />)}
        </div>
      </div>
    </div>
  )
}
