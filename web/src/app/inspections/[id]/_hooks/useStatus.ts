'use client'

import { useCallback, useState } from 'react'
import type { StatusTone } from '../_lib/checklist'

export function useStatus() {
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<StatusTone>('success')

  const show = useCallback((tone: StatusTone, message: string) => {
    setStatusTone(tone)
    setStatusMessage(message)
  }, [])

  const clear = useCallback(() => setStatusMessage(''), [])

  return { statusMessage, statusTone, show, clear }
}
