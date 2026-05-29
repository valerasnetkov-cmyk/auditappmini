'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import {
  ResourceAdminActivityTrendChart,
  ResourceAdminCompanyUsageChart,
  ResourceAdminCompanyWorkloadChart,
  ResourceAdminInspectionTypesChart,
  ResourceAdminPlanDistributionChart,
  ResourceAdminProductActivityChart,
  ResourceAdminRevenueChart,
  ResourceAdminStorageByCompanyChart,
} from '@/components/DashboardCharts'
import api from '@/lib/api/client'
import type { SaasAdminStats, SaasCompanyStats, SaasHealthItem } from '@/lib/types'

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ru-RU')
}

function formatCurrency(value?: number | null) {
  return `${formatNumber(value)} ₽`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return 'без лимита'
  return `${formatNumber(value)}%`
}

function formatLimit(current?: number | null, limit?: number | null) {
  return `${formatNumber(current)} / ${limit === null || limit === undefined ? '∞' : formatNumber(limit)}`
}

function formatDate(value?: string | null) {
  if (!value) return 'нет активности'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'нет активности'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatBytes(value?: number | null) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10} МБ`
  return `${Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10} ГБ`
}

function severityClass(severity?: string) {
  if (severity === 'high' || severity === 'blocked' || severity === 'churn') {
    return 'bg-red-50 text-red-700 ring-red-100'
  }
  if (severity === 'medium' || severity === 'upsell' || severity === 'watch') {
    return 'bg-amber-50 text-amber-700 ring-amber-100'
  }
  if (severity === 'inactive') {
    return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
}

function riskLabel(value?: string) {
  const labels: Record<string, string> = {
    ok: 'норма',
    watch: 'наблюдать',
    upsell: 'апсейл',
    blocked: 'лимит',
    churn: 'отток',
    attention: 'внимание',
    inactive: 'неактивна',
    high: 'высокий',
    medium: 'средний',
  }
  return labels[value || 'ok'] || value || 'норма'
}

function moduleLabel(enabled?: boolean) {
  return enabled ? 'вкл' : 'выкл'
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-5 text-gray-500">{hint}</div> : null}
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-950">{title}</h2>
      {description ? <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p> : null}
    </div>
  )
}

function ActivationFunnel({ stats }: { stats: SaasAdminStats }) {
  const funnel = stats.activation?.funnel
  if (!funnel) return <EmptyState>Нет данных для воронки активации</EmptyState>

  const steps = [
    ['Компании созданы', funnel.companiesCreated],
    ['Владелец назначен', funnel.ownerAssigned],
    ['Владелец входил', funnel.ownerLoggedIn],
    ['Техника добавлена', funnel.vehicleAdded],
    ['Первый осмотр', funnel.firstInspectionCreated],
    ['5+ осмотров', funnel.fiveInspectionsReached],
    ['Активны 30 дней', funnel.active30d],
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {steps.map(([label, value], index) => (
        <div key={label} className="rounded-lg border bg-white p-4">
          <div className="text-xs font-semibold uppercase text-blue-600">Шаг {index + 1}</div>
          <div className="mt-3 text-2xl font-semibold text-gray-950">{formatNumber(Number(value))}</div>
          <div className="mt-2 text-xs leading-5 text-gray-500">{label}</div>
        </div>
      ))}
    </div>
  )
}

function HealthItemCard({ item }: { item: SaasHealthItem }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">{item.title}</h3>
          <p className="mt-2 text-xs leading-5 text-gray-500">{item.description}</p>
          {item.actionLabel ? (
            <a className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-900" href={item.actionHref || '/saas-admin'}>
              {item.actionLabel}
            </a>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(item.severity)}`}>
          {formatNumber(item.count)}
        </span>
      </div>
    </div>
  )
}

function CompanyIdentity({ company }: { company: SaasCompanyStats }) {
  return (
    <div>
      <div className="font-medium text-gray-950">{company.name}</div>
      <div className="text-xs text-gray-500">{company.slug || company.id}</div>
    </div>
  )
}

