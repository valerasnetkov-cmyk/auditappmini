'use client'

import { buildApiUrl } from '@/lib/api/client'
import { getPhotoPreviewUrl, getPhotoThumbUrl } from '../_lib/checklist'
import type { PhotoRecord, PhotoRequirementsResponse } from '@/lib/types'

export default function PhotoRequirementsSection({
  requirements,
  inspectionPhotos,
  uploadingPhoto,
  deletingPhoto,
  onUpload,
  onDelete,
  disabled,
}: {
  requirements: PhotoRequirementsResponse
  inspectionPhotos: Record<string, PhotoRecord[]>
  uploadingPhoto: string | null
  deletingPhoto: string | null
  onUpload: (photoType: string, file: File) => void
  onDelete: (photoType: string, photoIndex: number) => void
  disabled: boolean
}) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Обязательные фото осмотра</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {requirements.requirements.required.map((photoType) => {
          const photos = inspectionPhotos[photoType] || []
          const label = requirements.labels[photoType] || photoType

          return (
            <div key={photoType} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    photos.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {photos.length ? 'Добавлено' : 'Требуется'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {photos.map((photo, photoIndex) => (
                  <div key={`${photo.url}-${photoIndex}`} className="group relative">
                    <button
                      type="button"
                      onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}
                    >
                      <img
                        src={buildApiUrl(getPhotoThumbUrl(photo))}
                        alt={label}
                        className="h-20 w-20 rounded border object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(photoType, photoIndex)}
                      disabled={deletingPhoto === `${photoType}-${photoIndex}` || disabled}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {deletingPhoto === `${photoType}-${photoIndex}` ? '...' : 'x'}
                    </button>
                  </div>
                ))}

                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-slate-300 transition-colors hover:border-blue-400 hover:bg-blue-50">
                  {uploadingPhoto === photoType ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  ) : (
                    <span className="text-2xl text-slate-400">+</span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={disabled}
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files?.[0]) {
                        onUpload(photoType, event.target.files[0])
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
