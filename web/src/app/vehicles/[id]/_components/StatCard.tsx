'use client'

import type { StatTone } from '../_lib/vehicleDetail'

const toneClassName: Record<StatTone, string> = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  info: 'text-status-info',
}

type Props = {
  label: string
  value: number | string
  tone: StatTone
}

export default function StatCard({ label, value, tone }: Props) {
  return (
    <div className="card p-4 text-center">
      <div className={`text-2xl font-bold ${toneClassName[tone]}`}>{value}</div>
      <div className="text-sm text-foreground-muted">{label}</div>
    </div>
  )
}
