'use client'

import Link from 'next/link'
import type { SaasCompanyStats, SaasOwner } from '@/lib/types'
import {
  companyLimitForm,
  displayLimit,
  formatCurrency,
  formatDate,
  formatNumber,
  ownerInviteMailto,
  setupStatusClass,
  setupStatusLabel,
  subscriptionEndLabel,
  subscriptionStatusLabel,
} from '../_lib/companies'
import type { LimitForm } from '../_lib/companies'

type RowProps = {
  company: SaasCompanyStats
  ownerSetupLinks: Record<string, string>
  saving: boolean
  onCopySetupLink: (url: string) => void
  onIssueSetupLink: (ownerId: string) => void
  onDeactivateOwner: (ownerId: string) => void
  onToggleStatus: (company: SaasCompanyStats) => void
  onEditLimits: (form: LimitForm) => void
}

export default function CompanyTableRow({
  company, ownerSetupLinks, saving,
  onCopySetupLink, onIssueSetupLink, onDeactivateOwner, onToggleStatus, onEditLimits,
}: RowProps) {
  const subscription = company.subscription
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{company.name}</div>
        <div className="text-xs text-gray-500">{company.slug || company.id}</div>
      </td>
      <td className="px-4 py-3">{subscriptionStatusLabel(subscription?.status || company.status)}</td>
      <td className="px-4 py-3">
        {company.ownerUsers?.length ? (
          company.ownerUsers.map((owner) => (
            <OwnerCell
              key={owner.id}
              owner={owner}
              setupUrl={ownerSetupLinks[owner.id]}
              saving={saving}
              onCopySetupLink={onCopySetupLink}
              onIssueSetupLink={onIssueSetupLink}
              onDeactivateOwner={onDeactivateOwner}
            />
          ))
        ) : 'Нет владельца'}
      </td>
      <td className="px-4 py-3">{company.limits?.planCode || 'Не задан'}</td>
      <td className="px-4 py-3">
        <div>{formatDate(subscription?.currentPeriodEnd)}</div>
        {subscription?.currentPeriodEnd ? (
          <div className="mt-1 text-xs text-gray-500">
            {subscriptionEndLabel(subscription.status)}
            {subscription.daysUntilEnd === null || subscription.daysUntilEnd === undefined ? '' : ` · ${Math.max(subscription.daysUntilEnd, 0)} дн.`}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">{formatNumber(company.usage?.vehicles)} / {displayLimit(company.limits?.maxVehicles)}</td>
      <td className="px-4 py-3">{formatNumber(company.users)} / {displayLimit(company.limits?.maxUsers)}</td>
      <td className="px-4 py-3">{formatCurrency(company.billing?.monthlyRevenueRub)}</td>
      <td className="px-4 py-3">
        <Link className="mr-3 text-blue-600" href={`/saas-admin/companies/${company.id}`}>Открыть</Link>
        <button
          className="mr-3 text-blue-600"
          disabled={saving}
          onClick={() => onEditLimits(companyLimitForm(company))}
        >
          Лимиты
        </button>
        <button
          className="text-red-600"
          disabled={saving}
          onClick={() => void onToggleStatus(company)}
        >
          {company.status === 'inactive' ? 'Активировать' : 'Отключить'}
        </button>
      </td>
    </tr>
  )
}

type OwnerCellProps = {
  owner: SaasOwner
  setupUrl: string | undefined
  saving: boolean
  onCopySetupLink: (url: string) => void
  onIssueSetupLink: (ownerId: string) => void
  onDeactivateOwner: (ownerId: string) => void
}

function OwnerCell({ owner, setupUrl, saving, onCopySetupLink, onIssueSetupLink, onDeactivateOwner }: OwnerCellProps) {
  return (
    <div key={owner.id} className="mb-2">
      <div className="font-medium">{owner.name}</div>
      <div className="text-xs text-gray-500">{owner.email} · {owner.status}</div>
      <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${setupStatusClass(owner)}`}>
        {setupStatusLabel(owner)}
      </div>
      {setupUrl ? (
        <div className="mt-2 flex max-w-xs items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-blue-900 outline-none"
            readOnly
            value={setupUrl}
          />
          <button
            type="button"
            className="text-xs font-semibold text-blue-700"
            onClick={() => void onCopySetupLink(setupUrl)}
          >
            Копировать
          </button>
          <a className="text-xs font-semibold text-blue-700" href={ownerInviteMailto(owner, setupUrl)}>
            Письмо
          </a>
        </div>
      ) : null}
      {owner.status !== 'inactive' ? (
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            className="text-xs font-semibold text-blue-600"
            disabled={saving}
            onClick={() => void onIssueSetupLink(owner.id)}
          >
            {owner.setup?.status === 'accepted' ? 'Создать новую ссылку' : 'Выдать setup-ссылку'}
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-red-600"
            disabled={saving}
            onClick={() => void onDeactivateOwner(owner.id)}
          >
            Отключить
          </button>
        </div>
      ) : null}
    </div>
  )
}
