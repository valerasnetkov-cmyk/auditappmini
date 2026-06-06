'use client'

import { useCallback, useState } from 'react'
import api from '@/lib/api/client'
import type { UpdateVehiclePayload, VehicleDetail, VehicleStatus } from '@/lib/types'

type Guard = {
  loading: boolean
  restrictionTitle?: string
  restrictionMessage?: string
  setError: (text: string) => void
}

export function useStatusModal(guard: Guard) {
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState<VehicleStatus>('')
  const [statusReason, setStatusReason] = useState('')
  const [updating, setUpdating] = useState(false)

  const openStatusModal = useCallback((current: VehicleStatus) => {
    setNewStatus(current)
    setShowStatusModal(true)
  }, [])

  const closeStatusModal = useCallback(() => {
    setShowStatusModal(false)
    setStatusReason('')
  }, [])

  const handleStatusChange = useCallback(async (
    vehicle: VehicleDetail,
    vehicleId: string,
    showToast: (msg: string) => void,
    onUpdated: (next: VehicleDetail) => void,
    reloadHistory: () => Promise<void>,
  ) => {
    if (!newStatus || !vehicle) return
    if (guard.loading) {
      guard.setError('Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
      return
    }
    if (guard.restrictionTitle && guard.restrictionMessage) {
      guard.setError(`${guard.restrictionTitle}: ${guard.restrictionMessage}`)
      return
    }

    setUpdating(true)
    try {
      const payload: UpdateVehiclePayload = {
        number: vehicle.number,
        name: vehicle.name,
        status: newStatus,
        region: vehicle.region || undefined,
        reason: statusReason.trim() || undefined,
      }

      const result = await api.updateVehicle(vehicleId, payload)
      if (result.error) {
        guard.setError(result.error)
        return
      }

      onUpdated(result.data || vehicle)
      closeStatusModal()
      showToast('Статус техники обновлен')
      await reloadHistory()
    } finally {
      setUpdating(false)
    }
  }, [guard, newStatus, statusReason, closeStatusModal])

  return {
    showStatusModal,
    newStatus,
    setNewStatus,
    statusReason,
    setStatusReason,
    updating,
    openStatusModal,
    closeStatusModal,
    handleStatusChange,
  }
}
