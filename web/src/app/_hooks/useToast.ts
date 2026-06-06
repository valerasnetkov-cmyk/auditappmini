'use client'

import { useCallback, useState } from 'react'
import type { ToastMessage, ToastTone } from '../_lib/dashboard'

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((text: string, tone: ToastTone = 'info') => {
    setToast({ text, tone })
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setToast(null), 3000)
    }
  }, [])

  return { toast, showToast }
}
