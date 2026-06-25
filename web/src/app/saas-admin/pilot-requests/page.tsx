'use client'

import { type FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type {
  PilotConversionPayload,
  PilotRequest,
  PilotRequestAssignee,
  PilotRequestStatus,
  PilotRequestSummary,
} from '@/lib/types'

const STATUS_LABELS: Record<PilotRequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  converted: 'Компания создана',
}

const PLAN_LABELS: Record<string, string> = {
  pilot: 'Пилот',
  standard: 'Стандарт',
  enterprise: 'Enterprise',
}

const EMPTY_SUMMARY: PilotRequestSummary = {
  total: 0,
  new: 0,
  inProgress: 0,
  approved: 0,
  rejected: 0,
  converted: 0,
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function statusClass(status: PilotRequestStatus) {
  if (status === 'new') return 'bg-blue-50 text-blue-700'
  if (status === 'in_progress') return 'bg-amber-50 text-amber-800'
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700'
  if (status === 'converted') return 'bg-violet-50 text-violet-700'
  return 'bg-gray-100 text-gray-600'
}

function nullableNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function PilotRequestsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const [requests, setRequests] = useState<PilotRequest[]>([])
  const [summary, setSummary] = useState<PilotRequestSummary>(EMPTY_SUMMARY)
  const [assignees, setAssignees] = useState<PilotRequestAssignee[]>([])
  const [selected, setSelected] = useState<PilotRequest | null>(null)
  const [conversion, setConversion] = useState<PilotConversionPayload | null>(null)
  const [setupUrl, setSetupUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    assignedUserId: searchParams.get('assignedUserId') || '',
    region: searchParams.get('region') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  }))

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const [requestsResult, assigneesResult] = await Promise.all([
        api.getPilotRequests(query),
        api.getPilotRequestAssignees(),
      ])
      if (cancelled) return
      if (requestsResult.data) {
        setRequests(requestsResult.data.requests)
        setSummary(requestsResult.data.summary)
        setError('')
      } else {
        setError(requestsResult.error || 'Не удалось загрузить заявки')
      }
      if (assigneesResult.data) setAssignees(assigneesResult.data.users)
      setLoading(false)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const reload = async () => {
    const result = await api.getPilotRequests(query)
    if (result.data) {
      setRequests(result.data.requests)
      setSummary(result.data.summary)
      window.dispatchEvent(new Event('pilot-requests-updated'))
    } else {
      setError(result.error || 'Не удалось обновить заявки')
    }
  }

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    router.replace(params.size ? `/saas-admin/pilot-requests?${params}` : '/saas-admin/pilot-requests')
  }

  const openRequest = async (id: string) => {
    setError('')
    setMessage('')
    setSetupUrl('')
    const result = await api.getPilotRequest(id)
    if (result.data) setSelected(result.data)
    else setError(result.error || 'Не удалось открыть заявку')
  }

  const saveRequest = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    const result = await api.updatePilotRequest(selected.id, selected)
    setSaving(false)
    if (!result.data) {
      setError(result.error || 'Не удалось сохранить заявку')
      return
    }
    setSelected(result.data)
    setMessage('Заявка обновлена')
    await reload()
  }

  const rejectRequest = async () => {
    if (!selected) return
    const reason = window.prompt('Укажите причину отказа', selected.rejectionReason || '')
    if (reason === null) return
    const rejectionReason = reason.trim()
    if (!rejectionReason) {
      setError('Для отклонения заявки укажите причину отказа')
      return
    }
    setSaving(true)
    setError('')
    const result = await api.updatePilotRequest(selected.id, {
      ...selected,
      status: 'rejected',
      rejectionReason,
    })
    setSaving(false)
    if (!result.data) {
      setError(result.error || 'Не удалось отклонить заявку')
      return
    }
    setSelected(result.data)
    setMessage('Заявка отклонена')
    await reload()
  }

  const openCompanyCreateFromRequest = () => {
    if (!selected) return
    const params = new URLSearchParams({
      create: 'company',
      pilotRequestId: selected.id,
      name: selected.companyName,
    })
    if (selected.preferredPlanCode) params.set('plan', selected.preferredPlanCode)
    router.push(`/saas-admin/companies?${params}`)
  }

  const openConversion = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    const result = await api.getPilotConversionPreview(selected.id)
    setSaving(false)
    if (result.data) setConversion(result.data)
    else setError(result.error || 'Не удалось подготовить создание компании')
  }

  const convert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !conversion) return
    setSaving(true)
    setError('')
    const result = await api.convertPilotRequest(selected.id, conversion)
    setSaving(false)
    if (!result.data) {
      setError(result.error || 'Не удалось создать компанию')
      return
    }
    setSelected(result.data.request)
    setSetupUrl(result.data.setup.setup_url)
    setConversion(null)
    setMessage('Компания и владелец созданы')
    await reload()
  }

  const anonymize = async () => {
    if (!selected || !window.confirm('Удалить контактные данные из этой заявки?')) return
    setSaving(true)
    const result = await api.anonymizePilotRequest(selected.id)
    setSaving(false)
    if (result.data) {
      setSelected(result.data)
      setMessage('Контактные данные удалены')
      await reload()
    } else setError(result.error || 'Не удалось обезличить заявку')
  }

  return (
    <Layout currentPage="resource-pilot-requests">
      <div className="resource-admin-page mx-auto max-w-[1500px] space-y-6 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Pilot requests</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">Заявки на пилот</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
            Очередь обращений с лендинга: квалификация, назначение ответственного и создание пилотной компании.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ['Всего', summary.total],
            ['Новые', summary.new],
            ['В работе', summary.inProgress],
            ['Одобрены', summary.approved],
            ['Отклонены', summary.rejected],
            ['Созданы', summary.converted],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border bg-white p-4">
              <div className="text-xs font-medium text-gray-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
            </div>
          ))}
        </div>

        <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 xl:grid-cols-7" onSubmit={applyFilters}>
          <input className="rounded-lg border px-3 py-2 xl:col-span-2" placeholder="Компания, контакт, email, телефон" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          <select className="rounded-lg border px-3 py-2" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2" value={filters.assignedUserId} onChange={(event) => setFilters((current) => ({ ...current, assignedUserId: event.target.value }))}>
            <option value="">Все ответственные</option>
            {assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
          <input className="rounded-lg border px-3 py-2" placeholder="Регион" value={filters.region} onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))} />
          <input className="rounded-lg border px-3 py-2" type="date" aria-label="Дата от" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-lg border px-3 py-2" type="date" aria-label="Дата до" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
            <button type="submit" className="btn btn-secondary">Найти</button>
          </div>
        </form>

        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        <section className="overflow-hidden rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Компания</th>
                  <th className="px-4 py-3">Контакт</th>
                  <th className="px-4 py-3">Тариф</th>
                  <th className="px-4 py-3">Парк</th>
                  <th className="px-4 py-3">Регион</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Ответственный</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(request.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-950">{request.companyName}</td>
                    <td className="px-4 py-3">
                      <div>{request.contactName || 'Обезличено'}</div>
                      <div className="text-xs text-gray-500">{request.contactEmail || request.contactPhone || '—'}</div>
                    </td>
                    <td className="px-4 py-3">{PLAN_LABELS[request.preferredPlanCode || 'pilot'] || request.preferredPlanCode || 'Пилот'}</td>
                    <td className="px-4 py-3">{request.vehicleCount}</td>
                    <td className="px-4 py-3">{request.region || '—'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{STATUS_LABELS[request.status]}</span></td>
                    <td className="px-4 py-3">{request.assignedUserName || 'Не назначен'}</td>
                    <td className="px-4 py-3"><button type="button" className="font-medium text-blue-700" onClick={() => void openRequest(request.id)}>Открыть</button></td>
                  </tr>
                ))}
                {!loading && !requests.length ? <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">Заявки не найдены</td></tr> : null}
                {loading ? <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">Загрузка заявок…</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
          <section className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-950">{selected.companyName}</h2>
                <p className="mt-1 text-sm text-gray-500">Заявка от {formatDate(selected.createdAt)} · источник: {selected.source || 'не указан'}</p>
              </div>
              <button type="button" className="text-gray-500" onClick={() => setSelected(null)}>Закрыть</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label><span className="label">Компания</span><input className="input" value={selected.companyName} disabled={selected.status === 'converted'} onChange={(event) => setSelected({ ...selected, companyName: event.target.value })} /></label>
              <label><span className="label">Количество техники</span><input className="input" type="number" min="1" value={selected.vehicleCount} disabled={selected.status === 'converted'} onChange={(event) => setSelected({ ...selected, vehicleCount: Number(event.target.value) })} /></label>
              <label><span className="label">Контактное лицо</span><input className="input" value={selected.contactName || ''} disabled={selected.status === 'converted' || Boolean(selected.anonymizedAt)} onChange={(event) => setSelected({ ...selected, contactName: event.target.value })} /></label>
              <label><span className="label">Email</span><input className="input" type="email" value={selected.contactEmail || ''} disabled={selected.status === 'converted' || Boolean(selected.anonymizedAt)} onChange={(event) => setSelected({ ...selected, contactEmail: event.target.value })} /></label>
              <label><span className="label">Телефон</span><input className="input" value={selected.contactPhone || ''} disabled={selected.status === 'converted' || Boolean(selected.anonymizedAt)} onChange={(event) => setSelected({ ...selected, contactPhone: event.target.value })} /></label>
              <label><span className="label">Регион</span><input className="input" value={selected.region || ''} disabled={selected.status === 'converted'} onChange={(event) => setSelected({ ...selected, region: event.target.value })} /></label>
              <label><span className="label">Тариф</span><select className="select" value={selected.preferredPlanCode || 'pilot'} disabled={selected.status === 'converted'} onChange={(event) => setSelected({ ...selected, preferredPlanCode: event.target.value })}>{Object.entries(PLAN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span className="label">Статус</span><select className="select" value={selected.status} disabled={selected.status === 'converted'} onChange={(event) => setSelected({ ...selected, status: event.target.value as PilotRequestStatus })}>{Object.entries(STATUS_LABELS).filter(([value]) => value !== 'converted' || selected.status === 'converted').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span className="label">Ответственный</span><select className="select" value={selected.assignedUserId || ''} disabled={selected.status === 'converted'} onChange={(event) => setSelected({ ...selected, assignedUserId: event.target.value || null })}><option value="">Не назначен</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
              <label className="md:col-span-2"><span className="label">Комментарий клиента</span><textarea className="input min-h-20" value={selected.comment || ''} disabled={selected.status === 'converted' || Boolean(selected.anonymizedAt)} onChange={(event) => setSelected({ ...selected, comment: event.target.value })} /></label>
              <label className="md:col-span-2"><span className="label">Внутренний комментарий</span><textarea className="input min-h-24" value={selected.internalComment || ''} disabled={selected.status === 'converted'} onChange={(event) => setSelected({ ...selected, internalComment: event.target.value })} /></label>
              {selected.status === 'rejected' ? <label className="md:col-span-2"><span className="label">Причина отказа *</span><textarea className="input min-h-20" value={selected.rejectionReason || ''} onChange={(event) => setSelected({ ...selected, rejectionReason: event.target.value })} required /></label> : null}
            </div>
            {setupUrl ? (
              <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="font-semibold">Компания создана. Ссылка настройки владельца:</div>
                <div className="mt-2 break-all">{setupUrl}</div>
                <button type="button" className="mt-3 font-semibold text-emerald-800" onClick={() => void navigator.clipboard.writeText(setupUrl)}>Копировать ссылку</button>
              </div>
            ) : null}
            {selected.linkedCompanyId ? <p className="mt-4 text-sm"><Link className="font-medium text-blue-700" href={`/saas-admin/companies/${selected.linkedCompanyId}`}>Открыть созданную компанию</Link></p> : null}
            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <div>{selected.status === 'rejected' && !selected.anonymizedAt ? <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void anonymize()}>Обезличить</button> : null}</div>
              <div className="flex flex-wrap gap-3">
                {selected.status !== 'converted' ? <button type="button" className="btn btn-secondary" disabled={saving} onClick={openCompanyCreateFromRequest}>Добавить компанию</button> : null}
                {selected.status !== 'converted' && selected.status !== 'rejected' ? <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void rejectRequest()}>Отклонить</button> : null}
                {selected.status === 'approved' ? <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void openConversion()}>Создать пилотную компанию</button> : null}
                {selected.status !== 'converted' ? <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveRequest()}>{saving ? 'Сохраняем…' : 'Сохранить'}</button> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {conversion && selected ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center">
          <form className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl" onSubmit={convert}>
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Создание пилотной компании</h2><p className="mt-1 text-sm text-gray-500">Проверьте компанию, владельца и лимиты тарифа {PLAN_LABELS[conversion.planCode] || conversion.planCode}.</p></div><button type="button" className="text-gray-500" onClick={() => setConversion(null)}>Закрыть</button></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label><span className="label">Название компании</span><input className="input" required value={conversion.companyName} onChange={(event) => setConversion({ ...conversion, companyName: event.target.value })} /></label>
              <label><span className="label">Slug</span><input className="input" required value={conversion.slug} onChange={(event) => setConversion({ ...conversion, slug: event.target.value })} /></label>
              <label><span className="label">Регион</span><input className="input" value={conversion.regionCode || ''} onChange={(event) => setConversion({ ...conversion, regionCode: event.target.value })} /></label>
              <label><span className="label">Регион хранения</span><input className="input" value={conversion.dataResidency || ''} onChange={(event) => setConversion({ ...conversion, dataResidency: event.target.value })} /></label>
              <label><span className="label">Владелец</span><input className="input" required value={conversion.ownerName} onChange={(event) => setConversion({ ...conversion, ownerName: event.target.value })} /></label>
              <label><span className="label">Email владельца</span><input className="input" type="email" required value={conversion.ownerEmail} onChange={(event) => setConversion({ ...conversion, ownerEmail: event.target.value })} /></label>
              <label><span className="label">Техника</span><input className="input" type="number" value={conversion.limits.maxVehicles ?? ''} onChange={(event) => setConversion({ ...conversion, limits: { ...conversion.limits, maxVehicles: nullableNumber(event.target.value) } })} /></label>
              <label><span className="label">Пользователи</span><input className="input" type="number" value={conversion.limits.maxUsers ?? ''} onChange={(event) => setConversion({ ...conversion, limits: { ...conversion.limits, maxUsers: nullableNumber(event.target.value) } })} /></label>
              <label><span className="label">Осмотры в месяц</span><input className="input" type="number" value={conversion.limits.maxInspectionsPerMonth ?? ''} onChange={(event) => setConversion({ ...conversion, limits: { ...conversion.limits, maxInspectionsPerMonth: nullableNumber(event.target.value) } })} /></label>
              <label><span className="label">Хранилище, МБ</span><input className="input" type="number" value={conversion.limits.maxStorageMb ?? ''} onChange={(event) => setConversion({ ...conversion, limits: { ...conversion.limits, maxStorageMb: nullableNumber(event.target.value) } })} /></label>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['ocrEnabled', 'OCR'],
                ['accidentModuleEnabled', 'ДТП'],
                ['analyticsEnabled', 'Аналитика'],
                ['pdfReportEnabled', 'PDF-отчёты'],
                ['exportEnabled', 'Экспорт'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(conversion.limits[key as keyof typeof conversion.limits])} onChange={(event) => setConversion({ ...conversion, limits: { ...conversion.limits, [key]: event.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" className="btn btn-secondary" onClick={() => setConversion(null)}>Отмена</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Создаём…' : 'Создать компанию и владельца'}</button></div>
          </form>
        </div>
      ) : null}
    </Layout>
  )
}
