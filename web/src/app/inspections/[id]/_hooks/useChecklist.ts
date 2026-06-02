'use client'

import { useCallback, useEffect, useState } from 'react'
import type { InspectionDetail } from '@/lib/types'
import { buildChecklistFromExisting, type ChecklistItem } from '../_lib/checklist'

function syncChecklist(
  setChecklist: (value: React.SetStateAction<ChecklistItem[]>) => void,
  next: InspectionDetail | null,
) {
  if (!next) {
    setChecklist([])
    return
  }
  setChecklist(buildChecklistFromExisting(next.type, next.checklist_items))
}

export function useChecklist(inspection: InspectionDetail | null) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

  useEffect(() => {
    syncChecklist(setChecklist, inspection)
  }, [inspection])

  const setResult = useCallback((index: number, result: boolean) => {
    setChecklist((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, result } : item)),
    )
  }, [])

  const setComment = useCallback((index: number, comment: string) => {
    setChecklist((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, comment } : item)),
    )
  }, [])

  return { checklist, setResult, setComment }
}
