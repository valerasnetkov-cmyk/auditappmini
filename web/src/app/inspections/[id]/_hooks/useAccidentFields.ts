'use client'

import { useEffect, useState } from 'react'
import type { InspectionDetail } from '@/lib/types'
import { toDatetimeLocalValue } from '../_lib/checklist'

function syncAccident(
  setOccurredAt: (value: string) => void,
  setLocation: (value: string) => void,
  next: InspectionDetail | null,
) {
  if (!next) {
    setOccurredAt('')
    setLocation('')
    return
  }
  setOccurredAt(toDatetimeLocalValue(next.accident_occurred_at))
  setLocation(next.accident_location || '')
}

export function useAccidentFields(inspection: InspectionDetail | null) {
  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')

  useEffect(() => {
    syncAccident(setAccidentOccurredAt, setAccidentLocation, inspection)
  }, [inspection])

  return {
    accidentOccurredAt,
    setAccidentOccurredAt,
    accidentLocation,
    setAccidentLocation,
  }
}
