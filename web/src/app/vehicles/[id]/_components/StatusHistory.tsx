'use client'

import { formatDate } from '@/lib/dateUtils'
import type { VehicleHistoryEntry } from '@/lib/types'
import { getVehicleStatusBadgeClass, getVehicleStatusLabel } from '../_lib/vehicleDetail'

type Props = {
  history: VehicleHistoryEntry[]
}

export default function StatusHistory({ history }: Props) {
  if (!history.length) return null

  return (
    <section className="table-card mt-6">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">История изменения статуса</h2>
      </div>
      <div className="divide-y divide-line">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={getVehicleStatusBadgeClass(entry.old_status)}>
                {getVehicleStatusLabel(entry.old_status)}
              </span>
              <span className="text-foreground-muted">→</span>
              <span className={getVehicleStatusBadgeClass(entry.new_status)}>
                {getVehicleStatusLabel(entry.new_status)}
              </span>
              {entry.reason ? <span className="italic text-foreground-muted">&quot;{entry.reason}&quot;</span> : null}
            </div>
            <div className="text-xs text-foreground-muted">
              {formatDate(entry.created_at)}
              {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ''}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
