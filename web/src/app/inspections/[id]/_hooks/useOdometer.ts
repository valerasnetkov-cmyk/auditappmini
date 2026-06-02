'use client'

import { useEffect, useState } from 'react'
import type { InspectionDetail } from '@/lib/types'

function syncOdometer(
  setValue: (value: string) => void,
  setUnit: (value: string) => void,
  next: InspectionDetail | null,
) {
  if (!next) {
    setValue('')
    setUnit('km')
    return
  }
  setValue(next.odometer_value ? String(next.odometer_value) : '')
  setUnit(next.odometer_unit || 'km')
}

export function useOdometer(inspection: InspectionDetail | null) {
  const [odometerValue, setOdometerValue] = useState('')
  const [odometerUnit, setOdometerUnit] = useState('km')

  useEffect(() => {
    syncOdometer(setOdometerValue, setOdometerUnit, inspection)
  }, [inspection])

  return {
    odometerValue,
    setOdometerValue,
    odometerUnit,
    setOdometerUnit,
  }
}
