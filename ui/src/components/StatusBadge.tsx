import type { RunStatus, AgentStatus, ProjectStatus } from '../types'

type Status = RunStatus | AgentStatus | ProjectStatus

const styles: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  idle:      { dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  pending:   { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  running:   { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  paused:    { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  completed: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed:    { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  active:    { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  draft:     { dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  archived:  { dot: 'bg-slate-600', text: 'text-slate-500', bg: 'bg-slate-600/10', border: 'border-slate-600/20' },
}

interface Props {
  status: Status
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const s = styles[status] ?? styles.idle
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium capitalize
        ${s.bg} ${s.border} ${s.text}
        ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {status}
    </span>
  )
}
