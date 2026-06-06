'use client'

import { useState } from 'react'
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const filtered = filterCompanies(companies, search, statusFilter)

  return (
    <section className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b px-4 py-4">
        <h2 className="text-base font-semibold">Реестр компаний</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_240px]">
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Поиск по компании, slug или владельцу..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="inactive">Отключенные</option>
            <option value="no-owner">Без владельца</option>
            <option value="no-limits">Без лимитов</option>
            <option value="expiring">Истекает / grace</option>
            <option value="expired">Просрочены</option>
          </select>
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
