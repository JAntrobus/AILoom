import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Lock, Unlock, Calendar, User, Mail, Star, Zap, Crown } from 'lucide-react'
import { api } from '../api/client'
import GlassCard from '../components/GlassCard'

interface LicenseInfo {
  tier: string
  licensee: string
  email: string
  features: string[]
  max_projects: number
  max_agents: number
  issued_at: string
  expires_at: string
  is_expired: boolean
  summary: string
}

interface Feature {
  id: string
  name: string
  description: string
  enabled: boolean
  tier: string
}

const tierColors: Record<string, { gradient: string; icon: React.ReactNode; badge: string }> = {
  community:    { gradient: 'from-slate-600 to-slate-700', icon: <Zap size={18} className="text-white" />, badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  professional: { gradient: 'from-violet-600 to-blue-600', icon: <Star size={18} className="text-white" />, badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  enterprise:   { gradient: 'from-amber-500 to-orange-600', icon: <Crown size={18} className="text-white" />, badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
}

export default function LicensePage() {
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/license').then(r => r.json()),
      fetch('/api/features').then(r => r.json()),
    ]).then(([lic, feats]) => {
      setLicense(lic)
      setFeatures(feats)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )

  if (!license) return <div className="text-center py-20 text-slate-500">Could not load license info</div>

  const tc = tierColors[license.tier] ?? tierColors.community
  const professionalFeatures = features.filter(f => f.tier === 'professional')
  const enterpriseFeatures = features.filter(f => f.tier === 'enterprise')

  const daysUntilExpiry = license.expires_at
    ? Math.ceil((new Date(license.expires_at).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">License</h1>
        <p className="page-subtitle">Your AILoom license and feature entitlements</p>
      </div>

      {/* License card */}
      <div className={`relative glass rounded-2xl overflow-hidden`}>
        {/* Gradient header strip */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${tc.gradient}`} />

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${tc.gradient} shadow-lg flex-shrink-0`}>
                {tc.icon}
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-0.5">
                  <h2 className="text-lg font-bold text-white capitalize">{license.tier} Edition</h2>
                  {license.is_expired ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Expired</span>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${tc.badge}`}>Active</span>
                  )}
                </div>
                <p className="text-sm text-slate-400">{license.summary}</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {license.is_expired
                ? <ShieldAlert size={24} className="text-red-400" />
                : <ShieldCheck size={24} className="text-emerald-400" />}
            </div>
          </div>

          {license.tier !== 'community' && (
            <div className="mt-5 pt-5 border-t border-white/8 grid grid-cols-2 gap-4">
              {[
                { icon: <User size={13} />, label: 'Licensee', value: license.licensee || '—' },
                { icon: <Mail size={13} />, label: 'Email', value: license.email || '—' },
                { icon: <Calendar size={13} />, label: 'Issued', value: license.issued_at ? new Date(license.issued_at).toLocaleDateString() : '—' },
                {
                  icon: <Calendar size={13} />,
                  label: 'Expires',
                  value: license.expires_at
                    ? `${new Date(license.expires_at).toLocaleDateString()}${daysUntilExpiry !== null && daysUntilExpiry > 0 ? ` (${daysUntilExpiry}d)` : ''}`
                    : 'Never',
                },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-slate-600 mt-0.5 flex-shrink-0">{icon}</span>
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Limits */}
          {(license.max_projects > 0 || license.max_agents > 0) && (
            <div className="mt-4 flex gap-3">
              {license.max_projects > 0 && (
                <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/8">
                  Max {license.max_projects} projects
                </span>
              )}
              {license.max_agents > 0 && (
                <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/8">
                  Max {license.max_agents} agent{license.max_agents !== 1 ? 's' : ''} per workflow
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feature grid */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">Feature Entitlements</h3>

        {[
          { tier: 'professional', label: 'Professional', feats: professionalFeatures, gradient: 'from-violet-600 to-blue-600' },
          { tier: 'enterprise',   label: 'Enterprise',   feats: enterpriseFeatures,   gradient: 'from-amber-500 to-orange-600' },
        ].map(group => (
          <div key={group.tier}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-px flex-1 bg-gradient-to-r ${group.gradient} opacity-30`} />
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border
                ${group.tier === 'professional' ? 'text-violet-400 border-violet-500/30 bg-violet-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                {group.label}
              </span>
              <div className={`h-px flex-1 bg-gradient-to-l ${group.gradient} opacity-30`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.feats.map(feat => (
                <div
                  key={feat.id}
                  className={`glass rounded-xl p-4 flex items-start gap-3 transition-all ${
                    feat.enabled ? '' : 'opacity-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    feat.enabled
                      ? 'bg-emerald-500/15 border border-emerald-500/25'
                      : 'bg-white/5 border border-white/8'
                  }`}>
                    {feat.enabled
                      ? <Unlock size={14} className="text-emerald-400" />
                      : <Lock size={14} className="text-slate-600" />}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${feat.enabled ? 'text-white' : 'text-slate-500'}`}>{feat.name}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{feat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade CTA for community */}
      {license.tier === 'community' && (
        <GlassCard className="border-violet-500/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/30">
              <Star size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-0.5">Upgrade to Professional</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unlock multi-agent workflows, analytics, advanced branching and unlimited projects.
                Contact your AILoom vendor with a generated license file.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-slate-500 font-mono">
              # Generate your license file using the vendor tool:<br />
              ./ailoom-licensegen create --tier professional --licensee "Your Company" ...
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
