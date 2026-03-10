import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Play, Trash2, ArrowRight, Clock, FolderKanban } from 'lucide-react'
import { api } from '../api/client'
import type { Project } from '../types'
import GlassCard from '../components/GlassCard'
import StatusBadge from '../components/StatusBadge'

function timeAgo(iso?: string): string {
  if (!iso) return 'Never run'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState<string | null>(null)

  useEffect(() => {
    api.getProjects().then(p => { setProjects(p); setLoading(false) })
  }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleRun(e: React.MouseEvent, project: Project) {
    e.stopPropagation()
    if (!project.workflow_id) return
    setLaunching(project.id)
    try {
      const run = await api.createRun(project.id)
      navigate(`/projects/${project.id}/runs/${run.id}`)
    } finally {
      setLaunching(null)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await api.deleteProject(id)
    setProjects(ps => ps.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} projects configured</p>
        </div>
        <button onClick={() => navigate('/projects/new')} className="btn-primary">
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-9"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FolderKanban size={32} className="text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">No projects found</p>
          <button onClick={() => navigate('/projects/new')} className="btn-primary mt-4">
            <Plus size={14} /> Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(project => (
            <GlassCard
              key={project.id}
              hover
              onClick={() => navigate(`/projects/${project.id}`)}
              className="group flex flex-col"
              padding={false}
            >
              <div className="p-5 flex-1">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors leading-tight">
                    {project.name}
                  </h3>
                  <StatusBadge status={project.status} size="sm" />
                </div>

                <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
                  {project.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {project.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Play size={10} className="text-slate-600" />
                    {project.run_count} runs
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} className="text-slate-600" />
                    {timeAgo(project.last_run_at)}
                  </span>
                </div>
              </div>

              {/* Footer actions */}
              <div
                className="flex items-center gap-2 px-5 py-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={e => handleRun(e, project)}
                  disabled={!project.workflow_id || launching === project.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium
                             bg-violet-600/20 text-violet-300 border border-violet-500/30
                             hover:bg-violet-600/30 transition-colors disabled:opacity-40"
                >
                  {launching === project.id ? (
                    <div className="w-3 h-3 border border-violet-500/50 border-t-violet-400 rounded-full animate-spin" />
                  ) : (
                    <Play size={10} />
                  )}
                  Run
                </button>
                <button
                  onClick={e => { navigate(`/projects/${project.id}`); e.stopPropagation() }}
                  className="flex items-center gap-1 py-1.5 px-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Open <ArrowRight size={10} />
                </button>
                <button
                  onClick={e => handleDelete(e, project.id)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
