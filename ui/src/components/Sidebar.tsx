import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, Bot, Cpu, Plus,
  Zap, ChevronRight,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/platforms', icon: Cpu, label: 'Platforms' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col border-r border-white/8"
      style={{ background: 'rgba(8,9,18,0.85)', backdropFilter: 'blur(24px)' }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-900/40">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide">AILoom</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Agent Orchestration</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 pt-5 pb-3">
        <button
          onClick={() => navigate('/projects/new')}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                     bg-violet-600/20 border border-violet-500/30 text-violet-300
                     hover:bg-violet-600/30 hover:border-violet-500/50 hover:text-violet-200
                     transition-all duration-150 text-sm font-medium group"
        >
          <span className="flex items-center gap-2">
            <Plus size={14} />
            New Project
          </span>
          <ChevronRight size={12} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
          Navigation
        </p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-violet-400' : ''} />
                {label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/8">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
            U
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">User</p>
            <p className="text-[10px] text-slate-600">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
