'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { SaasAlert, SaasAlertsResponse } from '@/lib/types'

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ru-RU')
}

function formatDateTime(value?: string | null) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function alertTypeLabel(type: string) {
  if (type.startsWith('subscription_expiring_')) return 'Истекает подписка'
  if (type === 'subscription_grace_started') return 'Grace period'
  if (type === 'subscription_expired') return 'Просрочка'
  if (type === 'subscription_suspended') return 'Приостановка'
  return type
}

function alertTone(type: string, status: string) {
  if (status !== 'new') return 'bg-gray-50 text-gray-600 ring-gray-200'
  if (type === 'subscription_expired' || type === 'subscription_suspended') return 'bg-red-50 text-red-700 ring-red-100'
  if (type === 'subscription_grace_started') return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-blue-50 text-blue-700 ring-blue-100'
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-5 text-gray-500">{hint}</div> : null}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <div className="text-base font-semibold text-gray-950">Активных уведомлений нет</div>
      <div className="mt-2 text-sm text-gray-500">Сканер подписок не нашел просрочек или ближайших окончаний периода.</div>
    </div>
  )
}

export default function ResourceAlertsPage() {
  const [data, setData] = useState<SaasAlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'new' | 'critical'>('new')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const alerts = useMemo(() => data?.alerts || [], [data?.alerts])
  const filteredAlerts = useMemo(() => {
    if (filter === 'new') return alerts.filter((alert) => alert.status === 'new')
    if (filter === 'critical') {
      return alerts.filter((alert) => ['subscription_expired', 'subscription_suspended', 'subscription_grace_started'].includes(alert.type))
    }
    return alerts
  }, [alerts, filter])

  const loadData = async () => {
    setError('')
    const result = await api.getResourceAlerts()
    if (result.data) {
      setData(result.data)
    } else {
      setError(result.error || 'Не удалось загрузить уведомления')
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const handleScan = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    const result = await api.scanResourceAlerts()
    if (result.data) {
      setData(result.data)
      const scan = result.data.result
      setMessage(`Проверено подписок: ${formatNumber(scan?.scannedSubscriptions)}. Новых уведомлений: ${formatNumber(scan?.createdNotifications)}.`)
    } else {
      setError(result.error || 'Не удалось выполнить сканирование подписок')
    }
    setSaving(false)
  }

  const handleRead = async (alert: SaasAlert) => {
    setSaving(true)
    setError('')
    setMessage('')
    const result = await api.markResourceAlertRead(alert.id)
    if (result.data) {
      await loadData()
      setMessage('Уведомление отмечено как прочитанное')
    } else {
      setError(result.error || 'Не удалось обновить уведомление')
    }
    setSaving(false)
  }

  return (
    <Layout currentPage="resource-alerts">
      <div className="resource-admin-page mx-auto max-w-[1500px] space-y-8 px-6 py-6">
        <div className="resource-admin-hero flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Subscription control</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">Уведомления и сроки подписок</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
              Контроль окончаний оплаченных периодов, grace period и просрочек для ручного сопровождения оффлайн-платежей.
            </p>
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Проверка...' : 'Сканировать подписки'}
          </button>
        </div>

        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Загрузка уведомлений...</div>
        ) : data ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Всего событий" value={formatNumber(data.summary.total)} />
              <MetricCard label="Новые" value={formatNumber(data.summary.unread)} hint="Ожидают реакции администратора ресурса" />
              <MetricCard label="Истекают" value={formatNumber(data.summary.expiring)} hint="Порог 14 / 7 / 3 / 1 день" />
              <MetricCard label="Критичные" value={formatNumber(data.summary.critical)} hint="Grace, просрочка или приостановка" />
            </div>

            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-950">Лента уведомлений</h2>
                  <p className="mt-1 text-sm text-gray-500">События формируются по подпискам компаний, без доступа к операционным данным tenant-контуров.</p>
                </div>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
                  {[
                    ['new', 'Новые'],
                    ['critical', 'Критичные'],
                    ['all', 'Все'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value as 'all' | 'new' | 'critical')}
                      className={`rounded-md px-3 py-1.5 font-medium transition ${filter === value ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-950'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {filteredAlerts.length ? (
              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Статус</th>
                        <th className="px-4 py-3">Компания</th>
                        <th className="px-4 py-3">Событие</th>
                        <th className="px-4 py-3">Описание</th>
                        <th className="px-4 py-3">Создано</th>
                        <th className="px-4 py-3 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAlerts.map((alert) => (
                        <tr key={alert.id} className="align-top transition hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${alertTone(alert.type, alert.status)}`}>
                              {alert.status === 'new' ? 'новое' : 'прочитано'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-950">{alert.companyName || alert.companyId || 'без компании'}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-950">{alertTypeLabel(alert.type)}</div>
                            <div className="mt-1 text-xs text-gray-500">{alert.title}</div>
                          </td>
                          <td className="max-w-xl px-4 py-3 leading-6 text-gray-600">{alert.message || 'Описание не задано'}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDateTime(alert.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            {alert.status === 'new' ? (
                              <button
                                type="button"
                                onClick={() => void handleRead(alert)}
                                disabled={saving}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-50"
                              >
                                Прочитано
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">{formatDateTime(alert.readAt)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <EmptyState />
            )}
          </>
        ) : null}
      </div>
    </Layout>
  )
}
