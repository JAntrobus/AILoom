import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Bot, Cpu, Activity, Play, Clock, ArrowRight, TrendingUp } from 'lucide-react'
import { api } from '../api/client'
import type { Stats, Project, Run } from '../types'
import StatCard from '../components/StatCard'
import GlassCard from '../components/GlassCard'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'

function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getStats(), api.getProjects(), api.getAllRuns()]).then(([s, p, r]) => {
      setStats(s)
      setProjects(p)
      setRuns(r.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  const activeRuns = runs.filter(r => r.status === 'running')
  const recentActivity = runs.slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Overview of your AI agent operations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Projects" value={stats?.projects ?? 0} icon={FolderKanban} color="violet" trend="All time" />
        <StatCard label="Active Runs" value={stats?.active_runs ?? 0} icon={Activity} color="blue" trend="Right now" />
        <StatCard label="Agents" value={stats?.agents ?? 0} icon={Bot} color="emerald" trend="Configured" />
        <StatCard label="Platforms" value={stats?.platforms ?? 0} icon={Cpu} color="amber" trend="Connected" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Projects</h2>
            <button onClick={() => navigate('/projects')} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {projects.map(project => (
              <GlassCard
                key={project.id}
                hover
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                        {project.name}
                      </p>
                      <StatusBadge status={project.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{project.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {project.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">{project.run_count} runs</p>
                    <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1 justify-end">
                      <Clock size={9} /> {timeAgo(project.last_run_at)}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Active runs */}
          {activeRuns.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-white mb-3">Active Runs</h2>
              <div className="space-y-3">
                {activeRuns.map(run => {
                  const allSteps = run.steps.length
                  const doneSteps = run.steps.filter(s => s.status === 'completed').length
                  const currentStep = run.steps.find(s => s.status === 'running')
                  const overallPct = allSteps > 0 ? (doneSteps / allSteps) * 100 : 0
                  return (
                    <GlassCard key={run.id} hover onClick={() => navigate(`/projects/${run.project_id}/runs/${run.id}`)}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{run.project_name}</p>
                          {currentStep && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Running: {currentStep.agent_name}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={run.status} />
                      </div>
                      <ProgressBar value={overallPct} color="blue" animated showLabel />
                    </GlassCard>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">Recent Activity</h2>
          <div className="glass rounded-2xl overflow-hidden">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No activity yet</div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentActivity.map((run, idx) => (
                  <button
                    key={run.id}
                    onClick={() => navigate(`/projects/${run.project_id}/runs/${run.id}`)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-white/4 transition-colors text-left"
                  >
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      run.status === 'completed' ? 'bg-emerald-400' :
                      run.status === 'running'   ? 'bg-blue-400 animate-pulse' :
                      run.status === 'failed'    ? 'bg-red-400' : 'bg-slate-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">{run.project_name}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5 capitalize">
                        {run.status} · {timeAgo(run.created_at)}
                      </p>
                    </div>
                    <ArrowRight size={10} className="text-slate-600 mt-1 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="glass rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick actions</p>
            {[
              { label: 'New Project', icon: FolderKanban, to: '/projects/new' },
              { label: 'Add Agent', icon: Bot, to: '/agents/new' },
              { label: 'Connect Platform', icon: Cpu, to: '/platforms' },
            ].map(({ label, icon: Icon, to }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
              >
                <Icon size={14} className="text-violet-500 group-hover:text-violet-400" />
                {label}
                <ArrowRight size={11} className="ml-auto opacity-0 group-hover:opacity-50 -translate-x-1 group-hover:translate-x-0 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
