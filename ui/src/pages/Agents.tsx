import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Bot, Search, Trash2, Cpu, Hash } from 'lucide-react'
import { api } from '../api/client'
import type { Agent, Platform } from '../types'
import GlassCard from '../components/GlassCard'
import StatusBadge from '../components/StatusBadge'

const providerColors: Record<string, string> = {
  openai:    'from-emerald-600 to-teal-600',
  anthropic: 'from-amber-600 to-orange-600',
  azure:     'from-blue-600 to-cyan-600',
  google:    'from-red-600 to-pink-600',
  custom:    'from-violet-600 to-purple-600',
}

export default function Agents() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getAgents(), api.getPlatforms()])
      .then(([a, p]) => { setAgents(a); setPlatforms(p); setLoading(false) })
  }, [])

  const platformMap = Object.fromEntries(platforms.map(p => [p.id, p]))
  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase()) ||
    a.model.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id: string) {
    if (!confirm('Delete this agent?')) return
    await api.deleteAgent(id)
    setAgents(a => a.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">{agents.length} agent{agents.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => navigate('/agents/new')} className="btn-primary">
          <Plus size={14} /> New Agent
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-9" placeholder="Search agents…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Bot size={32} className="text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">No agents found</p>
          <button onClick={() => navigate('/agents/new')} className="btn-primary mt-4">
            <Plus size={14} /> Create your first agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(agent => {
            const plat = platformMap[agent.platform_id]
            const gradient = plat ? providerColors[plat.provider] ?? providerColors.custom : providerColors.custom
            return (
              <GlassCard key={agent.id} className="group flex flex-col" padding={false}>
                <div className="p-5 flex-1">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${gradient} shadow-lg`}>
                      <Bot size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
                      <StatusBadge status={agent.status} size="sm" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">{agent.description}</p>

                  {/* Platform + model info */}
                  <div className="space-y-1.5">
                    {plat && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Cpu size={11} className="text-slate-600" />
                        <span>{plat.name}</span>
                        <span className="text-slate-700">·</span>
                        <span className="capitalize">{plat.provider}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Hash size={11} className="text-slate-600" />
                      <span className="font-mono">{agent.model}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                  <span className="text-xs text-slate-600">{agent.task_count} tasks run</span>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
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
