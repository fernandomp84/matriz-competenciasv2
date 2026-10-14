import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  color?: 'navy' | 'emerald' | 'red' | 'amber' | 'slate'
}

const colorMap = {
  navy:    { ring: 'bg-brand-50',   icon: 'text-brand-700',   dot: 'bg-brand-700' },
  emerald: { ring: 'bg-emerald-50', icon: 'text-emerald-700', dot: 'bg-emerald-600' },
  red:     { ring: 'bg-red-50',     icon: 'text-red-600',     dot: 'bg-red-500' },
  amber:   { ring: 'bg-amber-50',   icon: 'text-amber-700',   dot: 'bg-amber-500' },
  slate:   { ring: 'bg-slate-100',  icon: 'text-slate-500',   dot: 'bg-slate-400' },
}

export default function StatsCard({ icon: Icon, label, value, sub, color = 'navy' }: Props) {
  const c = colorMap[color]
  return (
    <div className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow duration-200">
      <div className={`w-11 h-11 rounded-xl ${c.ring} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="mt-1 text-2xl font-bold text-brand-700 leading-none tabular-nums">{value}</p>
        {sub && <p className="mt-1.5 text-xs text-slate-400 leading-snug">{sub}</p>}
      </div>
    </div>
  )
}
