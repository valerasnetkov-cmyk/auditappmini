'use client'

import { useState } from 'react'

export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState('')

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), durationMs)
  }

  return { toast, showToast, setToast }
}
