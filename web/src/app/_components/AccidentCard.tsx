'use client'

import Link from 'next/link'
import type { AccidentStats } from '@/lib/types'
import { formatDate } from '@/lib/dateUtils'

export function AccidentCard({ stats }: { stats: AccidentStats }) {
  return (
    <article className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-status-danger">Статистика ДТП</h2>
        <span className="badge badge-success">{stats.daysWithoutAccident ?? 0} дн. без ДТП</span>
      </div>
      <div className="alert-danger mb-4 rounded-card p-6 text-center">
        <div className="text-5xl font-bold text-status-danger">{stats.total || 0}</div>
        <div className="mt-1 text-sm text-foreground-secondary">Всего ДТП</div>
      </div>
      {stats.recent?.length ? (
        <div className="space-y-2">
          {stats.recent.slice(0, 3).map((accident) => (
            <div key={accident.id} className="flex items-center justify-between gap-3 rounded-card bg-muted-surface p-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-foreground">{accident.vehicle_number}</span>
                <span className="ml-2 text-foreground-muted">{accident.vehicle_name}</span>
              </div>
              <span className="shrink-0 text-foreground-muted">{formatDate(accident.created_at)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <Link href="/inspections?type=accident" className="mt-4 block text-center text-sm font-medium text-primary hover:text-primary-hover">
        Все ДТП
      </Link>
    </article>
  )
}
