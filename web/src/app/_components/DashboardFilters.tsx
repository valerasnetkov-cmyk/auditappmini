'use client'

import type { ExportType } from '@/lib/types'
import { RANGE_LABELS, type DateRange } from '../_lib/dashboard'

export function DashboardFilters({
  dateRange,
  customFrom,
  customTo,
  analyticsEnabled,
  exportEnabled,
  onRangeChange,
  onCustomFromChange,
  onCustomToChange,
  onExport,
}: {
  dateRange: DateRange
  customFrom: string
  customTo: string
  analyticsEnabled: boolean
  exportEnabled: boolean
  onRangeChange: (range: DateRange) => void
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  onExport: (type: ExportType) => void
}) {
  return (
    <section className="card mb-6 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground-secondary">Период:</span>
          <select
            value={dateRange}
            disabled={!analyticsEnabled}
            onChange={(event) => onRangeChange(event.target.value as DateRange)}
            className="select w-auto min-w-40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((range) => (
              <option key={range} value={range}>
                {RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </div>

        {dateRange === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customFrom}
              disabled={!analyticsEnabled}
              onChange={(event) => onCustomFromChange(event.target.value)}
              className="input w-auto disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="text-foreground-muted">-</span>
            <input
              type="date"
              value={customTo}
              disabled={!analyticsEnabled}
              onChange={(event) => onCustomToChange(event.target.value)}
              className="input w-auto disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 xl:ml-auto">
          <button onClick={() => onExport('vehicles')} disabled={!exportEnabled} className="btn btn-success disabled:cursor-not-allowed disabled:opacity-60">
            Excel техники
          </button>
          <button onClick={() => onExport('inspections')} disabled={!exportEnabled} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">
            Excel осмотров
          </button>
        </div>
      </div>
      {!analyticsEnabled ? (
        <p className="mt-3 rounded-card bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Аналитика, фильтры периода и экспорт отключены текущим тарифом компании.
        </p>
      ) : !exportEnabled ? (
        <p className="mt-3 rounded-card bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Экспорт отчётов отключён текущим тарифом компании.
        </p>
      ) : null}
    </section>
  )
}
