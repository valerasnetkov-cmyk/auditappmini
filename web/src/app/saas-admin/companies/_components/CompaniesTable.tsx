'use client'

import type { SaasCompanyStats } from '@/lib/types'
import type { LimitForm } from '../_lib/companies'
import CompanyTableRow from './CompanyTableRow'

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

export default function CompaniesTable({
  companies, ownerSetupLinks, saving,
  onCopySetupLink, onIssueSetupLink, onDeactivateOwner, onToggleStatus, onEditLimits,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Компания</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Владелец</th>
            <th className="px-4 py-3">Тариф</th>
            <th className="px-4 py-3">Оплачено до</th>
            <th className="px-4 py-3">Техника / лимит</th>
            <th className="px-4 py-3">Пользователи / лимит</th>
            <th className="px-4 py-3">MRR</th>
            <th className="px-4 py-3">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {companies.map((company) => (
            <CompanyTableRow
              key={company.id}
              company={company}
              ownerSetupLinks={ownerSetupLinks}
              saving={saving}
              onCopySetupLink={onCopySetupLink}
              onIssueSetupLink={onIssueSetupLink}
              onDeactivateOwner={onDeactivateOwner}
              onToggleStatus={onToggleStatus}
              onEditLimits={onEditLimits}
            />
          ))}
          {!companies.length ? (
            <tr>
              <td className="px-4 py-6 text-center text-gray-500" colSpan={9}>Компании не найдены</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
