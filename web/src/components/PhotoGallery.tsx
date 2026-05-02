"use client"

import { useState } from 'react'

type Photo = {
  id?: string
  url: string
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
    return (
      <div className="text-sm text-gray-500 italic">
        Нет фото
      </div>
    )
  }

  return (
    <div>
      {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
      
      {/* Thumbnails grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
        {photos.map((photo, index) => (
          <button
            key={index}
            onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
              selectedIndex === index ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
            }`}
            style={{ height: maxHeight }}
          >
            <img 
              src={photo.url} 
              alt={`Фото ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(index)
                }}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
              >
                ×
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-gray-500">
        Всего фото: {photos.length}
      </p>
    </div>
  )
}