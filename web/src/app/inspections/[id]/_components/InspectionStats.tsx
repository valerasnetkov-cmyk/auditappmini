'use client'

import { formatDateTime, getPhotoCount } from '../_lib/checklist'
import type { InspectionDetail } from '@/lib/types'

export default function InspectionStats({ inspection }: { inspection: InspectionDetail }) {
  const defectsCount = (inspection.defects || []).length
  const photoTotal = getPhotoCount(inspection.defects || [])
  const durationLabel = formatDuration(inspection.duration_seconds, inspection.completed)

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-5">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">Время осмотра</div>
        <div className="mt-1 font-semibold text-slate-900">{formatDateTime(inspection.created_at)}</div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">Инспектор</div>
        <div className="mt-1 font-semibold text-slate-900">{inspection.inspector_name || 'Не указано'}</div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">Длительность</div>
        <div className="mt-1 font-semibold text-slate-900">{durationLabel}</div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">Дефекты</div>
        <div className="mt-1 text-2xl font-bold text-red-600">{defectsCount}</div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">Фото дефектов</div>
        <div className="mt-1 text-2xl font-bold text-blue-600">{photoTotal}</div>
      </div>
    </div>
  )
}

function formatDuration(seconds?: number | null, completed?: number | boolean) {
  if (!completed || seconds === null || seconds === undefined) return 'Осмотр не завершён'
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} мин`
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`
}
