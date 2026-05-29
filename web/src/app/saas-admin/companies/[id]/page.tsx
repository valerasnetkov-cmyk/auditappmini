'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { ResourceCompanyLimitsPayload, SaasCompanyDetailsResponse, SaasOwner } from '@/lib/types'

type CompanyEditForm = {
  slug: string
  name: string
  region_code: string
  data_residency: string
  status: 'active' | 'inactive'
}

type OwnerForm = {
  email: string
  name: string
}

type LimitForm = ResourceCompanyLimitsPayload

function numberOrNull(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function statusTone(value?: string | null) {
  if (value === 'expired' || value === 'suspended' || value === 'inactive') return 'bg-red-50 text-red-700 ring-red-100'
  if (value === 'expiring' || value === 'grace') return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
}

function setupStatusLabel(owner: SaasOwner) {
  const status = owner.setup?.status
  if (status === 'accepted') return 'Доступ активирован'
  if (status === 'pending') return `Ожидает до ${formatDate(owner.setup?.expires_at)}`
  if (status === 'expired') return 'Ссылка истекла'
  return 'Ссылка не создана'
}

function setupStatusClass(owner: SaasOwner) {
  const status = owner.setup?.status
  if (status === 'accepted') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'pending') return 'bg-blue-50 text-blue-700 ring-blue-100'
  if (status === 'expired') return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-gray-50 text-gray-600 ring-gray-100'
}

function ownerInviteMailto(owner: SaasOwner, url: string) {
  const subject = encodeURIComponent('Доступ к Audit Tech')
  const body = encodeURIComponent([
    `${owner.name}, здравствуйте.`,
    '',
    'Для активации доступа владельца компании откройте ссылку и задайте пароль:',
    url,
    '',
    'Если ссылка истекла, запросите новую у администратора ресурса.',
  ].join('\n'))

  return `mailto:${encodeURIComponent(owner.email)}?subject=${subject}&body=${body}`
}

function limitFormFromData(data: SaasCompanyDetailsResponse | null): LimitForm {
  return {
    planCode: data?.limits?.planCode || 'pilot',
    maxVehicles: data?.limits?.maxVehicles ?? null,
    maxUsers: data?.limits?.maxUsers ?? null,
    maxStorageMb: data?.limits?.maxStorageMb ?? null,
    ocrEnabled: data?.limits?.ocrEnabled ?? true,
    accidentModuleEnabled: data?.limits?.accidentModuleEnabled ?? true,
    analyticsEnabled: data?.limits?.analyticsEnabled ?? true,
    apiAccessEnabled: data?.limits?.apiAccessEnabled ?? false,
  }
}

