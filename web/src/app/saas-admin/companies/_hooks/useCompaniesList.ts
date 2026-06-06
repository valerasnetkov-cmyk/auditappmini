'use client'

import { useCallback, useState } from 'react'
import api from '@/lib/api/client'
import type { SaasAdminStats } from '@/lib/types'

export function useCompaniesList() {
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ownerSetupLinks, setOwnerSetupLinks] = useState<Record<string, string>>({})

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await api.getSaasAdminStats()
    const data = result.data
    if (data) {
      setStats(data)
    } else {
      setError(result.error || 'Не удалось загрузить реестр компаний')
    }
    setLoading(false)
    return data
  }, [])

  const withSave = useCallback(async (action: () => Promise<boolean>) => {
    setSaving(true)
    setError('')
    setMessage('')
    const ok = await action()
    if (ok) await loadStats()
    setSaving(false)
  }, [loadStats])

  const showMessage = useCallback((text: string) => {
    setError('')
    setMessage(text)
  }, [])

  const showError = useCallback((text: string) => {
    setMessage('')
    setError(text)
  }, [])

  const setSetupLink = useCallback((ownerId: string, url: string) => {
    setOwnerSetupLinks((current) => ({ ...current, [ownerId]: url }))
  }, [])

  const clearSetupLink = useCallback((ownerId: string) => {
    setOwnerSetupLinks((current) => {
      if (!(ownerId in current)) return current
      const next: Record<string, string> = {}
      for (const [key, value] of Object.entries(current)) {
        if (key !== ownerId) next[key] = value
      }
      return next
    })
  }, [])

  return {
    stats,
    companies: stats?.companies || [],
    plans: stats?.plans || [],
    loading,
    saving,
    error,
    message,
    ownerSetupLinks,
    loadStats,
    withSave,
    showMessage,
    showError,
    setSetupLink,
    clearSetupLink,
  }
}

export type CompaniesList = ReturnType<typeof useCompaniesList>
