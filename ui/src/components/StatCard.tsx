import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: string
  color?: 'violet' | 'blue' | 'emerald' | 'amber'
}

const colors = {
  violet: { icon: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'shadow-violet-900/20' },
  blue:   { icon: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   glow: 'shadow-blue-900/20' },
  emerald:{ icon: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',glow: 'shadow-emerald-900/20' },
  amber:  { icon: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  glow: 'shadow-amber-900/20' },
}

export default function StatCard({ label, value, icon: Icon, trend, color = 'violet' }: Props) {
  const c = colors[color]
  return (
    <div className={`glass rounded-2xl p-5 shadow-lg ${c.glow}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${c.bg} ${c.border}`}>
          <Icon size={18} className={c.icon} />
        </div>
      </div>
    </div>
  )
}
