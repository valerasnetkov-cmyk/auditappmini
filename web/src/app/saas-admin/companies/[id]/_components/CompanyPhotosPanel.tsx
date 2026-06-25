'use client'

import Image from 'next/image'
import { useState } from 'react'
import api, { buildApiUrl } from '@/lib/api/client'
import type { ResourceCompanyPhoto } from '@/lib/types'
import { formatDate } from '../_lib/companyDetail'

function getThumbUrl(photo: ResourceCompanyPhoto) {
  return photo.thumb_url || photo.webp_url || photo.url
}

function getFullUrl(photo: ResourceCompanyPhoto) {
  return photo.original_url || photo.webp_url || photo.url
}

function getPreviewUrl(photo: ResourceCompanyPhoto) {
  return photo.watermark_url || photo.webp_url || photo.url
}

function getCoordinates(photo: ResourceCompanyPhoto) {
  if (photo.captured_lat !== null && photo.captured_lat !== undefined
    && photo.captured_lng !== null && photo.captured_lng !== undefined) {
    return `${photo.captured_lat}, ${photo.captured_lng}`
  }
  return photo.geo || 'не указаны'
}

export default function CompanyPhotosPanel({
  companyId,
  photos,
  onPhotoUpdated,
}: {
  companyId: string
  photos: ResourceCompanyPhoto[]
  onPhotoUpdated: (photo: ResourceCompanyPhoto) => void
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<ResourceCompanyPhoto | null>(null)
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const openPhoto = async (photo: ResourceCompanyPhoto) => {
    setError('')
    setSelectedPhoto(photo)
    if (!photo.id || photo.watermark_url) return

    setLoadingPhotoId(photo.id)
    try {
      const result = await api.createResourceCompanyPhotoWatermark(companyId, photo.id)
      if (result.data) {
        setSelectedPhoto(result.data)
        onPhotoUpdated(result.data)
      } else {
        setError(result.error || 'Не удалось добавить водяной знак')
      }
    } finally {
      setLoadingPhotoId(null)
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Фото компании</h2>
          <p className="mt-1 text-sm text-gray-500">Последние фото осмотров открываются внутри панели с водяным знаком.</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{photos.length} фото</span>
      </div>

      {photos.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {photos.map((photo) => (
            <button
              key={photo.id || photo.url}
              type="button"
              onClick={() => void openPhoto(photo)}
              className="group overflow-hidden rounded border bg-gray-50 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <Image
                src={buildApiUrl(getThumbUrl(photo))}
                alt={photo.defect_title || photo.photo_type || 'Фото осмотра'}
                width={240}
                height={160}
                unoptimized
                className="h-32 w-full object-cover"
              />
              <div className="space-y-1 p-2">
                <div className="truncate text-sm font-medium text-gray-900">{photo.vehicle_number || 'Техника не указана'}</div>
                <div className="truncate text-xs text-gray-500">{photo.defect_title || photo.photo_type || photo.inspection_type || 'Фото осмотра'}</div>
                <div className="text-xs text-gray-400">{formatDate(photo.captured_at || photo.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-sm text-gray-500">Фото по компании пока не загружены.</div>
      )}

      {selectedPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото компании"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-950">{selectedPhoto.vehicle_number || 'Фото осмотра'}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Координаты: {getCoordinates(selectedPhoto)} · Дата: {formatDate(selectedPhoto.captured_at || selectedPhoto.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={buildApiUrl(getFullUrl(selectedPhoto))}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Открыть полную версию
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPhoto(null)}
                  className="rounded border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Закрыть
                </button>
              </div>
            </div>
            <div className="bg-gray-950 p-3">
              {loadingPhotoId === selectedPhoto.id ? (
                <div className="flex h-[60vh] items-center justify-center text-sm text-white">Добавляем водяной знак...</div>
              ) : (
                <Image
                  src={buildApiUrl(getPreviewUrl(selectedPhoto))}
                  alt={selectedPhoto.defect_title || 'Фото с водяным знаком'}
                  width={1280}
                  height={860}
                  unoptimized
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
            </div>
            {error ? <div className="border-t bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
