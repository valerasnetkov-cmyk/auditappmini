'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SaasCompanyStats } from '@/lib/types'
import { filterCompanies } from '../_lib/companies'
import type { LimitForm } from '../_lib/companies'
import CompaniesTable from './CompaniesTable'

type Props = {
  companies: SaasCompanyStats[]
  ownerSetupLinks: Record<string, string>
  saving: boolean
  onCopySetupLink: (url: string) => void
  onIssueSetupLink: (ownerId: string) => void
  onDeactivateOwner: (ownerId: string) => void
  onToggleStatus: (company: SaasCompanyStats) => void
  onEditLimits: (form: LimitForm) => void
}

export default function CompaniesRegistry({
  companies, ownerSetupLinks, saving,
  onCopySetupLink, onIssueSetupLink, onDeactivateOwner, onToggleStatus, onEditLimits,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [planFilter, setPlanFilter] = useState(searchParams.get('plan') || '')
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '')
  const filtered = filterCompanies(companies, '', 'all')

  const updateFilters = (nextSearch: string, nextStatus: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextSearch) params.set('search', nextSearch)
    else params.delete('search')
    if (nextStatus !== 'all') params.set('status', nextStatus)
    else params.delete('status')
    params.delete('has_owner')
    params.delete('billing')
    params.delete('subscription_status')
    if (nextStatus === 'no-owner') {
      params.delete('status')
      params.set('has_owner', 'false')
    }
    if (nextStatus === 'expired') {
      params.delete('status')
      params.set('billing', 'overdue')
    }
    if (nextStatus === 'expiring') {
      params.delete('status')
      params.set('subscription_status', 'expiring')
    }
    router.replace(`/saas-admin/companies?${params.toString()}`)
  }

  const updateExtraFilter = (key: 'plan' | 'region', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`/saas-admin/companies?${params.toString()}`)
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b px-4 py-4">
        <h2 className="text-base font-semibold">Реестр компаний</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_220px]">
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Поиск по компании, slug или владельцу..."
            value={search}
            onChange={(event) => {
              const value = event.target.value
              setSearch(value)
              updateFilters(value, statusFilter)
            }}
          />
          <select
            className="rounded-lg border px-3 py-2"
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value
              setStatusFilter(value)
              updateFilters(search, value)
            }}
          >
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="inactive">Отключенные</option>
            <option value="no-owner">Без владельца</option>
            <option value="no-limits">Без лимитов</option>
            <option value="expiring">Истекает / grace</option>
            <option value="expired">Просрочены</option>
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            value={planFilter}
            onChange={(event) => {
              setPlanFilter(event.target.value)
              updateExtraFilter('plan', event.target.value)
            }}
          >
            <option value="">Все тарифы</option>
            {[...new Set(companies.map((company) => company.limits?.planCode).filter(Boolean))].map((plan) => <option key={plan} value={plan || ''}>{plan}</option>)}
          </select>
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Регион"
            value={regionFilter}
            onChange={(event) => {
              setRegionFilter(event.target.value)
              updateExtraFilter('region', event.target.value)
            }}
          />
        </div>
      </div>
      <CompaniesTable
        companies={filtered}
        ownerSetupLinks={ownerSetupLinks}
        saving={saving}
        onCopySetupLink={onCopySetupLink}
        onIssueSetupLink={onIssueSetupLink}
        onDeactivateOwner={onDeactivateOwner}
        onToggleStatus={onToggleStatus}
        onEditLimits={onEditLimits}
      />
    </section>
  )
}
