'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { ResourcePaymentPayload, SaasPaymentsResponse } from '@/lib/types'
import { Badge, NoticeCard, Skeleton, StatusButton, type UiTone } from '@/components/ui'

const today = new Date().toISOString().slice(0, 10)

const emptyPaymentForm: ResourcePaymentPayload = {
  companyId: '',
  planCode: 'pilot',
  amount: 0,
  currency: 'RUB',
  paymentDate: today,
  periodStart: today,
  periodEnd: today,
  paymentMethod: 'bank_transfer',
  documentNumber: '',
  comment: '',
}

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

function addMonth(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    active: 'активна',
    expiring: 'истекает',
    grace: 'grace',
    expired: 'просрочена',
    suspended: 'приостановлена',
    cancelled: 'отменен',
  }
  return labels[value || 'active'] || value || 'активна'
}

function statusTone(value?: string | null): UiTone {
  if (value === 'expired' || value === 'suspended' || value === 'cancelled') return 'danger'
  if (value === 'expiring' || value === 'grace') return 'warning'
  return 'success'
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

export default function ResourcePaymentsPage() {
  const [data, setData] = useState<SaasPaymentsResponse | null>(null)
  const [form, setForm] = useState<ResourcePaymentPayload>(emptyPaymentForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const companies = useMemo(() => data?.companies || [], [data])
  const plans = useMemo(() => data?.plans || [], [data])
  const payments = data?.payments || []
  const expiringSubscriptions = data?.expiringSubscriptions || []

  const loadData = async () => {
    setLoading(true)
    setError('')
    const result = await api.getResourcePayments()
    const loadedData = result.data
    if (loadedData) {
      setData(loadedData)
      setForm((current) => ({
        ...current,
        companyId: current.companyId || loadedData.companies[0]?.id || '',
        planCode: current.planCode || loadedData.plans[0]?.code || 'pilot',
      }))
    } else {
      setError(result.error || 'Не удалось загрузить платежи')
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const handleCreatePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const result = await api.createResourcePayment({
      ...form,
      amount: Number(form.amount || 0),
      currency: form.currency || 'RUB',
    })

    if (result.data) {
      setMessage('Платеж добавлен, подписка пересчитана')
      setForm((current) => ({
        ...emptyPaymentForm,
        companyId: current.companyId,
        planCode: current.planCode,
        paymentDate: today,
        periodStart: today,
        periodEnd: today,
      }))
      await loadData()
    } else {
      setError(result.error || 'Не удалось добавить платеж')
    }

    setSaving(false)
  }

  const selectCompany = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId)
    const planCode = company?.subscription?.planCode || company?.limits?.planCode || 'pilot'
    const plan = plans.find((item) => item.code === planCode)
    const periodStart = company?.subscription?.currentPeriodEnd || today
    setForm((current) => ({
      ...current,
      companyId,
      planCode,
      amount: plan?.monthlyPriceRub || company?.billing?.monthlyPriceRub || 0,
      periodStart,
      periodEnd: addMonth(periodStart),
    }))
  }

  const handleCancelPayment = async (id: string) => {
    setSaving(true)
    setError('')
    setMessage('')
    const result = await api.cancelResourcePayment(id, 'Отменено администратором ресурса')
    if (result.data) {
      setMessage('Платеж отменен, подписка пересчитана')
      await loadData()
    } else {
      setError(result.error || 'Не удалось отменить платеж')
    }
    setSaving(false)
  }

  return (
    <Layout currentPage="resource-payments">
      <div className="resource-admin-page mx-auto max-w-[1500px] space-y-8 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Offline payments</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">Платежи и подписки</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
            Ручная фиксация оффлайн-оплат, пересчет MRR и контроль сроков подписок без внешней CMS.
          </p>
        </div>

        {error ? <NoticeCard title="Операция с платежом не выполнена" tone="danger" compact>{error}</NoticeCard> : null}
        {message ? <NoticeCard title="Платёж обновлён" tone="success" compact>{message}</NoticeCard> : null}

        {loading ? (
          <Skeleton className="h-48" />
        ) : data ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Оплачено за месяц" value={formatCurrency(data.summary.paidThisMonthRub)} hint={`Платежей: ${formatNumber(data.summary.paymentsThisMonth)}`} />
              <MetricCard label="Ожидаемые продления" value={formatCurrency(data.summary.expectedRenewalsRub)} hint="Подписки на горизонте 30 дней" />
              <MetricCard label="Средний платеж" value={formatCurrency(data.summary.averagePaymentRub)} />
              <MetricCard label="Истекают" value={formatNumber(data.summary.expiringCount)} />
              <MetricCard label="Grace" value={formatNumber(data.summary.graceCount)} />
              <MetricCard label="Просрочены" value={formatNumber(data.summary.expiredCount + data.summary.suspendedCount)} />
            </div>

            <section className="rounded-lg border bg-white p-4">
              <h2 className="text-base font-semibold text-gray-950">Добавить оффлайн-платеж</h2>
              <form onSubmit={handleCreatePayment} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <select value={form.companyId} onChange={(event) => selectCompany(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" required>
                  <option value="">Компания</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
                <select value={form.planCode} onChange={(event) => setForm({ ...form, planCode: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" required>
                  {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                </select>
                <input type="number" min="1" value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} className="rounded-lg border px-3 py-2 text-sm" placeholder="Сумма" required />
                <input value={form.currency || 'RUB'} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} className="rounded-lg border px-3 py-2 text-sm" placeholder="Валюта" />
                <input type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" required />
                <input type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" required />
                <input type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" required />
                <input value={form.paymentMethod || ''} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" placeholder="Способ оплаты" />
                <input value={form.documentNumber || ''} onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" placeholder="Счет / акт" />
                <input value={form.comment || ''} onChange={(event) => setForm({ ...form, comment: event.target.value })} className="rounded-lg border px-3 py-2 text-sm xl:col-span-2" placeholder="Комментарий" />
                <StatusButton type="submit" status={saving ? 'loading' : 'idle'} loadingLabel="Добавляем платёж…">
                  Добавить платеж
                </StatusButton>
              </form>
            </section>

            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-4">
                <h2 className="text-base font-semibold text-gray-950">Подписки, требующие внимания</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Компания</th>
                      <th className="px-4 py-3">Владелец</th>
                      <th className="px-4 py-3">Тариф</th>
                      <th className="px-4 py-3">Оплачено до</th>
                      <th className="px-4 py-3">Осталось</th>
                      <th className="px-4 py-3">MRR</th>
                      <th className="px-4 py-3">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expiringSubscriptions.length ? expiringSubscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td className="px-4 py-3 font-medium text-gray-950">{subscription.companyName}</td>
                        <td className="px-4 py-3">{subscription.ownerEmail || 'нет владельца'}</td>
                        <td className="px-4 py-3">{subscription.planCode || 'не назначен'}</td>
                        <td className="px-4 py-3">{formatDate(subscription.currentPeriodEnd)}</td>
                        <td className="px-4 py-3">{subscription.daysUntilEnd === null || subscription.daysUntilEnd === undefined ? 'не указано' : `${subscription.daysUntilEnd} дн.`}</td>
                        <td className="px-4 py-3">{formatCurrency(subscription.mrrRub)}</td>
                        <td className="px-4 py-3"><Badge tone={statusTone(subscription.status)}>{statusLabel(subscription.status)}</Badge></td>
                      </tr>
                    )) : (
                      <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={7}>Подписок, требующих внимания, нет</td></tr>
                    )}
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
                      <th className="px-4 py-3">Тариф</th>
                      <th className="px-4 py-3">Сумма</th>
                      <th className="px-4 py-3">Период</th>
                      <th className="px-4 py-3">Документ</th>
                      <th className="px-4 py-3">Внёс</th>
                      <th className="px-4 py-3">Статус</th>
                      <th className="px-4 py-3">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.length ? payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3">{formatDate(payment.paymentDate)}</td>
                        <td className="px-4 py-3 font-medium text-gray-950">{payment.companyName || payment.companyId}</td>
                        <td className="px-4 py-3">{payment.planCode || 'не назначен'}</td>
                        <td className="px-4 py-3">{formatCurrency(payment.amount, payment.currency)}</td>
                        <td className="px-4 py-3">{formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}</td>
                        <td className="px-4 py-3">{payment.documentNumber || 'нет'}</td>
                        <td className="px-4 py-3">{payment.createdByName || payment.createdBy || 'не указано'}</td>
                        <td className="px-4 py-3"><Badge tone={statusTone(payment.status)}>{statusLabel(payment.status)}</Badge></td>
                        <td className="px-4 py-3">
                          {payment.status !== 'cancelled' ? (
                            <button type="button" onClick={() => void handleCancelPayment(payment.id)} disabled={saving} className="text-sm font-medium text-red-700 disabled:opacity-50">
                              Отменить
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">нет действий</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={9}>Платежей пока нет</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
