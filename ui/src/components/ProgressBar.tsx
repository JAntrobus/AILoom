interface Props {
  value: number   // 0–100
  size?: 'sm' | 'md'
  color?: 'violet' | 'blue' | 'emerald' | 'amber' | 'red'
  showLabel?: boolean
  animated?: boolean
}

const colors = {
  violet: 'from-violet-600 to-violet-400',
  blue:   'from-blue-600 to-blue-400',
  emerald:'from-emerald-600 to-emerald-400',
  amber:  'from-amber-500 to-amber-400',
  red:    'from-red-600 to-red-400',
}

export default function ProgressBar({ value, size = 'md', color = 'violet', showLabel = false, animated = false }: Props) {
  const pct = Math.min(100, Math.max(0, value))
  const h = size === 'sm' ? 'h-1' : 'h-1.5'
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-white/8 overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors[color]} transition-all duration-500 ${animated ? 'animate-pulse-slow' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
      )}
    </div>
  )
}
