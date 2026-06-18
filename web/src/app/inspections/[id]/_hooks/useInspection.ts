'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import type {
  ChecklistItemResponse,
  InspectionDetail,
  InspectionReadiness,
  PhotoRequirementsResponse,
} from '@/lib/types'
import { buildChecklistFromExisting } from '../_lib/checklist'

export function useInspection(inspectionId: string) {
  const [inspection, setInspection] = useState<InspectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isNewInspection, setIsNewInspection] = useState(false)
  const [photoRequirements, setPhotoRequirements] = useState<PhotoRequirementsResponse | null>(null)
  const [readiness, setReadiness] = useState<InspectionReadiness | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError('')

      if (inspectionId === 'new') {
        setIsNewInspection(true)
        return
      }

      const result = await api.getInspection(inspectionId)
      if (result.error || !result.data) {
        setError(result.error || 'Осмотр не найден')
        return
      }

      setInspection(result.data)
      const [requirementsResult, readinessResult] = await Promise.all([
        api.getPhotoRequirements(result.data.type),
        api.getInspectionReadiness(result.data.id),
      ])
      setPhotoRequirements(requirementsResult.data || null)
      setReadiness(readinessResult.data || null)
    } catch {
      setError('Ошибка загрузки осмотра')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  return {
    inspection,
    setInspection,
    loading,
    error,
    isNewInspection,
    photoRequirements,
    readiness,
    reload: load,
  }
}

export function buildChecklistFromItems(
  type: InspectionDetail['type'],
  items?: ChecklistItemResponse[],
) {
  return buildChecklistFromExisting(type, items)
}
