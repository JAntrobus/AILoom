import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Bot, Search, Trash2, Cpu, Hash,
  Brain, ListOrdered, ChevronDown, ChevronRight, Wrench,
} from 'lucide-react'
import { api } from '../api/client'
import type { Agent, Platform, Skill, MemoryFile } from '../types'
import GlassCard from '../components/GlassCard'
import StatusBadge from '../components/StatusBadge'
import MemoryViewer from '../components/MemoryViewer'

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
  const [skills, setSkills] = useState<Skill[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [agentMemories, setAgentMemories] = useState<Record<string, MemoryFile[]>>({})

  useEffect(() => {
    Promise.all([api.getAgents(), api.getPlatforms(), api.getSkills()])
      .then(([a, p, s]) => { setAgents(a); setPlatforms(p); setSkills(s); setLoading(false) })
  }, [])

  const platformMap = Object.fromEntries(platforms.map(p => [p.id, p]))
  const skillMap = Object.fromEntries(skills.map(s => [s.id, s]))

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase()) ||
    a.model.toLowerCase().includes(search.toLowerCase())
  )

  async function toggleExpand(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) { next.delete(id); setExpanded(next); return }
    next.add(id); setExpanded(next)
    if (!agentMemories[id]) {
      const mems = await api.getAgentMemory(id)
      setAgentMemories(prev => ({ ...prev, [id]: mems }))
    }
  }

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
        <div className="space-y-3">
          {filtered.map(agent => {
            const plat = platformMap[agent.platform_id]
            const gradient = plat ? providerColors[plat.provider] ?? providerColors.custom : providerColors.custom
            const isOpen = expanded.has(agent.id)
            const agentSkills = (agent.skill_ids ?? []).map(id => skillMap[id]).filter(Boolean)
            return (
              <GlassCard key={agent.id} padding={false} className="overflow-hidden">
                {/* Main row */}
                <div className="flex items-center gap-4 p-5">
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${gradient} shadow-lg`}>
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{agent.name}</p>
                      <StatusBadge status={agent.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{agent.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {plat && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600">
                          <Cpu size={10} />{plat.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-600 font-mono">
                        <Hash size={10} />{agent.model}
                      </span>
                      {agent.steps?.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600">
                          <ListOrdered size={10} />{agent.steps.length} step{agent.steps.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {agentSkills.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600">
                          <Wrench size={10} />{agentSkills.length} skill{agentSkills.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-700">
                        {agent.task_count} tasks run
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleExpand(agent.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-5">
                    {/* System prompt */}
                    {agent.system_prompt && (
                      <div>
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                          <Brain size={10} />System Prompt
                        </p>
                        <div className="p-3 rounded-xl bg-black/20 border border-white/8 text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-wrap">
                          {agent.system_prompt}
                        </div>
                      </div>
                    )}

                    {/* Steps */}
                    {agent.steps?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                          <ListOrdered size={10} />Instructions
                        </p>
                        <ol className="space-y-1.5">
                          {agent.steps.map((s, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="text-[10px] text-slate-600 font-mono flex-shrink-0 pt-0.5 w-4 text-right">{i + 1}.</span>
                              <span className="text-xs text-slate-400 leading-relaxed">{s}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Skills */}
                    {agentSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                          <Wrench size={10} />Skills
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {agentSkills.map(sk => (
                            <span key={sk.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                              sk.type === 'script'
                                ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            }`}>
                              {sk.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Memory */}
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                        <Brain size={10} />Agent Memory
                      </p>
                      <MemoryViewer
                        memories={agentMemories[agent.id] ?? []}
                        emptyMessage="No memory files yet. The agent will write to memory as it learns."
                      />
                    </div>
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
