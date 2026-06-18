'use client'

import { useEffect, useState } from 'react'
import type { InspectionDetail } from '@/lib/types'

function syncOdometer(
  setValue: (value: string) => void,
  setUnit: (value: string) => void,
  setUnavailableReason: (value: string) => void,
  next: InspectionDetail | null,
) {
  if (!next) {
    setValue('')
    setUnit('km')
    setUnavailableReason('')
    return
  }
  setValue(next.odometer_value ? String(next.odometer_value) : '')
  setUnit(next.odometer_unit || 'km')
  setUnavailableReason(next.odometer_unavailable_reason || '')
}

export function useOdometer(inspection: InspectionDetail | null) {
  const [odometerValue, setOdometerValue] = useState('')
  const [odometerUnit, setOdometerUnit] = useState('km')
  const [odometerUnavailableReason, setOdometerUnavailableReason] = useState('')

  useEffect(() => {
    syncOdometer(setOdometerValue, setOdometerUnit, setOdometerUnavailableReason, inspection)
  }, [inspection])

  return {
    odometerValue,
    setOdometerValue,
    odometerUnit,
    setOdometerUnit,
    odometerUnavailableReason,
    setOdometerUnavailableReason,
  }
}
