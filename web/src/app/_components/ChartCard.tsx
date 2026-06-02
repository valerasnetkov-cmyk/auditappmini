'use client'

import type { ReactNode } from 'react'
import { getChartTitleToneClassName, type ProgressTone } from '../_lib/dashboard'

export function ChartCard({ title, tone, children }: { title: string; tone: ProgressTone; children: ReactNode }) {
  return (
    <article className="card p-6">
      <h2 className={`mb-4 text-lg font-bold ${getChartTitleToneClassName(tone)}`}>{title}</h2>
      {children}
    </article>
  )
}
