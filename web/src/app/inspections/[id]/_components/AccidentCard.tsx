'use client'

import { formatDateTime } from '../_lib/checklist'
import type { InspectionDetail } from '@/lib/types'

export default function AccidentCard({
  inspection,
  accidentOccurredAt,
  setAccidentOccurredAt,
  accidentLocation,
  setAccidentLocation,
  disabled,
}: {
  inspection: InspectionDetail
  accidentOccurredAt: string
  setAccidentOccurredAt: (value: string) => void
  accidentLocation: string
  setAccidentLocation: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
      <h2 className="mb-3 text-base font-semibold text-red-800">Данные по ДТП</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Время ДТП</label>
          <input
            type="datetime-local"
            value={accidentOccurredAt}
            onChange={(event) => setAccidentOccurredAt(event.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Место ДТП</label>
          <input
            type="text"
            value={accidentLocation}
            onChange={(event) => setAccidentLocation(event.target.value)}
            disabled={disabled}
            placeholder="Например: Южно-Сахалинск, ул. Ленина, 25"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Время осмотра: {formatDateTime(inspection.created_at)}</p>
    </div>
  )
}
