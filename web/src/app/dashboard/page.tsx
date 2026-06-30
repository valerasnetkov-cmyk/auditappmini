'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { DailyInspectionsChart, InspectionTypeChart, RegionBarChart, VehicleStatusChart } from '@/components/DashboardCharts'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import api from '@/lib/api/client'
import { clearAuthToken, isManagerRole, requireAuthToken } from '@/lib/auth'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { AccidentCard } from '@/app/_components/AccidentCard'
import { ChartCard } from '@/app/_components/ChartCard'
import { DashboardFilters } from '@/app/_components/DashboardFilters'
import { DashboardLoading } from '@/app/_components/DashboardLoading'
import { EmptyDashboard } from '@/app/_components/EmptyDashboard'
import { NotificationsCard } from '@/app/_components/NotificationsCard'
import { ServiceMessagesCard } from '@/app/_components/ServiceMessagesCard'
import { StatCard } from '@/app/_components/StatCard'
import { useDashboard, useDashboardExport } from '@/app/_hooks/useDashboard'
import { useToast } from '@/app/_hooks/useToast'
import { getRangeStart, type DateRange } from '@/app/_lib/dashboard'
import { Toast } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const router = useRouter()
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [routeChecked, setRouteChecked] = useState(false)
  const [routeError, setRouteError] = useState('')

  const { toast, showToast } = useToast()
  const dashboard = useDashboard()
  const exportHook = useDashboardExport()

  const analyticsEnabled = dashboard.usage?.features.analytics.enabled !== false
  const exportEnabled = analyticsEnabled && dashboard.usage?.features.export?.enabled !== false
  const canSeedDemoData = isManagerRole(dashboard.user?.role)
  const createRestriction = getCompanyOperationRestriction(dashboard.usage, 'create')

  const loadRef = useRef(dashboard.load)
  useEffect(() => {
    loadRef.current = dashboard.load
  })

  const triggerLoad = useCallback(async () => {
    await loadRef.current({ router, showToast, dateRange, customFrom, customTo })
  }, [router, showToast, dateRange, customFrom, customTo])

  useEffect(() => {
    if (!requireAuthToken()) return
    let cancelled = false

    async function routeByRole() {
      const result = await api.getMe()
      if (cancelled) return

      if (result.error === 'AUTH_REQUIRED') {
        router.replace('/login')
        return
      }

      if (result.error) {
        setRouteError(result.error)
        setRouteChecked(true)
        return
      }

      if (result.data?.role === 'admin' || result.data?.role === 'resource_manager') {
        router.replace('/saas-admin/dashboard')
        return
      }

      setRouteChecked(true)
      await triggerLoad()
    }

    void routeByRole()

    return () => {
      cancelled = true
    }
  }, [router, triggerLoad])

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range)
    if (range === 'custom' || range === 'week' || range === 'all') return
    setCustomFrom(getRangeStart(range) || '')
    setCustomTo(new Date().toISOString().split('T')[0])
  }

  const handleSeed = () =>
    exportHook.seedData(
      showToast,
      canSeedDemoData,
      createRestriction,
      triggerLoad,
    )

  const handleLogout = () => {
    clearAuthToken()
    window.location.reload()
  }

  const pageError = routeError || dashboard.error

  if (pageError) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-status-danger">{pageError}</h1>
          <p className="mt-3 text-sm text-foreground-secondary">
            Убедитесь, что backend запущен на http://localhost:3001. Для локального старта используйте `npm run dev` из корня проекта.
          </p>
          <button onClick={() => window.location.reload()} className="btn btn-primary mt-5">
            Повторить
          </button>
        </div>
      </div>
    )
  }

  if (!routeChecked) {
    return <DashboardLoading />
  }

  return (
    <Layout currentPage="dashboard">
      <div className="p-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title text-2xl">Дашборд</h1>
            <p className="mt-1 text-sm text-foreground-muted">Сводка по технике, осмотрам, дефектам, ДТП и напоминаниям.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {dashboard.stats.totalVehicles === 0 && canSeedDemoData ? (
              <button onClick={handleSeed} disabled={exportHook.seeding || Boolean(createRestriction)} className="btn btn-success disabled:opacity-50">
                {exportHook.seeding ? 'Создание...' : 'Создать демо-данные'}
              </button>
            ) : null}
            <button onClick={handleLogout} className="btn btn-secondary">Выйти</button>
          </div>
        </header>

        <SubscriptionStatusBanner usage={dashboard.usage} />

        <DashboardFilters
          dateRange={dateRange} customFrom={customFrom} customTo={customTo}
          analyticsEnabled={analyticsEnabled} exportEnabled={exportEnabled} onRangeChange={handleDateRangeChange}
          onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
          onExport={(type) => void exportHook.exportData(type, showToast, exportEnabled)}
        />

        {dashboard.loading ? (
          <DashboardLoading />
        ) : (
          <>
            {dashboard.stats.totalVehicles === 0 ? (
              <EmptyDashboard
                canSeed={canSeedDemoData} seeding={exportHook.seeding}
                disabled={Boolean(createRestriction)}
                restrictionMessage={createRestriction ? `${createRestriction.title}: ${createRestriction.message}` : ''}
                onSeed={handleSeed}
              />
            ) : null}

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Всего техники" value={dashboard.stats.totalVehicles} tone="info" code="VH" />
              <StatCard label="Всего осмотров" value={dashboard.analytics?.total?.inspections || dashboard.stats.totalInspections} tone="success" code="IN" />
              <StatCard label={analyticsEnabled ? 'Всего дефектов' : 'Техника с дефектами'}
                value={analyticsEnabled ? dashboard.analytics?.total?.defects || 0 : dashboard.stats.vehiclesWithDefects} tone="danger" code="DF" />
              <StatCard label={analyticsEnabled ? 'За выбранный период' : 'Сегодня осмотров'}
                value={analyticsEnabled ? dashboard.analytics?.week?.inspections || 0 : dashboard.stats.inspectionsToday} tone="purple" code="PR" />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Просрочено осмотров" value={dashboard.stats.overdueInspections} tone={dashboard.stats.overdueInspections ? 'danger' : 'success'} code="OD" />
              <StatCard label="Открытых дефектов" value={dashboard.stats.openDefects} tone={dashboard.stats.openDefects ? 'warning' : 'success'} code="OP" />
              <StatCard label="Критических дефектов" value={dashboard.stats.criticalDefects} tone={dashboard.stats.criticalDefects ? 'danger' : 'success'} code="CR" />
              <StatCard label="Незавершённых осмотров" value={dashboard.stats.unfinishedInspections} tone={dashboard.stats.unfinishedInspections ? 'warning' : 'success'} code="DR" />
              <StatCard label="Ошибок загрузки фото" value={dashboard.stats.failedPhotoUploads} tone={dashboard.stats.failedPhotoUploads ? 'danger' : 'success'} code="UP" />
            </section>

            {!analyticsEnabled ? (
              <section className="card mb-6 border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                Аналитический модуль отключён тарифом компании. Основная оперативная сводка остаётся доступной, а графики, ДТП-статистика по аналитике и экспорт скрыты до включения модуля владельцем компании.
              </section>
            ) : (
              <>
                <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {dashboard.accidentStats?.total ? <AccidentCard stats={dashboard.accidentStats} /> : null}
                  {dashboard.analytics?.defectsByRegion?.length ? (
                    <ChartCard title="Дефекты по регионам" tone="danger">
                      <RegionBarChart items={dashboard.analytics.defectsByRegion} tone="danger" ariaLabel="График дефектов по регионам" />
                    </ChartCard>
                  ) : null}
                  {dashboard.analytics?.dailyInspections?.length ? (
                    <ChartCard title="Динамика осмотров" tone="info">
                      <DailyInspectionsChart items={dashboard.analytics.dailyInspections} />
                    </ChartCard>
                  ) : null}
                </section>

                <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <ChartCard title="Техника по статусу" tone="info">
                    <VehicleStatusChart items={dashboard.analytics?.vehiclesByStatus || []} />
                  </ChartCard>
                  <ChartCard title="Осмотры по типу" tone="success">
                    <InspectionTypeChart items={dashboard.analytics?.inspectionsByType || []} />
                  </ChartCard>
                </section>

                <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {dashboard.analytics?.vehiclesByRegion?.length ? (
                    <ChartCard title="Техника по регионам" tone="info">
                      <RegionBarChart items={dashboard.analytics.vehiclesByRegion} tone="info" ariaLabel="График техники по регионам" />
                    </ChartCard>
                  ) : null}
                  {dashboard.analytics?.inspectionsByRegion?.length ? (
                    <ChartCard title="Осмотры по регионам" tone="success">
                      <RegionBarChart items={dashboard.analytics.inspectionsByRegion} tone="success" ariaLabel="График осмотров по регионам" />
                    </ChartCard>
                  ) : null}
                </section>
              </>
            )}

            <ServiceMessagesCard messages={dashboard.usage?.alerts || []} />
            {dashboard.notifications.length ? <NotificationsCard notifications={dashboard.notifications} /> : null}
          </>
        )}
      </div>

      {toast ? <Toast text={toast.text} tone={toast.tone === 'danger' ? 'danger' : toast.tone} /> : null}
    </Layout>
  )
}