export default function ResourceAdminDashboardPage() {
  const [stats, setStats] = useState<SaasAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const companies = useMemo(() => stats?.companies || [], [stats])
  const planOptions = useMemo(() => {
    const values = new Set(companies.map((company) => company.limits?.planCode || 'unassigned'))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [companies])
  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase()
    return companies.filter((company) => {
      const matchesQuery = !query || [company.name, company.slug, company.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
      const planCode = company.limits?.planCode || 'unassigned'
      const matchesPlan = planFilter === 'all' || planCode === planFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'no-owner' && !company.owners) ||
        (statusFilter === 'no-limits' && !company.limits?.planCode) ||
        (statusFilter === 'churn' && company.riskStatus === 'churn') ||
        (statusFilter === 'upsell' && company.riskStatus === 'upsell') ||
        (statusFilter === 'near-limit' && ((company.vehiclesUsagePercent || 0) >= 80 || (company.usersUsagePercent || 0) >= 80)) ||
        company.status === statusFilter

      return matchesQuery && matchesPlan && matchesStatus
    })
  }, [companies, companySearch, planFilter, statusFilter])
  const limitUsage = stats?.limit_usage?.usage || []
  const healthItems = stats?.health_center?.items || stats?.service_health?.items || []
  const riskCenter = stats?.risk_center

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setLoading(true)
      setError('')

      const result = await api.getSaasAdminStats()
      if (cancelled) return

      if (result.data) {
        setStats(result.data)
      } else {
        setError(result.error || 'Не удалось загрузить дашборд ресурса')
      }

      setLoading(false)
    }

    void loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Layout currentPage="resource-dashboard">
      <div className="resource-admin-page mx-auto max-w-[1600px] space-y-8 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Resource dashboard</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-gray-950">Дашборд ресурса</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
                Сводные KPI, активация, лимиты, тарифы, выручка и риски SaaS-уровня без доступа к операционным карточкам компаний.
              </p>
            </div>
            {stats ? (
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Активация: <span className="font-semibold">{formatPercent(stats.activation?.activationRate)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Загрузка дашборда...</div>
        ) : stats ? (
          <>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard label="Компании" value={formatNumber(stats.totals.companies)} hint={`Активные: ${formatNumber(stats.totals.activeCompanies)}`} />
              <MetricCard label="Техника" value={formatNumber(stats.totals.vehicles)} hint={`Активная: ${formatNumber(stats.totals.activeVehicles)}`} />
              <MetricCard label="Осмотры" value={formatNumber(stats.totals.inspections)} hint={`7д: ${formatNumber(stats.totals.inspections7d)} · 30д: ${formatNumber(stats.totals.inspections30d)}`} />
              <MetricCard label="ДТП" value={formatNumber(stats.totals.accidents)} hint={`30 дней: ${formatNumber(stats.totals.accidents30d)}`} />
              <MetricCard label="MRR" value={formatCurrency(stats.billing?.monthlyRevenueRub)} hint={`ARR: ${formatCurrency(stats.billing?.annualRevenueRub)}`} />
              <MetricCard label="Potential MRR" value={formatCurrency(stats.billing?.potentialMrr)} hint={`Активные free: ${formatNumber(stats.billing?.activeFreeCompanies)}`} />
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard label="Активные 7д" value={formatNumber(stats.totals.activeCompanies7d)} hint={`30д: ${formatNumber(stats.totals.activeCompanies30d)}`} />
              <MetricCard label="Activation rate" value={formatPercent(stats.activation?.activationRate)} hint="Дошли до регулярной активности" />
              <MetricCard label="Completion rate" value={formatPercent(stats.activity?.kpi.completionRate)} hint={`Незавершенные: ${formatNumber(stats.activity?.kpi.unfinishedInspections)}`} />
              <MetricCard label="Фото / осмотр" value={formatNumber(stats.activity?.kpi.averagePhotosPerInspection)} hint={`Всего фото: ${formatNumber(stats.storage?.totalPhotos)}`} />
              <MetricCard label="Storage used" value={formatBytes(stats.storage?.totalStorageBytes)} hint={`30д фото: ${formatNumber(stats.storage?.photos30d)}`} />
              <MetricCard label="Оплачено за месяц" value={formatCurrency(stats.billing?.paidThisMonthRub)} hint={`Продления: ${formatCurrency(stats.billing?.expectedRenewalsRub)}`} />
            </div>

            <section>
              <SectionHeader title="Воронка активации" description="Путь компании от создания до устойчивой активности за последние 30 дней." />
              <ActivationFunnel stats={stats} />
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Активность за 30 дней" description="Агрегированные осмотры и ДТП без перехода к данным компаний." />
                <ResourceAdminActivityTrendChart items={stats.activity_trend || []} />
              </section>

              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Нагрузка компаний" description="Сводное сравнение компаний по количеству техники, осмотров и ДТП." />
                <ResourceAdminCompanyUsageChart companies={companies} />
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Компании по тарифам" description="Распределение активных компаний по назначенным тарифам." />
                <ResourceAdminPlanDistributionChart items={stats.plan_breakdown || []} />
              </section>

              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Выручка по тарифам" description="Месячная recurring-выручка по текущим тарифам." />
                <ResourceAdminRevenueChart items={stats.plan_breakdown || []} />
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Product Activity" description="Осмотры, дефекты, ДТП и фото за последние 30 дней." />
                <ResourceAdminProductActivityChart items={stats.activity?.series30d || []} />
              </section>

              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Типы осмотров" description="Структура быстрых, плановых и ДТП-осмотров по дням." />
                <ResourceAdminInspectionTypesChart items={stats.activity?.inspectionTypesSeries30d || []} />
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Нагрузка по компаниям" description="Топ компаний по осмотрам, дефектам и фото." />
                <ResourceAdminCompanyWorkloadChart items={stats.activity?.companyWorkload || []} />
              </section>

              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Фото и хранилище" description="Объем доказательной базы и экономия после WebP." />
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <MetricCard label="Хранилище" value={formatBytes(stats.storage?.totalStorageBytes)} hint={`Сэкономлено: ${formatBytes(stats.storage?.estimatedSavedBytes)}`} />
                  <MetricCard label="Средний оригинал" value={formatBytes(stats.storage?.avgOriginalSizeBytes)} hint={`WebP: ${formatBytes(stats.storage?.avgWebpSizeBytes)}`} />
                  <MetricCard label="OCR" value={formatNumber(stats.ocr?.odometerSuccess)} hint={`Компаний без OCR: ${formatNumber(stats.ocr?.companiesWithOcrDisabled)}`} />
                </div>
                <ResourceAdminStorageByCompanyChart storage={stats.storage} />
              </section>
            </div>

            <section>
              <SectionHeader title="Центр здоровья" description="Сервисные проблемы, которые мешают запуску, биллингу или качеству данных." />
              {healthItems.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {healthItems.map((item) => <HealthItemCard key={item.key} item={item} />)}
                </div>
              ) : (
                <EmptyState>Критичных сервисных событий нет</EmptyState>
              )}
            </section>

            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-4">
                <SectionHeader title="Использование лимитов" description="Heatmap компаний, близких к лимитам тарифа или работающих с отключенными модулями." />
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard label="Лимит техники 80%+" value={formatNumber(stats.limit_usage?.companiesNearVehicleLimit)} />
                  <MetricCard label="Лимит пользователей 80%+" value={formatNumber(stats.limit_usage?.companiesNearUserLimit)} />
                  <MetricCard label="OCR выключен" value={formatNumber(stats.limit_usage?.disabledModules?.ocr)} />
                  <MetricCard label="API выключен" value={formatNumber(stats.limit_usage?.disabledModules?.apiAccess)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                {limitUsage.length ? (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Компания</th>
                        <th className="px-4 py-3">Тариф</th>
                        <th className="px-4 py-3">Техника</th>
                        <th className="px-4 py-3">Пользователи</th>
                        <th className="px-4 py-3">Модули</th>
                        <th className="px-4 py-3">Риск</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {limitUsage.map((company) => (
                        <tr key={company.companyId}>
                          <td className="px-4 py-3 font-medium text-gray-950">{company.companyName}</td>
                          <td className="px-4 py-3">{company.planCode || 'не назначен'}</td>
                          <td className="px-4 py-3">
                            <div>{formatLimit(company.vehiclesUsed, company.vehiclesLimit)}</div>
                            <div className="text-xs text-gray-500">{formatPercent(company.vehiclesUsagePercent)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{formatLimit(company.usersUsed, company.usersLimit)}</div>
                            <div className="text-xs text-gray-500">{formatPercent(company.usersUsagePercent)}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            OCR {moduleLabel(company.ocrEnabled)} · ДТП {moduleLabel(company.accidentModuleEnabled)} · API {moduleLabel(company.apiAccessEnabled)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.riskLevel)}`}>
                              {riskLabel(company.riskLevel)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4"><EmptyState>Нет данных по лимитам</EmptyState></div>
                )}
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Риск оттока" description="Компании без недавней активности, которым нужен контакт или проверка запуска." />
                {riskCenter?.churn?.length ? (
                  <div className="space-y-3">
                    {riskCenter.churn.slice(0, 6).map((company) => (
                      <div key={company.companyId} className="rounded-lg border bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-950">{company.companyName}</div>
                            <div className="mt-1 text-xs text-gray-500">{company.reasons.join(', ')}</div>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.riskLevel)}`}>
                            {riskLabel(company.riskLevel)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">Последняя активность: {formatDate(company.lastActivityAt)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>Компаний с риском оттока не найдено</EmptyState>
                )}
              </section>

              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Кандидаты на апсейл" description="Компании с высокой загрузкой лимитов или активностью без платного MRR." />
                {riskCenter?.upsell?.length ? (
                  <div className="space-y-3">
                    {riskCenter.upsell.slice(0, 6).map((company) => (
                      <div key={company.companyId} className="rounded-lg border bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-950">{company.companyName}</div>
                            <div className="mt-1 text-xs text-gray-500">{company.reason}</div>
                          </div>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                            +{formatCurrency(company.potentialMrr)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Текущий тариф: {company.currentPlanCode || 'нет'} · Рекомендация: {company.recommendedPlanCode || 'уточнить'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>Кандидатов на апсейл пока нет</EmptyState>
                )}
              </section>
            </div>

            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-4">
                <SectionHeader title="Компании 2.0" description="Сервисная таблица для контроля тарифа, лимитов, MRR, владельцев и активности." />
                <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
                  <input
                    value={companySearch}
                    onChange={(event) => setCompanySearch(event.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Поиск по компании..."
                  />
                  <select
                    value={planFilter}
                    onChange={(event) => setPlanFilter(event.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="all">Все тарифы</option>
                    {planOptions.map((planCode) => (
                      <option key={planCode} value={planCode}>{planCode === 'unassigned' ? 'Без тарифа' : planCode}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="all">Все статусы</option>
                    <option value="active">Активные</option>
                    <option value="inactive">Неактивные</option>
                    <option value="no-owner">Без владельца</option>
                    <option value="no-limits">Без тарифа/лимитов</option>
                    <option value="near-limit">Лимит 80%+</option>
                    <option value="churn">Churn-risk</option>
                    <option value="upsell">Upsell</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                {filteredCompanies.length ? (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Компания</th>
                        <th className="px-4 py-3">Статус</th>
                        <th className="px-4 py-3">Тариф / MRR</th>
                        <th className="px-4 py-3">Владельцы</th>
                        <th className="px-4 py-3">Техника</th>
                        <th className="px-4 py-3">Осмотры 30д</th>
                        <th className="px-4 py-3">Дефекты</th>
                        <th className="px-4 py-3">ДТП</th>
                        <th className="px-4 py-3">Модули</th>
                        <th className="px-4 py-3">Последняя активность</th>
                        <th className="px-4 py-3">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCompanies.map((company) => (
                        <tr key={company.id}>
                          <td className="px-4 py-3"><CompanyIdentity company={company} /></td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.healthStatus)}`}>
                                {riskLabel(company.healthStatus)}
                              </span>
                              <div>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.riskStatus)}`}>
                                  {riskLabel(company.riskStatus)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-950">{company.limits?.planCode || 'не назначен'}</div>
                            <div className="text-xs text-gray-500">{formatCurrency(company.billing?.monthlyRevenueRub)}</div>
                          </td>
                          <td className="px-4 py-3">{formatNumber(company.owners)} / {formatNumber(company.users)}</td>
                          <td className="px-4 py-3">
                            <div>{formatLimit(company.usage?.vehicles, company.vehiclesLimit)}</div>
                            <div className="text-xs text-gray-500">{formatPercent(company.vehiclesUsagePercent)}</div>
                          </td>
                          <td className="px-4 py-3">{formatNumber(company.inspections30d)}</td>
                          <td className="px-4 py-3">{formatNumber(company.usage?.defects)}</td>
                          <td className="px-4 py-3">{formatNumber(company.usage?.accidents)}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            OCR {moduleLabel(Boolean(company.limits?.ocrEnabled))}<br />
                            Аналитика {moduleLabel(Boolean(company.limits?.analyticsEnabled))}<br />
                            ДТП {moduleLabel(Boolean(company.limits?.accidentModuleEnabled))}
                          </td>
                          <td className="px-4 py-3">{formatDate(company.lastActivityAt)}</td>
                          <td className="px-4 py-3">
                            <Link className="text-sm font-medium text-blue-700 hover:text-blue-900" href={`/saas-admin/companies/${company.id}`}>
                              Настроить
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4"><EmptyState>{companies.length ? 'Компании не найдены по выбранным фильтрам' : 'Компании еще не созданы'}</EmptyState></div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
