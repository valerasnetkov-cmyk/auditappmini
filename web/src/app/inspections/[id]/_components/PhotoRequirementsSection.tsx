'use client'

import Image from 'next/image'
import { useState } from 'react'
import { buildApiUrl } from '@/lib/api/client'
import { getPhotoPreviewUrl, getPhotoThumbUrl } from '../_lib/checklist'
import type { PhotoRecord, PhotoRequirementsResponse } from '@/lib/types'
import { Badge, ProgressBar } from '@/components/ui'

type SelectedPhoto = {
  photo: PhotoRecord
  label: string
}

export default function PhotoRequirementsSection({
  requirements,
  inspectionPhotos,
}: {
  requirements: PhotoRequirementsResponse
  inspectionPhotos: Record<string, PhotoRecord[]>
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null)
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
                      onClick={() => setSelectedPhoto({ photo, label })}
                      className="rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
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
      {selectedPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{selectedPhoto.label}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedPhoto.photo.captured_at ? new Date(selectedPhoto.photo.captured_at).toLocaleString('ru-RU') : 'Дата съёмки не указана'}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <a
                  href={buildApiUrl(selectedPhoto.photo.original_url || getPhotoPreviewUrl(selectedPhoto.photo))}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                >
                  Открыть полную версию
                </a>
                <button type="button" className="text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={() => setSelectedPhoto(null)}>
                  Закрыть
                </button>
              </div>
            </div>
            <div className="flex max-h-[calc(92vh-64px)] items-center justify-center bg-slate-950 p-3">
              <Image
                src={buildApiUrl(selectedPhoto.photo.webp_url || getPhotoPreviewUrl(selectedPhoto.photo))}
                alt={selectedPhoto.label}
                width={1280}
                height={960}
                unoptimized
                className="max-h-[calc(92vh-88px)] w-auto max-w-full rounded object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
