'use client'

import Link from 'next/link'
import { buildApiUrl } from '@/lib/api/client'
import { formatDateTime, getPhotoPreviewUrl, getPhotoThumbUrl } from '../_lib/checklist'
import type { InspectionDetail } from '@/lib/types'

export default function DefectsList({ inspection }: { inspection: InspectionDetail }) {
  if (!inspection.defects.length) return null

  return (
    <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Все дефекты осмотра ({inspection.defects.length})
      </h2>
      <div className="space-y-4">
        {inspection.defects.map((defect) => (
          <div key={defect.id} className="rounded-lg border bg-slate-50 p-4">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-slate-900">{defect.title}</div>
                {defect.comment ? <p className="mt-1 text-sm text-slate-600">{defect.comment}</p> : null}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">{formatDateTime(defect.created_at)}</div>
                <Link href={`/defects/${defect.id}`} className="text-xs text-blue-600 hover:underline">
                  Подробнее
                </Link>
              </div>
            </div>

            {inspection.type === 'accident' ? (
              <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                ДТП: {formatDateTime(inspection.accident_occurred_at)} ·{' '}
                {inspection.accident_location || 'Место не указано'}
              </div>
            ) : null}

            {defect.photos.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {defect.photos.map((photo, index) => (
                  <button
                    key={`${photo.url}-${index}`}
                    type="button"
                    onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}
                  >
                    <img
                      src={buildApiUrl(getPhotoThumbUrl(photo))}
                      alt="Фото дефекта"
                      className="h-24 w-24 rounded border object-cover hover:opacity-80"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400">Нет фото</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
