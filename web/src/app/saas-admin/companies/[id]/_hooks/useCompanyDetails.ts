'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import type { SaasCompanyDetailsResponse } from '@/lib/types'
import { companyFormFromData, limitFormFromData } from '../_lib/companyDetail'
import type { CompanyEditForm, LimitForm, OwnerForm } from '../_lib/companyDetail'

type SaveAction = () => Promise<boolean>

export function useCompanyDetails(companyId: string) {
  const [data, setData] = useState<SaasCompanyDetailsResponse | null>(null)
  const [companyForm, setCompanyForm] = useState<CompanyEditForm | null>(null)
  const [limitForm, setLimitForm] = useState<LimitForm>(limitFormFromData(null))
  const [ownerForm, setOwnerForm] = useState<OwnerForm>({ email: '', name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ownerSetupLinks, setOwnerSetupLinks] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    setError('')
    const result = await api.getResourceCompanyDetails(companyId)
    if (result.data) {
      setData(result.data)
      setCompanyForm(companyFormFromData(result.data))
      setLimitForm(limitFormFromData(result.data))
    } else {
      setError(result.error || 'Не удалось загрузить карточку компании')
    }
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const withSave = useCallback(async (action: SaveAction) => {
    setSaving(true)
    setError('')
    setMessage('')
    const ok = await action()
    if (ok) await loadData()
    setSaving(false)
  }, [loadData])

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

  return {
    data, setData,
    companyForm, setCompanyForm,
    limitForm, setLimitForm,
    ownerForm, setOwnerForm,
    loading, saving,
    error, message,
    ownerSetupLinks,
    loadData, withSave,
    showMessage, showError, setSetupLink,
  }
}

export type CompanyDetails = ReturnType<typeof useCompanyDetails>
