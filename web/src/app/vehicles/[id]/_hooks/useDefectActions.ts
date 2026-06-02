'use client'

import { useCallback, useState } from 'react'
import api, { buildApiUrl } from '@/lib/api/client'
import { getAuthToken } from '@/lib/auth'
import type { DefectHistoryEntry } from '../_lib/vehicleDetail'

type Guard = {
  loading: boolean
  restrictionTitle?: string
  restrictionMessage?: string
  setError: (text: string) => void
}

export function useDefectActions(guard: Guard) {
  const [defectHistories, setDefectHistories] = useState<Record<string, DefectHistoryEntry[]>>({})
  const [defectHistoriesVisible, setDefectHistoriesVisible] = useState<Record<string, boolean>>({})

  const guardOrError = useCallback((): boolean => {
    if (guard.loading) {
      guard.setError('Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
      return true
    }
    if (guard.restrictionTitle && guard.restrictionMessage) {
      guard.setError(`${guard.restrictionTitle}: ${guard.restrictionMessage}`)
      return true
    }
    return false
  }, [guard])

  const closeDefect = useCallback(async (
    defectId: string,
    reloadDefectsImpl: () => Promise<void>,
    showToast: (msg: string) => void,
  ) => {
    if (guardOrError()) return
    const result = await api.closeDefect(defectId)
    if (result.error) {
      guard.setError(result.error)
      return
    }
    await reloadDefectsImpl()
    showToast('Дефект закрыт')
  }, [guard, guardOrError])

  const reopenDefect = useCallback(async (
    defectId: string,
    reloadDefectsImpl: () => Promise<void>,
    showToast: (msg: string) => void,
  ) => {
    if (guardOrError()) return
    const result = await api.reopenDefect(defectId)
    if (result.error) {
      guard.setError(result.error)
      return
    }
    await reloadDefectsImpl()
    showToast('Дефект повторно открыт')
  }, [guard, guardOrError])

  const toggleDefectHistory = useCallback(async (defectId: string) => {
    const isVisible = defectHistoriesVisible[defectId] ?? false
    if (isVisible) {
      setDefectHistoriesVisible((current) => ({ ...current, [defectId]: false }))
      return
    }

    try {
      const token = getAuthToken()
      const response = await fetch(buildApiUrl(`/api/defects/${defectId}/history`), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      })
      const data = await response.json()
      setDefectHistories((current) => ({ ...current, [defectId]: data || [] }))
      setDefectHistoriesVisible((current) => ({ ...current, [defectId]: true }))
    } catch {
      setDefectHistoriesVisible((current) => ({ ...current, [defectId]: false }))
    }
  }, [defectHistoriesVisible])

  return { defectHistories, defectHistoriesVisible, closeDefect, reopenDefect, toggleDefectHistory }
}
