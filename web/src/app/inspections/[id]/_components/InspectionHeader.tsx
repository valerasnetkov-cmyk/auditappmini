'use client'

import Link from 'next/link'
import { getTypeLabel, getTypeStyle } from '../_lib/checklist'
import type { InspectionDetail } from '@/lib/types'

export default function InspectionHeader({
  inspection,
  onPrint,
}: {
  inspection: InspectionDetail
  onPrint: () => void
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href="/inspections" className="mb-1 block text-sm text-blue-600 hover:underline">
          Назад к осмотрам
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Осмотр техники</h1>
        <p className="mt-1 text-slate-500">
          {inspection.vehicle_number} · {inspection.vehicle_name}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span className={`inline-block rounded px-2 py-1 text-xs ${getTypeStyle(inspection.type)}`}>
          {getTypeLabel(inspection.type)}
        </span>
        {inspection.type === 'accident' ? (
          <button
            onClick={onPrint}
            className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
          >
            Печать карточки ДТП
          </button>
        ) : null}
      </div>
    </div>
  )
}
