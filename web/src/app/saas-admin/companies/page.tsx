'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { ResourceCompanyLimitsPayload, SaasAdminStats, SaasCompanyStats, SaasOwner } from '@/lib/types'

type CompanyForm = {
  id: string
  slug: string
  name: string
}

type OwnerForm = {
  companyId: string
  email: string
  name: string
}

type LimitForm = ResourceCompanyLimitsPayload & {
  companyId: string
}

const emptyCompanyForm: CompanyForm = { id: '', slug: '', name: '' }
const emptyOwnerForm: OwnerForm = { companyId: '', email: '', name: '' }
const emptyLimitForm: LimitForm = {
  companyId: '',
  planCode: 'pilot',
  maxVehicles: null,
  maxUsers: null,
  maxStorageMb: null,
  ocrEnabled: true,
  accidentModuleEnabled: true,
  analyticsEnabled: true,
  apiAccessEnabled: false,
}

function numberOrNull(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function displayLimit(value?: number | null) {
  return value === null || value === undefined ? 'Без лимита' : String(value)
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ru-RU')
}

function formatCurrency(value?: number | null) {
  return `${formatNumber(value)} ₽`
}

function formatDate(value?: string | null) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
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

function companyLimitForm(company: SaasCompanyStats | undefined): LimitForm {
  return {
    companyId: company?.id || '',
    planCode: company?.limits?.planCode || 'pilot',
    maxVehicles: company?.limits?.maxVehicles ?? null,
    maxUsers: company?.limits?.maxUsers ?? null,
    maxStorageMb: company?.limits?.maxStorageMb ?? null,
    ocrEnabled: company?.limits?.ocrEnabled ?? true,
    accidentModuleEnabled: company?.limits?.accidentModuleEnabled ?? true,
    analyticsEnabled: company?.limits?.analyticsEnabled ?? true,
    apiAccessEnabled: company?.limits?.apiAccessEnabled ?? false,
  }
}

export default function ResourceCompaniesPage() {
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm)
  const [ownerForm, setOwnerForm] = useState<OwnerForm>(emptyOwnerForm)
  const [limitForm, setLimitForm] = useState<LimitForm>(emptyLimitForm)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ownerSetupLinks, setOwnerSetupLinks] = useState<Record<string, string>>({})

  const companies = useMemo(() => stats?.companies || [], [stats])
  const plans = useMemo(() => stats?.plans || [], [stats])
  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase()
    return companies.filter((company) => {
      const ownerText = (company.ownerUsers || []).map((owner) => `${owner.name} ${owner.email}`).join(' ')
      const matchesQuery = !query || `${company.name} ${company.slug} ${company.id} ${ownerText}`.toLowerCase().includes(query)
      const matchesStatus =
        statusFilter === 'all' ||
        company.status === statusFilter ||
        (statusFilter === 'no-owner' && !company.owners) ||
        (statusFilter === 'no-limits' && !company.limits?.planCode) ||
        (statusFilter === 'expired' && ['expired', 'suspended'].includes(company.subscription?.status || '')) ||
        (statusFilter === 'expiring' && ['expiring', 'grace'].includes(company.subscription?.status || ''))
      return matchesQuery && matchesStatus
    })
  }, [companies, search, statusFilter])

  const loadStats = async () => {
    setLoading(true)
    setError('')
    const result = await api.getSaasAdminStats()
    const data = result.data
    if (data) {
      setStats(data)
      const firstCompany = data.companies[0]
      setOwnerForm((current) => ({ ...current, companyId: current.companyId || firstCompany?.id || '' }))
      setLimitForm((current) => current.companyId ? current : companyLimitForm(firstCompany))
    } else {
      setError(result.error || 'Не удалось загрузить реестр компаний')
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStats()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const withSave = async (action: () => Promise<boolean>) => {
    setSaving(true)
    setError('')
    setMessage('')
    const ok = await action()
    if (ok) await loadStats()
    setSaving(false)
  }

  const handleCreateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withSave(async () => {
      const result = await api.createResourceCompany({
        id: companyForm.id || companyForm.slug,
        slug: companyForm.slug || companyForm.id,
        name: companyForm.name,
        limits: {
          planCode: 'pilot',
          maxVehicles: 25,
          maxUsers: 10,
          maxStorageMb: 10240,
          ocrEnabled: true,
          accidentModuleEnabled: true,
          analyticsEnabled: true,
          apiAccessEnabled: false,
        },
      })
      if (result.data) {
        setCompanyForm(emptyCompanyForm)
        setMessage('Компания создана')
        return true
      }
      setError(result.error || 'Не удалось создать компанию')
      return false
    })
  }

  const handleCreateOwner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withSave(async () => {
      const result = await api.createResourceOwner(ownerForm.companyId, {
        email: ownerForm.email,
        name: ownerForm.name,
        issue_setup_link: true,
      })
      if (result.data) {
        const owner = result.data
        setOwnerForm({ ...emptyOwnerForm, companyId: ownerForm.companyId })
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

  const handleSaveLimits = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withSave(async () => {
      const result = await api.updateResourceCompanyLimits(limitForm.companyId, {
        planCode: limitForm.planCode,
        maxVehicles: limitForm.maxVehicles ?? null,
        maxUsers: limitForm.maxUsers ?? null,
        maxStorageMb: limitForm.maxStorageMb ?? null,
        ocrEnabled: Boolean(limitForm.ocrEnabled),
        accidentModuleEnabled: Boolean(limitForm.accidentModuleEnabled),
        analyticsEnabled: Boolean(limitForm.analyticsEnabled),
        apiAccessEnabled: Boolean(limitForm.apiAccessEnabled),
      })
      if (result.data) {
        setMessage('Лимиты компании обновлены')
        return true
      }
      setError(result.error || 'Не удалось обновить лимиты')
      return false
    })
  }

  const handleToggleCompanyStatus = async (company: SaasCompanyStats) => {
    await withSave(async () => {
      const result = await api.updateResourceCompany(company.id, {
        slug: company.slug,
        name: company.name,
        region_code: company.region_code || undefined,
        data_residency: company.data_residency || undefined,
        status: company.status === 'inactive' ? 'active' : 'inactive',
      })
      if (result.data) {
        setMessage(company.status === 'inactive' ? 'Компания активирована' : 'Компания отключена')
        return true
      }
      setError(result.error || 'Не удалось изменить статус компании')
      return false
    })
  }

  const handleDeactivateOwner = async (ownerId: string) => {
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

  return (
    <Layout currentPage="resource-companies">
      <div className="resource-admin-page mx-auto max-w-[1600px] space-y-8 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Company registry</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">Компании</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
            Реестр компаний, владельцы, тарифные лимиты и статусы без доступа к операционным карточкам tenant-данных.
          </p>
        </div>

        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}

        {loading ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Загрузка компаний...</div>
        ) : stats ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <form onSubmit={handleCreateCompany} className="rounded-lg border bg-white p-4">
                <h2 className="text-base font-semibold">Создать компанию</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input className="rounded-lg border px-3 py-2" placeholder="id" value={companyForm.id} onChange={(event) => setCompanyForm({ ...companyForm, id: event.target.value })} />
                  <input className="rounded-lg border px-3 py-2" placeholder="slug" value={companyForm.slug} onChange={(event) => setCompanyForm({ ...companyForm, slug: event.target.value })} />
                  <input className="rounded-lg border px-3 py-2" placeholder="Название" value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} required />
                </div>
                <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={saving}>Создать</button>
              </form>

              <form onSubmit={handleCreateOwner} className="rounded-lg border bg-white p-4">
                <h2 className="text-base font-semibold">Создать владельца компании</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <select className="rounded-lg border px-3 py-2" value={ownerForm.companyId} onChange={(event) => setOwnerForm({ ...ownerForm, companyId: event.target.value })} required>
                    <option value="">Компания</option>
                    {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                  <input className="rounded-lg border px-3 py-2" type="email" placeholder="email" value={ownerForm.email} onChange={(event) => setOwnerForm({ ...ownerForm, email: event.target.value })} required />
                  <input className="rounded-lg border px-3 py-2" placeholder="Имя" value={ownerForm.name} onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} required />
                </div>
                <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={saving}>Создать владельца</button>
              </form>
            </div>

            <form onSubmit={handleSaveLimits} className="rounded-lg border bg-white p-4">
              <h2 className="text-base font-semibold">Тариф, лимиты и модули компании</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <select className="rounded-lg border px-3 py-2" value={limitForm.companyId} onChange={(event) => setLimitForm(companyLimitForm(companies.find((company) => company.id === event.target.value)))} required>
                  <option value="">Компания</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
                <select className="rounded-lg border px-3 py-2" value={limitForm.planCode || ''} onChange={(event) => setLimitForm({ ...limitForm, planCode: event.target.value })}>
                  {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                </select>
                <input className="rounded-lg border px-3 py-2" inputMode="numeric" placeholder="Лимит техники" value={limitForm.maxVehicles ?? ''} onChange={(event) => setLimitForm({ ...limitForm, maxVehicles: numberOrNull(event.target.value) })} />
                <input className="rounded-lg border px-3 py-2" inputMode="numeric" placeholder="Лимит пользователей" value={limitForm.maxUsers ?? ''} onChange={(event) => setLimitForm({ ...limitForm, maxUsers: numberOrNull(event.target.value) })} />
                <input className="rounded-lg border px-3 py-2" inputMode="numeric" placeholder="Хранилище, МБ" value={limitForm.maxStorageMb ?? ''} onChange={(event) => setLimitForm({ ...limitForm, maxStorageMb: numberOrNull(event.target.value) })} />
              </div>
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.ocrEnabled)} onChange={(event) => setLimitForm({ ...limitForm, ocrEnabled: event.target.checked })} /> OCR</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.accidentModuleEnabled)} onChange={(event) => setLimitForm({ ...limitForm, accidentModuleEnabled: event.target.checked })} /> ДТП-модуль</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.analyticsEnabled)} onChange={(event) => setLimitForm({ ...limitForm, analyticsEnabled: event.target.checked })} /> Аналитика</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(limitForm.apiAccessEnabled)} onChange={(event) => setLimitForm({ ...limitForm, apiAccessEnabled: event.target.checked })} /> API-доступ</label>
              </div>
              <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={saving || !limitForm.companyId}>Сохранить лимиты</button>
            </form>

            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-4">
                <h2 className="text-base font-semibold">Реестр компаний</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_240px]">
                  <input className="rounded-lg border px-3 py-2" placeholder="Поиск по компании, slug или владельцу..." value={search} onChange={(event) => setSearch(event.target.value)} />
                  <select className="rounded-lg border px-3 py-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
                    {filteredCompanies.map((company) => (
                      <tr key={company.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{company.name}</div>
                          <div className="text-xs text-gray-500">{company.slug || company.id}</div>
                        </td>
                        <td className="px-4 py-3">{company.subscription?.status || company.status}</td>
                        <td className="px-4 py-3">
                          {company.ownerUsers?.length ? company.ownerUsers.map((owner) => (
                            <div key={owner.id} className="mb-2">
                              <div className="font-medium">{owner.name}</div>
                              <div className="text-xs text-gray-500">{owner.email} · {owner.status}</div>
                              <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${setupStatusClass(owner)}`}>{setupStatusLabel(owner)}</div>
                              {ownerSetupLinks[owner.id] ? (
                                <div className="mt-2 flex max-w-xs items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
                                  <input className="min-w-0 flex-1 bg-transparent text-xs text-blue-900 outline-none" readOnly value={ownerSetupLinks[owner.id]} />
                                  <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => void handleCopySetupLink(ownerSetupLinks[owner.id])}>Копировать</button>
                                  <a className="text-xs font-semibold text-blue-700" href={ownerInviteMailto(owner, ownerSetupLinks[owner.id])}>Письмо</a>
                                </div>
                              ) : null}
                              {owner.status !== 'inactive' ? (
                                <div className="mt-2 flex flex-wrap gap-3">
                                  <button type="button" className="text-xs font-semibold text-blue-600" disabled={saving} onClick={() => void handleIssueOwnerSetupLink(owner.id)}>
                                    {owner.setup?.status === 'accepted' ? 'Создать новую ссылку' : 'Выдать setup-ссылку'}
                                  </button>
                                  <button type="button" className="text-xs font-semibold text-red-600" disabled={saving} onClick={() => void handleDeactivateOwner(owner.id)}>Отключить</button>
                                </div>
                              ) : null}
                            </div>
                          )) : 'Нет владельца'}
                        </td>
                        <td className="px-4 py-3">{company.limits?.planCode || 'Не задан'}</td>
                        <td className="px-4 py-3">{formatDate(company.subscription?.currentPeriodEnd)}</td>
                        <td className="px-4 py-3">{formatNumber(company.usage?.vehicles)} / {displayLimit(company.limits?.maxVehicles)}</td>
                        <td className="px-4 py-3">{formatNumber(company.users)} / {displayLimit(company.limits?.maxUsers)}</td>
                        <td className="px-4 py-3">{formatCurrency(company.billing?.monthlyRevenueRub)}</td>
                        <td className="px-4 py-3">
                          <Link className="mr-3 text-blue-600" href={`/saas-admin/companies/${company.id}`}>Открыть</Link>
                          <button className="mr-3 text-blue-600" disabled={saving} onClick={() => setLimitForm(companyLimitForm(company))}>Лимиты</button>
                          <button className="text-red-600" disabled={saving} onClick={() => void handleToggleCompanyStatus(company)}>
                            {company.status === 'inactive' ? 'Активировать' : 'Отключить'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredCompanies.length ? <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={9}>Компании не найдены</td></tr> : null}
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
