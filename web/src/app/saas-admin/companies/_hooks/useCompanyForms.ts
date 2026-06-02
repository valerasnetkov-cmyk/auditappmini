'use client'

import { useCallback, useState } from 'react'
import type { SaasCompanyStats } from '@/lib/types'
import { companyLimitForm, emptyCompanyForm, emptyOwnerForm } from '../_lib/companies'
import type { CompanyForm, LimitForm, OwnerForm } from '../_lib/companies'

export function useCompanyFormState() {
  const [form, setForm] = useState<CompanyForm>(emptyCompanyForm)
  return { form, setForm, reset: () => setForm(emptyCompanyForm) }
}

export function useOwnerFormState(companies: SaasCompanyStats[]) {
  const [form, setForm] = useState<OwnerForm>(() => ({ ...emptyOwnerForm, companyId: companies[0]?.id || '' }))
  const resetKeepCompany = useCallback(() => {
    setForm((current) => ({ ...emptyOwnerForm, companyId: current.companyId }))
  }, [])
  return { form, setForm, reset: resetKeepCompany }
}

export function useLimitFormState(companies: SaasCompanyStats[]) {
  const [form, setForm] = useState<LimitForm>(() => companyLimitForm(companies[0]))
  return { form, setForm }
}
