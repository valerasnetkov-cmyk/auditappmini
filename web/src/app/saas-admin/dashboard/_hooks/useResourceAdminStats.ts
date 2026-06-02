'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api/client'
import type { SaasAdminStats } from '@/lib/types'

export function useResourceAdminStats() {
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setLoading(true)
      setError('')

      const result = await api.getSaasAdminStats()
      if (cancelled) return

      if (result.data) {
        setStats(result.data)
      } else {
        setError(result.error || 'Не удалось загрузить дашборд ресурса')
      }

      setLoading(false)
    }

    void loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  return { stats, loading, error }
}

export function useCompaniesFilter(companies: SaasAdminStats['companies']) {
  const [companySearch, setCompanySearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const planOptions = useMemo(() => {
    const values = new Set(companies.map((company) => company.limits?.planCode || 'unassigned'))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [companies])

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase()
    return companies.filter((company) => {
      const matchesQuery = !query || [company.name, company.slug, company.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
      const planCode = company.limits?.planCode || 'unassigned'
      const matchesPlan = planFilter === 'all' || planCode === planFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'no-owner' && !company.owners) ||
        (statusFilter === 'no-limits' && !company.limits?.planCode) ||
        (statusFilter === 'churn' && company.riskStatus === 'churn') ||
        (statusFilter === 'upsell' && company.riskStatus === 'upsell') ||
        (statusFilter === 'near-limit' && ((company.vehiclesUsagePercent || 0) >= 80 || (company.usersUsagePercent || 0) >= 80)) ||
        company.status === statusFilter

      return matchesQuery && matchesPlan && matchesStatus
    })
  }, [companies, companySearch, planFilter, statusFilter])

  return {
    state: { companySearch, planFilter, statusFilter },
    actions: { setCompanySearch, setPlanFilter, setStatusFilter },
    planOptions,
    filteredCompanies,
  }
}
