'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import type { CompanyUsageResponse } from '@/lib/types'

type CompanyUsageState = {
  usage: CompanyUsageResponse | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
}

export function useCompanyUsage(enabled = true): CompanyUsageState {
  const [usage, setUsage] = useState<CompanyUsageResponse | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.getCompanyUsage()
      if (response.error) {
        setError(response.error)
        setUsage(null)
        return
      }

      setUsage(response.data || null)
    } catch {
      setError('Не удалось загрузить ограничения компании')
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled) return undefined

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const refreshOnFocus = () => {
      void refresh()
    }
    const intervalId = window.setInterval(() => {
      void refresh()
    }, 60 * 60 * 1000)

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshOnFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [enabled, refresh])

  return { usage, loading, error, refresh }
}
