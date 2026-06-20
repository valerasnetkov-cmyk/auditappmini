'use client'

/* eslint-disable @next/next/no-img-element */

import { useRef } from 'react'
import { buildApiUrl } from '@/lib/api/client'
import type { PhotoRecord, VehicleDetail } from '@/lib/types'

type Props = {
  vehicle: VehicleDetail
  photos: PhotoRecord[]
  loading: boolean
  saving: boolean
  disabled: boolean
  onUpload: (file: File) => void
  onSelect: (photoId: string) => void
}

export default function VehiclePrimaryPhotoCard({
  vehicle,
  photos,
  loading,
  saving,
  disabled,
  onUpload,
  onSelect,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const primaryUrl = vehicle.primary_photo_thumb_url || vehicle.primary_photo_webp_url || vehicle.primary_photo_url

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-foreground">Основное фото</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || saving}
            className="btn btn-secondary btn-sm disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : 'Загрузить'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onUpload(file)
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-card border border-line bg-muted-surface">
          {primaryUrl ? (
            <img
              src={buildApiUrl(primaryUrl)}
              alt={`Основное фото ${vehicle.number}`}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center px-4 text-center text-sm text-foreground-muted">
              Фото не назначено
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 text-sm font-medium text-foreground">Фото из осмотров</div>
          {loading ? (
            <div className="text-sm text-foreground-muted">Загрузка фото...</div>
          ) : photos.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {photos.map((photo) => {
                const thumbUrl = photo.thumb_url || photo.webp_url || photo.url
                const isSelected = Boolean(thumbUrl && primaryUrl && thumbUrl === primaryUrl)
                return (
                  <button
                    key={photo.id || thumbUrl}
                    type="button"
                    onClick={() => photo.id && onSelect(photo.id)}
                    disabled={disabled || saving || !photo.id}
                    className={`overflow-hidden rounded-card border text-left transition ${
                      isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-line hover:border-primary'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <img src={buildApiUrl(thumbUrl)} alt="" className="aspect-[4/3] w-full object-cover" />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-card bg-muted-surface p-4 text-sm text-foreground-muted">
              В осмотрах этой техники пока нет фото для выбора.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
