'use client'

import Image from 'next/image'
import { buildApiUrl } from '@/lib/api/client'
import { getPhotoPreviewUrl, getPhotoThumbUrl } from '../_lib/checklist'
import type { PhotoRecord, PhotoRequirementsResponse } from '@/lib/types'
import { Badge, ProgressBar } from '@/components/ui'

export default function PhotoRequirementsSection({
  requirements,
  inspectionPhotos,
}: {
  requirements: PhotoRequirementsResponse
  inspectionPhotos: Record<string, PhotoRecord[]>
}) {
  const required = requirements.requirements.required
  const completedCount = required.filter((photoType) => (inspectionPhotos[photoType] || []).length > 0).length
  const displayed = requirements.type === 'accident' && requirements.requirements.optional.includes('odometer')
    ? [...required, 'odometer']
    : required

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Обязательные фото осмотра</h2>
        <div className="mt-3">
          <ProgressBar
            value={completedCount}
            max={required.length || 1}
            label="Готовность фото"
            detail={`${completedCount} из ${required.length}`}
            tone={completedCount === required.length ? 'success' : 'warning'}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayed.map((photoType) => {
          const photos = inspectionPhotos[photoType] || []
          const label = requirements.labels[photoType] || photoType

          return (
            <div key={photoType} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <Badge tone={photos.length ? 'success' : 'warning'}>
                  {photos.length ? 'Добавлено' : required.includes(photoType) ? 'Требуется' : 'Необязательно'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {photos.map((photo, photoIndex) => (
                  <div key={`${photo.url}-${photoIndex}`} className="group relative">
                    <button
                      type="button"
                      onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}
                    >
                      <Image
                        src={buildApiUrl(getPhotoThumbUrl(photo))}
                        alt={label}
                        width={80}
                        height={80}
                        unoptimized
                        className="h-20 w-20 rounded border object-cover"
                      />
                    </button>
                  </div>
                ))}
                {!photos.length ? (
                  <span className="text-xs text-slate-400">Фото пока не загружено из мобильного осмотра</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
