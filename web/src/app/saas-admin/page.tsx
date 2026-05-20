'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { SaasCompanyActivityChart } from '@/components/DashboardCharts'
import api from '@/lib/api/client'
import { isAuthRequiredError, requireAuthToken } from '@/lib/auth'
import { formatDateTime } from '@/lib/dateUtils'
import type { SaasAdminStats, SaasCompanyStats, SaasHealthCompany, SaasOperationalHealth } from '@/lib/types'

export const dynamic = 'force-dynamic'

type StatTone = 'info' | 'success' | 'warning' | 'danger' | 'purple'

type StatCardProps = {
  label: string
  value: number
  hint?: string
  tone: StatTone
}

type HealthIssue = {
  label: string
  value: number
  description: string
  action: string
  companies?: SaasHealthCompany[]
}

const toneClassName: Record<StatTone, string> = {
  info: 'text-status-info bg-blue-50',
  success: 'text-status-success bg-green-50',
  warning: 'text-status-warning bg-amber-50',
  danger: 'text-status-danger bg-red-50',
  purple: 'text-purple-600 bg-purple-50',
}

function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0))
}

function getCompanyStatusLabel(status: string) {
  return status === 'inactive' ? 'Отключена' : 'Активна'
}

function getCompanyStatusBadge(status: string) {
  return status === 'inactive' ? 'badge badge-warning' : 'badge badge-success'
}

function formatLimit(current: number, max?: number | null) {
  if (max === null || max === undefined) {
    return `${formatNumber(current)} / без лимита`
  }

  return `${formatNumber(current)} / ${formatNumber(max)}`
}

function formatFeatureFlag(enabled?: boolean | null) {
  if (enabled === false) return 'выкл'
  if (enabled === true) return 'вкл'
  return 'по умолчанию'
}

function getFeatureFlagClassName(enabled?: boolean | null) {
  if (enabled === false) return 'rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-status-danger'
  if (enabled === true) return 'rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-status-success'
  return 'rounded-full bg-soft-surface px-2 py-0.5 text-[11px] font-semibold text-foreground-muted'
}

function StatCard({ label, value, hint, tone }: StatCardProps) {
  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground-secondary">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatNumber(value)}</p>
          {hint ? <p className="mt-2 text-xs text-foreground-muted">{hint}</p> : null}
        </div>
        <span className={`rounded-2xl px-3 py-2 text-xs font-bold ${toneClassName[tone]}`}>SA</span>
      </div>
    </article>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="card h-32 animate-pulse p-5">
          <div className="h-4 w-2/3 rounded bg-soft-surface" />
          <div className="mt-5 h-8 w-1/2 rounded bg-soft-surface" />
          <div className="mt-4 h-3 w-3/4 rounded bg-soft-surface" />
        </div>
      ))}
    </div>
  )
}

function AccessDenied() {
  return (
    <Layout currentPage="saas-admin">
      <div className="p-6">
        <article className="card max-w-2xl p-8">
          <span className="badge badge-warning">Только администратор ресурса</span>
          <h1 className="mt-4 text-2xl font-bold text-foreground">SaaS-администрирование недоступно</h1>
          <p className="mt-3 text-sm leading-6 text-foreground-secondary">
            Этот раздел показывает агрегаты по всем компаниям и предназначен только для владельца SaaS-проекта.
            Владельцы компаний управляют менеджерами и инспекторами в своей панели, без доступа к CMS и глобальной
            статистике.
          </p>
        </article>
      </div>
    </Layout>
  )
}

function HealthCompanyList({ companies }: { companies?: SaasHealthCompany[] }) {
  if (!companies?.length) return null

  return (
    <ul className="mt-3 space-y-2">
      {companies.map((company) => (
        <li key={company.id} className="rounded-lg bg-surface px-3 py-2 text-xs text-foreground-secondary">
          <span className="font-semibold text-foreground">{company.name}</span>
          <span className="ml-2 text-foreground-muted">{company.slug || company.id}</span>
        </li>
      ))}
    </ul>
  )
}

