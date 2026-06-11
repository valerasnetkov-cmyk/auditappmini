'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { ResourcePlanPayload, SaasAdminStats } from '@/lib/types'
import { Badge, NoticeCard, Skeleton, StatusButton } from '@/components/ui'

type PlanForm = ResourcePlanPayload & {
  code: string
  name: string
}

const emptyPlanForm: PlanForm = {
  code: '',
  name: '',
  status: 'active',
  maxVehicles: null,
  maxUsers: null,
  maxStorageMb: null,
  monthlyPriceRub: 0,
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

function displayFlag(value?: boolean | null) {
  if (value === null || value === undefined) return 'Не задано'
  return value ? 'Включено' : 'Отключено'
}

function formatCurrency(value?: number | null) {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`
}

export default function ResourcePlansPage() {
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const plans = useMemo(() => stats?.plans || [], [stats])

  const loadStats = async () => {
    setLoading(true)
    setError('')
    const result = await api.getSaasAdminStats()
    if (result.data) {
      setStats(result.data)
    } else {
      setError(result.error || 'Не удалось загрузить тарифы')
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

  const handleCreatePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withSave(async () => {
      const result = await api.createResourcePlan(planForm)
      if (result.data) {
        setPlanForm(emptyPlanForm)
        setMessage('Тариф создан')
        return true
      }
      setError(result.error || 'Не удалось создать тариф')
      return false
    })
  }

  const handleArchivePlan = async (code: string) => {
    await withSave(async () => {
      const result = await api.updateResourcePlan(code, { status: 'archived' })
      if (result.data) {
        setMessage('Тариф архивирован')
        return true
      }
      setError(result.error || 'Не удалось архивировать тариф')
      return false
    })
  }

  const handleDeletePlan = async (code: string) => {
    await withSave(async () => {
      const result = await api.deleteResourcePlan(code)
      if (!result.error) {
        setMessage('Тариф удален')
        return true
      }
      setError(result.error)
      return false
    })
  }

  return (
    <Layout currentPage="resource-plans">
      <div className="resource-admin-page mx-auto max-w-[1400px] space-y-8 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Plans and limits</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">Тарифы</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
            Шаблоны тарифов, цены, лимиты и feature flags для компаний ресурса.
          </p>
        </div>

        {error ? <NoticeCard title="Не удалось изменить тарифы" tone="danger" compact>{error}</NoticeCard> : null}
        {message ? <NoticeCard title="Изменения сохранены" tone="success" compact>{message}</NoticeCard> : null}

        {loading ? (
          <Skeleton className="h-44" />
        ) : stats ? (
          <>
            <form onSubmit={handleCreatePlan} className="rounded-lg border bg-white p-4">
              <h2 className="text-base font-semibold">Создать тариф</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input className="rounded-lg border px-3 py-2" placeholder="code" value={planForm.code} onChange={(event) => setPlanForm({ ...planForm, code: event.target.value })} required />
                <input className="rounded-lg border px-3 py-2" placeholder="Название" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required />
                <input className="rounded-lg border px-3 py-2" inputMode="numeric" placeholder="Цена в месяц, ₽" value={planForm.monthlyPriceRub ?? ''} onChange={(event) => setPlanForm({ ...planForm, monthlyPriceRub: numberOrNull(event.target.value) })} />
                <input className="rounded-lg border px-3 py-2" inputMode="numeric" placeholder="Лимит техники" value={planForm.maxVehicles ?? ''} onChange={(event) => setPlanForm({ ...planForm, maxVehicles: numberOrNull(event.target.value) })} />
                <input className="rounded-lg border px-3 py-2" inputMode="numeric" placeholder="Лимит пользователей" value={planForm.maxUsers ?? ''} onChange={(event) => setPlanForm({ ...planForm, maxUsers: numberOrNull(event.target.value) })} />
                <input className="rounded-lg border px-3 py-2" inputMode="numeric" placeholder="Хранилище, МБ" value={planForm.maxStorageMb ?? ''} onChange={(event) => setPlanForm({ ...planForm, maxStorageMb: numberOrNull(event.target.value) })} />
              </div>
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(planForm.ocrEnabled)} onChange={(event) => setPlanForm({ ...planForm, ocrEnabled: event.target.checked })} /> OCR</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(planForm.accidentModuleEnabled)} onChange={(event) => setPlanForm({ ...planForm, accidentModuleEnabled: event.target.checked })} /> ДТП-модуль</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(planForm.analyticsEnabled)} onChange={(event) => setPlanForm({ ...planForm, analyticsEnabled: event.target.checked })} /> Аналитика</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(planForm.apiAccessEnabled)} onChange={(event) => setPlanForm({ ...planForm, apiAccessEnabled: event.target.checked })} /> API-доступ</label>
              </div>
              <StatusButton className="mt-4" status={saving ? 'loading' : 'idle'} loadingLabel="Создаём тариф…">Создать тариф</StatusButton>
            </form>

            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-4">
                <h2 className="text-base font-semibold">Тарифы</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Код / название</th>
                      <th className="px-4 py-3">Статус</th>
                      <th className="px-4 py-3">Цена в месяц</th>
                      <th className="px-4 py-3">Лимиты</th>
                      <th className="px-4 py-3">Модули</th>
                      <th className="px-4 py-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plans.map((plan) => (
                      <tr key={plan.code}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{plan.name}</div>
                          <div className="text-xs text-gray-500">{plan.code}</div>
                        </td>
                        <td className="px-4 py-3"><Badge tone={plan.status === 'archived' ? 'neutral' : 'success'}>{plan.status}</Badge></td>
                        <td className="px-4 py-3">{formatCurrency(plan.monthlyPriceRub)}</td>
                        <td className="px-4 py-3">
                          Техника: {displayLimit(plan.limits.maxVehicles)}<br />
                          Пользователи: {displayLimit(plan.limits.maxUsers)}<br />
                          Хранилище: {displayLimit(plan.limits.maxStorageMb)} МБ
                        </td>
                        <td className="px-4 py-3">
                          OCR: {displayFlag(plan.features.ocrEnabled)}<br />
                          ДТП: {displayFlag(plan.features.accidentModuleEnabled)}<br />
                          Аналитика: {displayFlag(plan.features.analyticsEnabled)}<br />
                          API: {displayFlag(plan.features.apiAccessEnabled)}
                        </td>
                        <td className="px-4 py-3">
                          {plan.status !== 'archived' ? <button className="mr-3 text-blue-600" disabled={saving} onClick={() => void handleArchivePlan(plan.code)}>Архивировать</button> : null}
                          <button className="text-red-600" disabled={saving} onClick={() => void handleDeletePlan(plan.code)}>Удалить</button>
                        </td>
                      </tr>
                    ))}
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
