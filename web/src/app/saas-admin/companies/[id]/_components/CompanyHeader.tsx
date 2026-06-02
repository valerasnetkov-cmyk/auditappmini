'use client'

import type { SaasCompanyDetailsResponse } from '@/lib/types'
import { formatDate, formatNumber, statusTone } from '../_lib/companyDetail'
import Link from 'next/link'

type HeaderProps = {
  data: SaasCompanyDetailsResponse | null
  subscriptionStatus: string
}

export default function CompanyHeader({ data, subscriptionStatus }: HeaderProps) {
  const company = data?.company
  return (
    <div className="resource-admin-hero">
      <Link href="/saas-admin/companies" className="text-sm font-medium text-blue-700">← К реестру компаний</Link>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Company card</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">{company?.name || 'Карточка компании'}</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
            Сервисная карточка клиента: владелец, тариф, лимиты, подписка, платежи, уведомления и журнал действий без перехода в tenant-данные.
          </p>
        </div>
        {company ? (
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${statusTone(subscriptionStatus)}`}>
            {subscriptionStatus}
          </span>
        ) : null}
      </div>
    </div>
  )
}

type MetricCardProps = { label: string; value: string; hint?: string }

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-5 text-gray-500">{hint}</div> : null}
    </div>
  )
}

export function CompanyMetrics({ data }: { data: SaasCompanyDetailsResponse }) {
  const company = data.company
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <MetricCard label="Тариф" value={data.limits?.planCode || 'не задан'} hint={company.billing?.planName || undefined} />
      <MetricCard
        label="Оплачено до"
        value={formatDate(data.subscription?.currentPeriodEnd)}
        hint={data.subscription?.daysUntilEnd === null || data.subscription?.daysUntilEnd === undefined ? undefined : `${data.subscription.daysUntilEnd} дн.`}
      />
      <MetricCard label="MRR" value={`${formatNumber(data.subscription?.mrrRub || company.billing?.monthlyRevenueRub)} ₽`} />
      <MetricCard label="Техника" value={`${formatNumber(company.usage?.vehicles)} / ${data.limits?.maxVehicles ?? '∞'}`} />
      <MetricCard label="Пользователи" value={`${formatNumber(company.users)} / ${data.limits?.maxUsers ?? '∞'}`} />
      <MetricCard
        label="Уведомления"
        value={formatNumber(data.alerts.filter((alert) => alert.status === 'new').length)}
        hint={`Всего: ${formatNumber(data.alerts.length)}`}
      />
    </div>
  )
}