function HealthPanel({ health }: { health: SaasOperationalHealth }) {
  const issues: HealthIssue[] = [
    {
      label: 'Компании без активного владельца',
      value: health.companiesWithoutOwner,
      description: 'Компания создана, но владелец ещё не сможет войти в пользовательскую панель.',
      action: 'Создайте владельца в Directus → company_owners и запустите provisioning sync.',
      companies: health.companiesWithoutOwnerList,
    },
    {
      label: 'Компании без лимитов',
      value: health.companiesWithoutLimits,
      description: 'Тарифные ограничения и feature flags не будут применяться явно.',
      action: 'Запустите npm run directus:seed:saas или заполните company_limits в CMS.',
      companies: health.companiesWithoutLimitsList,
    },
    {
      label: 'Техника без company_id',
      value: health.unassignedVehicles,
      description: 'Такие записи нельзя надежно отнести к tenant-компании.',
      action: 'Проверьте миграцию старых данных и tenant-isolation.',
    },
    {
      label: 'Осмотры без company_id',
      value: health.unassignedInspections,
      description: 'Осмотры без tenant-привязки опасны для аналитики и доступа.',
      action: 'Проверьте старые записи и привязку через технику.',
    },
    {
      label: 'Дефекты без company_id',
      value: health.unassignedDefects,
      description: 'Дефекты должны наследовать компанию осмотра.',
      action: 'Проверьте миграцию дефектов и повторное сохранение осмотров.',
    },
  ]

  const hasIssues = issues.some((item) => item.value > 0)

  return (
    <article className="card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Контроль SaaS-данных</h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            Быстрые индикаторы для администратора ресурса: владелец компании, тарифные лимиты и tenant-привязка данных.
          </p>
        </div>
        <span className={hasIssues ? 'badge badge-warning' : 'badge badge-success'}>
          {hasIssues ? 'Есть что проверить' : 'Без критичных замечаний'}
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {issues.map((issue) => (
          <div key={issue.label} className="rounded-xl border border-line bg-muted-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{issue.label}</p>
                <p className="mt-2 text-sm text-foreground-secondary">{issue.description}</p>
              </div>
              <p className={issue.value > 0 ? 'text-2xl font-bold text-status-warning' : 'text-2xl font-bold text-foreground'}>
                {formatNumber(issue.value)}
              </p>
            </div>
            {issue.value > 0 ? (
              <>
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {issue.action}
                </p>
                <HealthCompanyList companies={issue.companies} />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  )
}

function OwnerCell({ owners }: { owners: number }) {
  if (owners <= 0) {
    return <span className="badge badge-warning">Нужен владелец</span>
  }

  return <span>{formatNumber(owners)}</span>
}

function CompanyTable({ companies }: { companies: SaasCompanyStats[] }) {
  return (
    <section className="table-card">
      <div className="table-scroll">
        <table className="w-full min-w-[980px]">
          <thead className="table-header">
            <tr>
              <th className="table-cell text-left">Компания</th>
              <th className="table-cell text-left">Статус</th>
              <th className="table-cell text-right">Владелец</th>
              <th className="table-cell text-right">Пользователи</th>
              <th className="table-cell text-right">Техника</th>
              <th className="table-cell text-left">Тариф / лимиты</th>
              <th className="table-cell text-right">Осмотры</th>
              <th className="table-cell text-right">Дефекты</th>
              <th className="table-cell text-right">ДТП</th>
              <th className="table-cell text-left">Последний осмотр</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-t border-line-muted">
                <td className="table-cell">
                  <div>
                    <p className="font-semibold text-foreground">{company.name}</p>
                    <p className="text-xs text-foreground-muted">{company.slug || company.id}</p>
                  </div>
                </td>
                <td className="table-cell">
                  <span className={getCompanyStatusBadge(company.status)}>{getCompanyStatusLabel(company.status)}</span>
                </td>
                <td className="table-cell text-right">
                  <OwnerCell owners={company.owners} />
                </td>
                <td className="table-cell text-right">{formatNumber(company.users)}</td>
                <td className="table-cell text-right">
                  <span className="font-semibold">{formatNumber(company.vehicles)}</span>
                  <span className="ml-1 text-xs text-foreground-muted">/{formatNumber(company.repairVehicles)} ремонт</span>
                </td>
                <td className="table-cell">
                  <div className="space-y-1 text-xs text-foreground-secondary">
                    <p>
                      <span className="font-semibold text-foreground">{company.limits?.planCode || 'Без тарифа'}</span>
                    </p>
                    <p>Техника: {formatLimit(company.vehicles, company.limits?.maxVehicles)}</p>
                    <p>Пользователи: {formatLimit(company.users, company.limits?.maxUsers)}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className={getFeatureFlagClassName(company.limits?.ocrEnabled)}>
                        OCR: {formatFeatureFlag(company.limits?.ocrEnabled)}
                      </span>
                      <span className={getFeatureFlagClassName(company.limits?.accidentModuleEnabled)}>
                        ДТП: {formatFeatureFlag(company.limits?.accidentModuleEnabled)}
                      </span>
                      <span className={getFeatureFlagClassName(company.limits?.analyticsEnabled)}>
                        Аналитика: {formatFeatureFlag(company.limits?.analyticsEnabled)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="table-cell text-right">{formatNumber(company.inspections)}</td>
                <td className="table-cell text-right">
                  <span className={company.openDefects > 0 ? 'text-status-danger' : 'text-foreground'}>
                    {formatNumber(company.defects)}
                  </span>
                  <span className="ml-1 text-xs text-foreground-muted">/{formatNumber(company.openDefects)} открыто</span>
                </td>
                <td className="table-cell text-right">{formatNumber(company.accidents)}</td>
                <td className="table-cell text-sm text-foreground-secondary">
                  {company.lastInspectionAt ? formatDateTime(company.lastInspectionAt) : 'Нет данных'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function SaasAdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    if (!requireAuthToken()) return

    let cancelled = false

    async function loadStats() {
      setLoading(true)
      setError('')
      setAccessDenied(false)

      const result = await api.getSaasAdminStats()
      if (cancelled) return

      if (isAuthRequiredError(result.error)) {
        router.replace('/login')
        return
      }

      if (result.error) {
        setAccessDenied(result.error === 'Access only for admins')
        setError(result.error)
        setLoading(false)
        return
      }

      setStats(result.data || null)
      setLoading(false)
    }

    void loadStats()

    return () => {
      cancelled = true
    }
  }, [router])

  const topCompanies = useMemo(
    () => (stats?.companies || []).filter((company) => company.inspections > 0 || company.defects > 0),
    [stats?.companies],
  )

  if (accessDenied) {
    return <AccessDenied />
  }

  return (
    <Layout currentPage="saas-admin">
      <div className="p-6">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <span className="badge badge-info">Plan B · SaaS backoffice</span>
            <h1 className="page-title mt-3 text-2xl">SaaS-администрирование</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-secondary">
              Глобальная сводка владельца ресурса: компании, владельцы, лимиты и общая активность.
              Операционная работа компаний остается в пользовательской панели, без упоминания CMS.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-foreground-secondary shadow-card">
            <p className="font-semibold text-foreground">Источник агрегатов</p>
            <p className="mt-1">Backend считает фактические данные по всем tenant-компаниям.</p>
          </div>
        </header>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <article className="card border-status-danger p-6">
            <h2 className="text-lg font-bold text-status-danger">Не удалось загрузить SaaS-статистику</h2>
            <p className="mt-2 text-sm text-foreground-secondary">{error}</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary mt-5">
              Повторить
            </button>
          </article>
        ) : stats ? (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Компании" value={stats.totals.companies} hint={`${formatNumber(stats.totals.activeCompanies)} активных`} tone="info" />
              <StatCard label="Владельцы компаний" value={stats.totals.owners} hint="Создаются через Directus provisioning" tone="purple" />
              <StatCard label="Техника всего" value={stats.totals.vehicles} hint={`${formatNumber(stats.totals.repairVehicles)} в ремонте`} tone="success" />
              <StatCard label="Осмотры всего" value={stats.totals.inspections} hint={`+${formatNumber(stats.totals.inspections7d)} за 7 дней`} tone="info" />
              <StatCard label="Дефекты всего" value={stats.totals.defects} hint={`${formatNumber(stats.totals.openDefects)} открытых`} tone="danger" />
              <StatCard label="ДТП-осмотры" value={stats.totals.accidents} hint={`+${formatNumber(stats.totals.accidents7d)} за 7 дней`} tone="warning" />
              <StatCard label="Пользователи кабинетов" value={stats.totals.users} hint={`${formatNumber(stats.totals.managers)} менеджеров · ${formatNumber(stats.totals.inspectors)} инспекторов`} tone="purple" />
              <StatCard label="Фотофиксации" value={stats.totals.photos} hint="Хранятся и защищаются custom backend" tone="success" />
            </section>

            <section className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <article className="card p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Активность компаний</h2>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      Top-8 компаний по осмотрам и дефектам, график на Chart.js.
                    </p>
                  </div>
                  <span className="badge badge-secondary">Обновлено: {formatDateTime(stats.generated_at)}</span>
                </div>
                {topCompanies.length ? (
                  <SaasCompanyActivityChart companies={topCompanies} />
                ) : (
                  <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-foreground-muted">
                    Данных по активности компаний пока нет.
                  </div>
                )}
              </article>

              <HealthPanel health={stats.operational_health} />
            </section>

            <section className="mb-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Компании SaaS</h2>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    Здесь только сводка. Добавление, отключение компании и назначение владельца выполняются в Directus
                    администратором ресурса.
                  </p>
                </div>
                <span className="text-sm text-foreground-muted">Всего: {formatNumber(stats.companies.length)}</span>
              </div>
              <CompanyTable companies={stats.companies} />
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
