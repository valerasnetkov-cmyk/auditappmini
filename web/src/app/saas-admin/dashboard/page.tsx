'use client'

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
import { ActivationFunnel } from './_components/ActivationFunnel'
import { ChurnList } from './_components/ChurnList'
import { CompaniesFilters } from './_components/CompaniesFilters'
import { CompaniesTable } from './_components/CompaniesTable'
import { EmptyState } from './_components/EmptyState'
import { HealthItemCard } from './_components/HealthItemCard'
import { LimitsTable } from './_components/LimitsTable'
import { MetricCard } from './_components/MetricCard'
import { SectionHeader } from './_components/SectionHeader'
import { StorageMetrics } from './_components/StorageMetrics'
import { UpsellList } from './_components/UpsellList'
import { useCompaniesFilter, useResourceAdminStats } from './_hooks/useResourceAdminStats'
import { formatBytes, formatCurrency, formatNumber, formatPercent } from './_lib/resourceDashboard'

export default function ResourceAdminDashboardPage() {
  const { stats, loading, error } = useResourceAdminStats()
  const companies = stats?.companies || []
  const filter = useCompaniesFilter(companies)
  const limitUsage = stats?.limit_usage?.usage || []
  const healthItems = stats?.health_center?.items || stats?.service_health?.items || []
  const riskCenter = stats?.risk_center

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
                <StorageMetrics storage={stats.storage || {}} ocr={stats.ocr || {}} />
                <ResourceAdminStorageByCompanyChart storage={stats.storage} />
              </section>
            </div>

            <section>
              <SectionHeader title="Центр здоровья" description="Сервисные проблемы, которые мешают запуску, биллингу или качеству данных." />
              {healthItems.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {healthItems.map((item) => <HealthItemCard key={item.key} item={item} />)}
                </div>
              ) : <EmptyState>Критичных сервисных событий нет</EmptyState>}
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
              <LimitsTable companies={limitUsage} />
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Риск оттока" description="Компании без недавней активности, которым нужен контакт или проверка запуска." />
                <ChurnList companies={riskCenter?.churn || []} />
              </section>
              <section className="rounded-lg border bg-white p-4">
                <SectionHeader title="Кандидаты на апсейл" description="Компании с высокой загрузкой лимитов или активностью без платного MRR." />
                <UpsellList companies={riskCenter?.upsell || []} />
              </section>
            </div>

            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-4">
                <SectionHeader title="Компании 2.0" description="Сервисная таблица для контроля тарифа, лимитов, MRR, владельцев и активности." />
                <CompaniesFilters
                  companySearch={filter.state.companySearch} planFilter={filter.state.planFilter} statusFilter={filter.state.statusFilter}
                  planOptions={filter.planOptions} onSearchChange={filter.actions.setCompanySearch}
                  onPlanChange={filter.actions.setPlanFilter} onStatusChange={filter.actions.setStatusFilter}
                />
              </div>
              <CompaniesTable companies={filter.filteredCompanies} totalCount={companies.length} />
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
