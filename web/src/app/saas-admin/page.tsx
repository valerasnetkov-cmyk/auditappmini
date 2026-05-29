'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { SaasAdminStats } from '@/lib/types'

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ru-RU')
}

function formatCurrency(value?: number | null, currency = 'RUB') {
  return `${formatNumber(value)} ${currency === 'RUB' ? '₽' : currency}`
}

function formatDate(value?: string | null) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-5 text-gray-500">{hint}</div> : null}
    </div>
  )
}

function QuickAction({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} className="rounded-lg border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-sm font-semibold text-gray-950">{label}</div>
      <div className="mt-2 text-xs leading-5 text-gray-500">{hint}</div>
    </Link>
  )
}

export default function SaasAdminOverviewPage() {
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const result = await api.getSaasAdminStats()
      if (result.data) {
        setStats(result.data)
      } else {
        setError(result.error || 'Не удалось загрузить обзор ресурса')
      }
      setLoading(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Layout currentPage="saas-admin">
      <div className="resource-admin-page mx-auto max-w-[1500px] space-y-8 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Resource overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">Обзор ресурса</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
            Операционный центр SaaS: компании, тарифы, оффлайн-платежи, сроки подписок и health-события без Directus.
          </p>
        </div>

        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Загрузка обзора...</div>
        ) : stats ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Компаний всего" value={formatNumber(stats.totals.companies)} hint={`Активные: ${formatNumber(stats.totals.activeCompanies)}`} />
              <MetricCard label="Платные" value={formatNumber(stats.billing?.paidCompanies)} hint={`Free/trial: ${formatNumber(stats.billing?.freeCompanies)}`} />
              <MetricCard label="MRR" value={formatCurrency(stats.billing?.monthlyRevenueRub)} hint={`ARR: ${formatCurrency(stats.billing?.annualRevenueRub)}`} />
              <MetricCard label="Оплачено за месяц" value={formatCurrency(stats.billing?.paidThisMonthRub)} hint={`Платежей: ${formatNumber(stats.billing?.paymentsThisMonth)}`} />
              <MetricCard label="Истекают" value={formatNumber(stats.billing?.expiringCount)} hint={`Grace: ${formatNumber(stats.billing?.graceCount)}`} />
              <MetricCard label="Health issues" value={formatNumber((stats.totals.companiesWithoutOwner || 0) + (stats.totals.companiesWithoutLimits || 0))} hint={`Уведомлений: ${formatNumber(stats.alerts?.unread)}`} />
            </div>

            <section>
              <h2 className="text-base font-semibold text-gray-950">Быстрые действия</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <QuickAction href="/saas-admin/companies" label="+ Создать компанию" hint="Реестр компаний, владельцы, статусы и лимиты." />
                <QuickAction href="/saas-admin/payments" label="+ Добавить платеж" hint="Фиксация оффлайн-оплаты и пересчет подписки." />
                <QuickAction href="/saas-admin/plans" label="+ Создать тариф" hint="Шаблоны тарифов, лимиты и feature flags." />
                <QuickAction href="/saas-admin/dashboard" label="Открыть KPI dashboard" hint="Активация, usage, storage, риски и апсейл." />
                <QuickAction href="/saas-admin/alerts" label="Проверить уведомления" hint="Сроки подписок, grace period и просрочки." />
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="overflow-hidden rounded-lg border bg-white">
                <div className="border-b px-4 py-4">
                  <h2 className="text-base font-semibold text-gray-950">Подписки, требующие внимания</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Компания</th>
                        <th className="px-4 py-3">Тариф</th>
                        <th className="px-4 py-3">Оплачено до</th>
                        <th className="px-4 py-3">MRR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(stats.expiring_subscriptions || []).slice(0, 5).map((subscription) => (
                        <tr key={subscription.id}>
                          <td className="px-4 py-3 font-medium text-gray-950">{subscription.companyName}</td>
                          <td className="px-4 py-3">{subscription.planCode || 'не назначен'}</td>
                          <td className="px-4 py-3">{formatDate(subscription.currentPeriodEnd)}</td>
                          <td className="px-4 py-3">{formatCurrency(subscription.mrrRub)}</td>
                        </tr>
                      ))}
                      {!(stats.expiring_subscriptions || []).length ? (
                        <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={4}>Нет срочных подписок</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border bg-white">
                <div className="border-b px-4 py-4">
                  <h2 className="text-base font-semibold text-gray-950">Последние платежи</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Дата</th>
                        <th className="px-4 py-3">Компания</th>
                        <th className="px-4 py-3">Сумма</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(stats.recent_payments || []).slice(0, 5).map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-4 py-3">{formatDate(payment.paymentDate)}</td>
                          <td className="px-4 py-3 font-medium text-gray-950">{payment.companyName || payment.companyId}</td>
                          <td className="px-4 py-3">{formatCurrency(payment.amount, payment.currency)}</td>
                        </tr>
                      ))}
                      {!(stats.recent_payments || []).length ? (
                        <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={3}>Платежей пока нет</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
