'use client'
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { buildApiUrl } from '@/lib/api/client'

type Photo = {
  id?: string
  url: string
  webp_url?: string | null
  thumb_url?: string | null
  geo?: string | null
}

type PhotoGalleryProps = {
  photos: Photo[]
  title?: string
  onDelete?: (index: number) => void
  maxHeight?: string
}

export default function PhotoGallery({ photos, title, onDelete, maxHeight = '200px' }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (!photos || photos.length === 0) {
    return <div className="text-sm italic text-slate-500">Нет фото</div>
  }

  return (
    <div>
      {title ? <h4 className="mb-2 text-sm font-medium">{title}</h4> : null}

      <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            key={`${photo.url}-${index}`}
            onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
            className={`relative overflow-hidden rounded-lg border-2 transition-all ${
              selectedIndex === index ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-slate-300'
            }`}
            style={{ height: maxHeight }}
            type="button"
          >
            <img
              src={buildApiUrl(photo.thumb_url || photo.webp_url || photo.url)}
              alt={`Фото ${index + 1}`}
              className="h-full w-full object-cover"
            />
            {onDelete ? (
              <span
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(index)
                }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                role="button"
                tabIndex={0}
              >
                x
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">Всего фото: {photos.length}</p>
    </div>
  )
}