function companyFormFromData(data: SaasCompanyDetailsResponse): CompanyEditForm {
  return {
    slug: data.company.slug || data.company.id,
    name: data.company.name,
    region_code: data.company.region_code || '',
    data_residency: data.company.data_residency || '',
    status: data.company.status === 'inactive' ? 'inactive' : 'active',
  }
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

export default function ResourceCompanyDetailsPage() {
  const params = useParams<{ id: string }>()
  const companyId = decodeURIComponent(params.id)
  const [data, setData] = useState<SaasCompanyDetailsResponse | null>(null)
  const [companyForm, setCompanyForm] = useState<CompanyEditForm | null>(null)
  const [limitForm, setLimitForm] = useState<LimitForm>(limitFormFromData(null))
  const [ownerForm, setOwnerForm] = useState<OwnerForm>({ email: '', name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ownerSetupLinks, setOwnerSetupLinks] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    setError('')
    const result = await api.getResourceCompanyDetails(companyId)
    if (result.data) {
      setData(result.data)
      setCompanyForm(companyFormFromData(result.data))
      setLimitForm(limitFormFromData(result.data))
    } else {
      setError(result.error || 'Не удалось загрузить карточку компании')
    }
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const withSave = async (action: () => Promise<boolean>) => {
    setSaving(true)
    setError('')
    setMessage('')
    const ok = await action()
    if (ok) await loadData()
    setSaving(false)
  }

  const handleCompanySave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!companyForm) return

    await withSave(async () => {
      const result = await api.updateResourceCompany(companyId, companyForm)
      if (result.data) {
        setMessage('Карточка компании обновлена')
        return true
      }
      setError(result.error || 'Не удалось обновить компанию')
      return false
    })
  }

  const handleLimitsSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withSave(async () => {
      const result = await api.updateResourceCompanyLimits(companyId, {
        ...limitForm,
        ocrEnabled: Boolean(limitForm.ocrEnabled),
        accidentModuleEnabled: Boolean(limitForm.accidentModuleEnabled),
        analyticsEnabled: Boolean(limitForm.analyticsEnabled),
        apiAccessEnabled: Boolean(limitForm.apiAccessEnabled),
      })
      if (result.data) {
        setMessage('Тариф и лимиты обновлены')
        return true
      }
      setError(result.error || 'Не удалось обновить лимиты')
      return false
    })
  }

  const handleOwnerCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withSave(async () => {
      const result = await api.createResourceOwner(companyId, {
        ...ownerForm,
        issue_setup_link: true,
      })
      if (result.data) {
        const owner = result.data
        setOwnerForm({ email: '', name: '' })
        if (owner.setup?.setup_url) {
          setOwnerSetupLinks((current) => ({ ...current, [owner.id]: owner.setup?.setup_url || '' }))
          setMessage('Владелец создан. Ссылка активации готова для копирования.')
        } else {
          setMessage('Владелец создан')
        }
        return true
      }
      setError(result.error || 'Не удалось создать владельца')
      return false
    })
  }

  const handleOwnerDeactivate = async (ownerId: string) => {
    await withSave(async () => {
      const result = await api.deleteResourceOwner(ownerId)
      if (!result.error) {
        setMessage('Владелец отключен')
        return true
      }
      setError(result.error)
      return false
    })
  }

  const handleIssueOwnerSetupLink = async (ownerId: string) => {
    await withSave(async () => {
      const result = await api.issueResourceOwnerSetupLink(ownerId)
      if (result.data?.setup?.setup_url) {
        setOwnerSetupLinks((current) => ({ ...current, [ownerId]: result.data?.setup?.setup_url || '' }))
        setMessage('Новая setup-ссылка создана. Скопируйте её и передайте владельцу.')
        return true
      }
      setError(result.error || 'Не удалось создать setup-ссылку')
      return false
    })
  }

  const handleCopySetupLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Setup-ссылка скопирована в буфер обмена')
    } catch {
      setError('Не удалось скопировать ссылку. Выделите и скопируйте её вручную.')
    }
  }

  const company = data?.company
  const subscriptionStatus = data?.subscription?.status || company?.status || 'active'

  return (
    <Layout currentPage="resource-companies">
      <div className="resource-admin-page mx-auto max-w-[1500px] space-y-8 px-6 py-6">
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

        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Загрузка карточки компании...</div>
        ) : data && company && companyForm ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Тариф" value={data.limits?.planCode || 'не задан'} hint={company.billing?.planName || undefined} />
              <MetricCard label="Оплачено до" value={formatDate(data.subscription?.currentPeriodEnd)} hint={data.subscription?.daysUntilEnd === null || data.subscription?.daysUntilEnd === undefined ? undefined : `${data.subscription.daysUntilEnd} дн.`} />
              <MetricCard label="MRR" value={formatCurrency(data.subscription?.mrrRub || company.billing?.monthlyRevenueRub)} />
              <MetricCard label="Техника" value={`${formatNumber(company.usage?.vehicles)} / ${data.limits?.maxVehicles ?? '∞'}`} />
              <MetricCard label="Пользователи" value={`${formatNumber(company.users)} / ${data.limits?.maxUsers ?? '∞'}`} />
              <MetricCard label="Уведомления" value={formatNumber(data.alerts.filter((alert) => alert.status === 'new').length)} hint={`Всего: ${formatNumber(data.alerts.length)}`} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <form onSubmit={handleCompanySave} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-gray-950">Основные данные</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} placeholder="Название" required />
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={companyForm.slug} onChange={(event) => setCompanyForm({ ...companyForm, slug: event.target.value })} placeholder="Slug" required />
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={companyForm.region_code} onChange={(event) => setCompanyForm({ ...companyForm, region_code: event.target.value })} placeholder="Регион" />
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={companyForm.data_residency} onChange={(event) => setCompanyForm({ ...companyForm, data_residency: event.target.value })} placeholder="Data residency" />
                  <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={companyForm.status} onChange={(event) => setCompanyForm({ ...companyForm, status: event.target.value === 'inactive' ? 'inactive' : 'active' })}>
                    <option value="active">Активна</option>
                    <option value="inactive">Отключена</option>
                  </select>
                </div>
                <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Сохранить компанию</button>
              </form>

              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-gray-950">Владельцы</h2>
                <div className="mt-4 space-y-3">
                  {data.owners.length ? data.owners.map((owner) => (
                    <div key={owner.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="font-medium text-gray-950">{owner.name}</div>
                      <div className="mt-1 text-sm text-gray-500">{owner.email} · {owner.status}</div>
                      <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${setupStatusClass(owner)}`}>{setupStatusLabel(owner)}</div>
                      {ownerSetupLinks[owner.id] ? (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
                          <input className="min-w-0 flex-1 bg-transparent text-xs text-blue-900 outline-none" readOnly value={ownerSetupLinks[owner.id]} />
                          <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => void handleCopySetupLink(ownerSetupLinks[owner.id])}>Копировать</button>
                          <a className="text-xs font-semibold text-blue-700" href={ownerInviteMailto(owner, ownerSetupLinks[owner.id])}>Письмо</a>
                        </div>
                      ) : null}
                      {owner.status !== 'inactive' ? (
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button type="button" disabled={saving} onClick={() => void handleIssueOwnerSetupLink(owner.id)} className="text-xs font-semibold text-blue-600 disabled:opacity-50">
                            {owner.setup?.status === 'accepted' ? 'Создать новую ссылку' : 'Выдать setup-ссылку'}
                          </button>
                          <button type="button" disabled={saving} onClick={() => void handleOwnerDeactivate(owner.id)} className="text-xs font-semibold text-red-600 disabled:opacity-50">Отключить</button>
                        </div>
                      ) : null}
                    </div>
                  )) : <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Владелец не назначен</div>}
                </div>
                <form onSubmit={handleOwnerCreate} className="mt-4 grid gap-3 md:grid-cols-2">
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" type="email" value={ownerForm.email} onChange={(event) => setOwnerForm({ ...ownerForm, email: event.target.value })} placeholder="Email владельца" required />
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={ownerForm.name} onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} placeholder="Имя владельца" required />
                  <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">Создать владельца</button>
                </form>
              </section>
            </div>

            <form onSubmit={handleLimitsSave} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-950">Тариф, лимиты и модули</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={limitForm.planCode || ''} onChange={(event) => setLimitForm({ ...limitForm, planCode: event.target.value })}>
                  {data.plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                </select>
                <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" inputMode="numeric" placeholder="Лимит техники" value={limitForm.maxVehicles ?? ''} onChange={(event) => setLimitForm({ ...limitForm, maxVehicles: numberOrNull(event.target.value) })} />
                <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" inputMode="numeric" placeholder="Лимит пользователей" value={limitForm.maxUsers ?? ''} onChange={(event) => setLimitForm({ ...limitForm, maxUsers: numberOrNull(event.target.value) })} />
                <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" inputMode="numeric" placeholder="Хранилище, МБ" value={limitForm.maxStorageMb ?? ''} onChange={(event) => setLimitForm({ ...limitForm, maxStorageMb: numberOrNull(event.target.value) })} />
              </div>
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.ocrEnabled)} onChange={(event) => setLimitForm({ ...limitForm, ocrEnabled: event.target.checked })} /> OCR</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.accidentModuleEnabled)} onChange={(event) => setLimitForm({ ...limitForm, accidentModuleEnabled: event.target.checked })} /> ДТП-модуль</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.analyticsEnabled)} onChange={(event) => setLimitForm({ ...limitForm, analyticsEnabled: event.target.checked })} /> Аналитика</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.apiAccessEnabled)} onChange={(event) => setLimitForm({ ...limitForm, apiAccessEnabled: event.target.checked })} /> API-доступ</label>
              </div>
              <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Сохранить тариф и лимиты</button>
            </form>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
                  <h2 className="text-base font-semibold text-gray-950">Платежи</h2>
                  <Link href="/saas-admin/payments" className="text-sm font-medium text-blue-700">Добавить платеж</Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr><th className="px-4 py-3">Дата</th><th className="px-4 py-3">Период</th><th className="px-4 py-3">Сумма</th><th className="px-4 py-3">Статус</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.payments.slice(0, 8).map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-4 py-3">{formatDate(payment.paymentDate)}</td>
                          <td className="px-4 py-3">{formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}</td>
                          <td className="px-4 py-3">{formatCurrency(payment.amount, payment.currency)}</td>
                          <td className="px-4 py-3">{payment.status}</td>
                        </tr>
                      ))}
                      {!data.payments.length ? <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={4}>Платежей пока нет</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
                  <h2 className="text-base font-semibold text-gray-950">Уведомления</h2>
                  <Link href="/saas-admin/alerts" className="text-sm font-medium text-blue-700">Открыть ленту</Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {data.alerts.slice(0, 8).map((alert) => (
                    <div key={alert.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-gray-950">{alert.title}</div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(alert.status === 'new' ? alert.type : 'read')}`}>{alert.status}</span>
                      </div>
                      <div className="mt-1 text-sm leading-6 text-gray-500">{alert.message}</div>
                    </div>
                  ))}
                  {!data.alerts.length ? <div className="px-4 py-6 text-center text-sm text-gray-500">Уведомлений нет</div> : null}
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-4">
                <h2 className="text-base font-semibold text-gray-950">Журнал действий</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr><th className="px-4 py-3">Дата</th><th className="px-4 py-3">Действие</th><th className="px-4 py-3">Объект</th><th className="px-4 py-3">Кто</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-gray-950">{log.action}</td>
                        <td className="px-4 py-3">{log.entityType || 'resource'} {log.entityId ? `· ${log.entityId}` : ''}</td>
                        <td className="px-4 py-3">{log.actorName || log.actorEmail || log.actorRole || 'system'}</td>
                      </tr>
                    ))}
                    {!data.auditLogs.length ? <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={4}>Журнал пока пуст</td></tr> : null}
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
