'use client'

import { STAT_TONE_CLASS_NAME, type ProgressTone } from '../_lib/dashboard'

export function StatCard({ label, value, tone, code }: { label: string; value: number; tone: ProgressTone; code: string }) {
  const toneClassName = STAT_TONE_CLASS_NAME[tone]

  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={`text-3xl font-bold ${toneClassName.split(' ')[0]}`}>{value}</div>
          <div className="mt-1 text-sm text-foreground-muted">{label}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold ${toneClassName}`}>
          {code}
        </div>
      </div>
    </div>
  )
}
