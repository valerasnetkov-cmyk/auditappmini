'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import { Badge, EmptyState, NoticeCard, Skeleton, StatusButton, type UiTone } from '@/components/ui'
import api from '@/lib/api/client'
import type { NotificationTemplate, SaasAdminStats, SaasAlert, SaasAlertsResponse, ServiceNotificationRecipient } from '@/lib/types'

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

function alertTone(type: string, status: string): UiTone {
  if (status !== 'new') return 'neutral'
  if (type === 'subscription_expired' || type === 'subscription_suspended') return 'danger'
  if (type === 'subscription_grace_started') return 'warning'
  return 'info'
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

export default function ResourceAlertsPage() {
  const [data, setData] = useState<SaasAlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'new' | 'critical'>('new')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [recipients, setRecipients] = useState<ServiceNotificationRecipient[]>([])
  const [messageForm, setMessageForm] = useState({ companyId: '', recipientUserId: '', templateId: '', title: '', message: '' })
  const [templateForm, setTemplateForm] = useState({ code: '', title: '', body: '', category: 'system' })

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
    const [result, statsResult, templatesResult] = await Promise.all([
      api.getResourceAlerts(),
      api.getSaasAdminStats(),
      api.getNotificationTemplates(),
    ])
    if (result.data) {
      setData(result.data)
      if (statsResult.data) {
        setStats(statsResult.data)
        setMessageForm((current) => ({ ...current, companyId: current.companyId || statsResult.data?.companies[0]?.id || '' }))
      }
      if (templatesResult.data) setTemplates(templatesResult.data.templates)
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

  useEffect(() => {
    if (!messageForm.companyId) return
    let cancelled = false
    void api.getResourceCompanyNotificationRecipients(messageForm.companyId).then((result) => {
      if (!cancelled) setRecipients(result.data?.recipients || [])
    })
    return () => { cancelled = true }
  }, [messageForm.companyId])

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

  const selectTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId)
    setMessageForm((current) => ({
      ...current,
      templateId,
      title: template?.title || current.title,
      message: template?.body || current.message,
    }))
  }

  const createMessage = async () => {
    setSaving(true)
    const result = await api.createResourceMessage(messageForm)
    if (result.data) {
      setMessage(`Сообщение создано для получателей: ${result.data.created}`)
      setMessageForm((current) => ({ ...current, recipientUserId: '', templateId: '', title: '', message: '' }))
    } else setError(result.error || 'Не удалось создать сообщение')
    setSaving(false)
  }

  const createTemplate = async () => {
    setSaving(true)
    const result = await api.createNotificationTemplate(templateForm)
    if (result.data) {
      setMessage('Шаблон создан')
      setTemplateForm({ code: '', title: '', body: '', category: 'system' })
      await loadData()
    } else setError(result.error || 'Не удалось создать шаблон')
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
          <StatusButton
            type="button"
            onClick={handleScan}
            status={saving ? 'loading' : 'idle'}
            loadingLabel="Проверяем подписки…"
          >
            Сканировать подписки
          </StatusButton>
        </div>

        {error ? <NoticeCard title="Сканирование не выполнено" tone="danger" compact>{error}</NoticeCard> : null}
        {message ? <NoticeCard title="Проверка завершена" tone="success" compact>{message}</NoticeCard> : null}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Загрузка уведомлений">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Всего событий" value={formatNumber(data.summary.total)} />
              <MetricCard label="Новые" value={formatNumber(data.summary.unread)} hint="Ожидают реакции администратора ресурса" />
              <MetricCard label="Истекают" value={formatNumber(data.summary.expiring)} hint="Порог 14 / 7 / 3 / 1 день" />
              <MetricCard label="Критичные" value={formatNumber(data.summary.critical)} hint="Grace, просрочка или приостановка" />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border bg-white p-4">
                <h2 className="font-semibold">Сервисное сообщение</h2>
                <div className="mt-4 grid gap-3">
                  <select className="rounded-lg border px-3 py-2" value={messageForm.companyId} onChange={(e) => setMessageForm({ ...messageForm, companyId: e.target.value, recipientUserId: '' })}>
                    {(stats?.companies || []).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                  <select className="rounded-lg border px-3 py-2" value={messageForm.recipientUserId} onChange={(e) => setMessageForm({ ...messageForm, recipientUserId: e.target.value })}>
                    <option value="">Вся компания</option>
                    {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} ({recipient.email}, {recipient.role === 'owner' ? 'владелец' : 'ответственный администратор'})</option>)}
                  </select>
                  <select className="rounded-lg border px-3 py-2" value={messageForm.templateId} onChange={(e) => selectTemplate(e.target.value)}>
                    <option value="">Без шаблона</option>
                    {templates.filter((item) => item.is_active).map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                  </select>
                  <input className="rounded-lg border px-3 py-2" placeholder="Тема" value={messageForm.title} onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })} />
                  <textarea className="min-h-28 rounded-lg border px-3 py-2" placeholder="Текст сообщения" value={messageForm.message} onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })} />
                  <button type="button" disabled={saving || !messageForm.companyId || !messageForm.title || !messageForm.message} onClick={() => void createMessage()} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Создать сообщение</button>
                </div>
              </section>
              <section className="rounded-lg border bg-white p-4">
                <h2 className="font-semibold">Новый шаблон</h2>
                <div className="mt-4 grid gap-3">
                  <input className="rounded-lg border px-3 py-2" placeholder="Код шаблона" value={templateForm.code} onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })} />
                  <input className="rounded-lg border px-3 py-2" placeholder="Название" value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} />
                  <textarea className="min-h-28 rounded-lg border px-3 py-2" placeholder="Текст" value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} />
                  <button type="button" disabled={saving || !templateForm.code || !templateForm.title || !templateForm.body} onClick={() => void createTemplate()} className="rounded-lg border border-blue-200 px-4 py-2 font-semibold text-blue-700 disabled:opacity-50">Сохранить шаблон</button>
                </div>
              </section>
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
                            <Badge tone={alertTone(alert.type, alert.status)}>
                              {alert.status === 'new' ? 'новое' : 'прочитано'}
                            </Badge>
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
              <EmptyState
                title="Активных уведомлений нет"
                description="Сканер подписок не нашёл просрочек или ближайших окончаний периода."
              />
            )}
          </>
        ) : null}
      </div>
    </Layout>
  )
}
