'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import type { InspectionDetail, PhotoRecord } from '@/lib/types'

function syncPhotos(
  setDefect: (value: React.SetStateAction<Record<string, PhotoRecord[]>>) => void,
  setInspection: (value: React.SetStateAction<Record<string, PhotoRecord[]>>) => void,
  next: InspectionDetail | null,
) {
  if (!next) {
    setDefect({})
    setInspection({})
    return
  }
  const byTitle: Record<string, PhotoRecord[]> = {}
  next.defects.forEach((defect) => {
    byTitle[defect.title] = defect.photos || []
  })
  setDefect(byTitle)

  const byType: Record<string, PhotoRecord[]> = {}
  ;(next.photos || []).forEach((photo) => {
    const photoType = photo.photo_type || 'additional'
    byType[photoType] = byType[photoType] || []
    byType[photoType].push(photo)
  })
  setInspection(byType)
}

export function usePhotoUpload(inspection: InspectionDetail | null) {
  const [defectPhotos, setDefectPhotos] = useState<Record<string, PhotoRecord[]>>({})
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, PhotoRecord[]>>({})
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null)

  useEffect(() => {
    syncPhotos(setDefectPhotos, setInspectionPhotos, inspection)
  }, [inspection])

  const uploadDefectPhoto = useCallback(
    async (defectTitle: string, file: File, onError?: (message: string) => void) => {
      if (!inspection) {
        onError?.('Сначала сохраните осмотр, затем можно добавить фото дефекта')
        return
      }
      const defect = inspection.defects.find((item) => item.title === defectTitle)
      if (!defect) {
        onError?.('Сначала сохраните осмотр, затем можно добавить фото дефекта')
        return
      }

      setUploadingPhoto(defectTitle)
      try {
        const result = await api.uploadPhoto(defect.id, file)
        if (result.error || !result.data?.url) {
          onError?.(result.error || 'Не удалось загрузить фото')
          return
        }
        const uploaded: PhotoRecord = { ...result.data, url: result.data.url }
        setDefectPhotos((prev) => ({
          ...prev,
          [defectTitle]: [...(prev[defectTitle] || []), uploaded],
        }))
      } finally {
        setUploadingPhoto(null)
      }
    },
    [inspection],
  )

  const uploadInspectionPhoto = useCallback(
    async (photoType: string, file: File, onError?: (message: string) => void) => {
      if (!inspection) return

      setUploadingPhoto(photoType)
      try {
        const result = await api.uploadInspectionPhoto(inspection.id, photoType, file)
        if (result.error || !result.data?.url) {
          onError?.(result.error || 'Не удалось загрузить фото осмотра')
          return
        }
        const uploaded: PhotoRecord = {
          ...result.data,
          id: result.data.id,
          url: result.data.url,
          photo_type: photoType,
          geo: result.data.geo,
        }
        setInspectionPhotos((prev) => ({
          ...prev,
          [photoType]: [...(prev[photoType] || []), uploaded],
        }))
      } finally {
        setUploadingPhoto(null)
      }
    },
    [inspection],
  )

  const deleteDefectPhoto = useCallback(
    async (
      defectTitle: string,
      photoId: string | undefined,
      photoIndex: number,
      onError?: (message: string) => void,
    ) => {
      if (!photoId) return
      setDeletingPhoto(`${defectTitle}-${photoIndex}`)
      try {
        const result = await api.deletePhoto(photoId)
        if (result.error) {
          onError?.(result.error)
          return
        }
        setDefectPhotos((prev) => ({
          ...prev,
          [defectTitle]: (prev[defectTitle] || []).filter((_, index) => index !== photoIndex),
        }))
      } finally {
        setDeletingPhoto(null)
      }
    },
    [],
  )

  const deleteInspectionPhoto = useCallback(
    async (
      photoType: string,
      photoId: string | undefined,
      photoIndex: number,
      onError?: (message: string) => void,
    ) => {
      if (!photoId) return
      setDeletingPhoto(`${photoType}-${photoIndex}`)
      try {
        const result = await api.deletePhoto(photoId)
        if (result.error) {
          onError?.(result.error)
          return
        }
        setInspectionPhotos((prev) => ({
          ...prev,
          [photoType]: (prev[photoType] || []).filter((_, index) => index !== photoIndex),
        }))
      } finally {
        setDeletingPhoto(null)
      }
    },
    [],
  )

  return {
    defectPhotos,
    inspectionPhotos,
    uploadingPhoto,
    deletingPhoto,
    uploadDefectPhoto,
    uploadInspectionPhoto,
    deleteDefectPhoto,
    deleteInspectionPhoto,
  }
}
