'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import type { InspectionRecord, VehicleDefectHistoryItem, VehicleDetail, VehicleHistoryEntry } from '@/lib/types'

export function useVehicleDetailData(vehicleId: string) {
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [history, setHistory] = useState<VehicleHistoryEntry[]>([])
  const [defects, setDefects] = useState<VehicleDefectHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [vehicleRes, inspectionsRes, historyRes, defectsRes] = await Promise.all([
        api.getVehicle(vehicleId),
        api.getVehicleInspections(vehicleId, { limit: 50 }),
        api.getVehicleHistory(vehicleId),
        api.getVehicleDefects(vehicleId, { limit: 100 }),
      ])

      if (vehicleRes.error) {
        setError(vehicleRes.error)
        return
      }

      setVehicle(vehicleRes.data || null)
      setInspections(inspectionsRes.data || [])
      setHistory(historyRes.data || [])
      setDefects(defectsRes.data || [])
    } catch {
      setError('Не удалось загрузить данные по технике')
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  const reloadDefects = useCallback(async () => {
    const result = await api.getVehicleDefects(vehicleId, { limit: 100 })
    setDefects(result.data || [])
  }, [vehicleId])

  const reloadHistory = useCallback(async () => {
    const result = await api.getVehicleHistory(vehicleId)
    setHistory(result.data || [])
  }, [vehicleId])

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
  }, [loadData])

  return {
    vehicle, setVehicle,
    inspections, setInspections,
    history, setHistory,
    defects, setDefects,
    loading, setLoading,
    error, setError,
    loadData, reloadDefects, reloadHistory,
  }
}

export type VehicleDetailData = ReturnType<typeof useVehicleDetailData>
