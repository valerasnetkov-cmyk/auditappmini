'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { clearAuthToken, isManagerRole, requireAuthToken } from '@/lib/auth'
import { formatDate } from '@/lib/dateUtils'
import type {
  AccidentStats,
  AnalyticsOverview,
  AuthUser,
  CountByRegion,
  CountByStatus,
  CountByType,
  DashboardStats,
  ExportType,
  NotificationItem,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

type DateRange = 'week' | 'today' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
type ProgressTone = 'success' | 'warning' | 'danger' | 'info' | 'purple'
type ToastTone = 'success' | 'danger' | 'info'

type ToastMessage = {
  tone: ToastTone
  text: string
}

const RANGE_LABELS: Record<DateRange, string> = {
  week: 'Неделя',
  today: 'Сегодня',
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
  all: 'За все время',
  custom: 'Свой период',
}

const toastClassName: Record<ToastTone, string> = {
  success: 'toast toast-success',
  danger: 'toast toast-error',
  info: 'toast bg-elevated text-foreground',
}

const progressClassName: Record<ProgressTone, string> = {
  success: 'progress-fill-success',
  warning: 'progress-fill-warning',
  danger: 'progress-fill-danger',
  info: 'progress-fill-info',
  purple: 'progress-fill-purple',
}

function getTypeLabel(type: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

function getVehicleStatusLabel(status: string) {
  if (status === 'active') return 'В работе'
  if (status === 'repair') return 'Ремонт'
  return status || 'Не указано'
}

function getInspectionTypeTone(type: string): ProgressTone {
  if (type === 'accident') return 'danger'
  if (type === 'scheduled') return 'purple'
  return 'info'
}

function getVehicleStatusTone(status: string): ProgressTone {
  if (status === 'repair') return 'warning'
  return 'success'
}

function getAnalyticsParams(range: DateRange, customFrom: string, customTo: string) {
  if (range === 'week' || range === 'all') return ''

  if (range === 'custom') {
    if (!customFrom) return ''
    return `?from=${customFrom}${customTo ? `&to=${customTo}` : ''}`
  }

  const from = getRangeStart(range)
  return from ? `?from=${from}` : ''
}

function getRangeStart(range: Exclude<DateRange, 'week' | 'all' | 'custom'>) {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000

  if (range === 'today') return now.toISOString().split('T')[0]
  if (range === 'month') return new Date(now.getTime() - 30 * dayMs).toISOString().split('T')[0]
  if (range === 'quarter') return new Date(now.getTime() - 90 * dayMs).toISOString().split('T')[0]
  if (range === 'year') return new Date(now.getTime() - 365 * dayMs).toISOString().split('T')[0]
}

function getMaxCount(items?: Array<{ count: number }>) {
  return Math.max(1, ...(items?.map((item) => Number(item.count || 0)) || []))
}

function getPercentage(count: number, maxCount: number) {
  return `${Math.min(100, Math.round((count / Math.max(maxCount, 1)) * 100))}%`
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    vehiclesWithDefects: 0,
    totalInspections: 0,
    inspectionsToday: 0,
  })
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [accidentStats, setAccidentStats] = useState<AccidentStats | null>(null)
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = (text: string, tone: ToastTone = 'info') => {
    setToast({ text, tone })
    window.setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadDashboard(getAnalyticsParams(dateRange, customFrom, customTo))
  }, [dateRange, customFrom, customTo])

  const loadDashboard = async (params: string) => {
    try {
      setLoading(true)
      setError('')

      const [statsRes, notifRes, analyticsRes, meRes] = await Promise.all([
        api.getDashboardStats(),
        api.getNotifications(),
        api.getAnalyticsOverview(params),
        api.getMe(),
      ])

      const authExpired = [statsRes, notifRes, analyticsRes, meRes].some((result) => result.error === 'AUTH_REQUIRED')
      if (authExpired) {
        router.replace('/login')
        return
      }

      if (statsRes.error) {
        setError(statsRes.error)
        return
      }

      if (notifRes.error) showToast(`Уведомления недоступны: ${notifRes.error}`, 'danger')
      if (analyticsRes.error) showToast(`Аналитика недоступна: ${analyticsRes.error}`, 'danger')

      const statsData: Partial<DashboardStats> = statsRes.data || {}
      const analyticsData = analyticsRes.data || {}

      setStats({
        totalVehicles: statsData.totalVehicles || 0,
        vehiclesWithDefects: statsData.vehiclesWithDefects || 0,
        totalInspections: statsData.totalInspections || 0,
        inspectionsToday: statsData.inspectionsToday || 0,
      })
      setNotifications(notifRes.data || [])
      setAccidentStats(analyticsData.accidents || null)
      setData(analyticsData)
      setCurrentUser(meRes.data || null)
    } catch {
      setError('Не удалось загрузить данные дашборда')
    } finally {
      setLoading(false)
    }
  }

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range)

    if (range === 'custom' || range === 'week' || range === 'all') return

    setCustomFrom(getRangeStart(range) || '')
    setCustomTo(new Date().toISOString().split('T')[0])
  }

  const handleExport = async (type: ExportType, format: 'json' | 'csv' = 'csv') => {
    try {
      const result = await api.exportData(type)
      const items = result.data ?? []

      if (!items.length) {
        showToast('Нет данных для экспорта', 'info')
        return
      }

      const filename = `${type}_${new Date().toISOString().split('T')[0]}.${format}`
      const content =
        format === 'csv'
          ? makeCsv(items)
          : JSON.stringify(items, null, 2)
      const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      showToast(`Файл ${filename} подготовлен`, 'success')
    } catch {
      showToast('Не удалось выполнить экспорт', 'danger')
    }
  }

  const handleSeed = async () => {
    if (!isManagerRole(currentUser?.role)) {
      showToast('Создавать демо-данные может только менеджер', 'danger')
      return
    }

    if (!confirm('Создать демо-данные?')) return

    setSeeding(true)
    try {
      const result = await api.seedData({ vehicles: 30, inspections: 50 })
      if (result.error) {
        showToast(result.error, 'danger')
        return
      }

      await loadDashboard(getAnalyticsParams(dateRange, customFrom, customTo))
      showToast('Демо-данные созданы', 'success')
    } catch {
      showToast('Не удалось создать демо-данные', 'danger')
    } finally {
      setSeeding(false)
    }
  }

  const handleLogout = () => {
    clearAuthToken()
    window.location.reload()
  }

  const canSeedDemoData = isManagerRole(currentUser?.role)

  if (error) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-status-danger">{error}</h1>
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

  return (
    <Layout currentPage="dashboard">
      <div className="p-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title text-2xl">Дашборд</h1>
            <p className="mt-1 text-sm text-foreground-muted">Сводка по технике, осмотрам, дефектам, ДТП и напоминаниям.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {stats.totalVehicles === 0 && canSeedDemoData ? (
              <button onClick={handleSeed} disabled={seeding} className="btn btn-success disabled:opacity-50">
                {seeding ? 'Создание...' : 'Создать демо-данные'}
              </button>
            ) : null}
            <button onClick={handleLogout} className="btn btn-secondary">
              Выйти
            </button>
          </div>
        </header>

        <DashboardFilters
          dateRange={dateRange}
          customFrom={customFrom}
          customTo={customTo}
          onRangeChange={handleDateRangeChange}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onExport={handleExport}
        />

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {stats.totalVehicles === 0 ? <EmptyDashboard canSeed={canSeedDemoData} seeding={seeding} onSeed={handleSeed} /> : null}

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Всего техники" value={stats.totalVehicles} tone="info" code="VH" />
              <StatCard label="Всего осмотров" value={data?.total?.inspections || stats.totalInspections} tone="success" code="IN" />
              <StatCard label="Всего дефектов" value={data?.total?.defects || 0} tone="danger" code="DF" />
              <StatCard label="За выбранный период" value={data?.week?.inspections || 0} tone="purple" code="PR" />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              {accidentStats ? <AccidentCard stats={accidentStats} /> : null}
              {data?.defectsByRegion?.length ? (
                <RegionRankingCard title="Дефекты по регионам" items={data.defectsByRegion} tone="danger" />
              ) : null}
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <VehicleStatusCard items={data?.vehiclesByStatus || []} />
              <InspectionTypeCard items={data?.inspectionsByType || []} />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              {data?.vehiclesByRegion?.length ? (
                <RegionRankingCard title="Техника по регионам" items={data.vehiclesByRegion} tone="info" />
              ) : null}
              {data?.inspectionsByRegion?.length ? (
                <RegionRankingCard title="Осмотры по регионам" items={data.inspectionsByRegion} tone="success" />
              ) : null}
            </section>

            {notifications.length ? <NotificationsCard notifications={notifications} /> : null}
          </>
        )}
      </div>

      {toast ? <div className={toastClassName[toast.tone]}>{toast.text}</div> : null}
    </Layout>
  )
}

function makeCsv(items: Record<string, unknown>[]) {
  const headers = Object.keys(items[0])
  return '\ufeff' + [
    headers.join(';'),
    ...items.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          if (value === null || value === undefined) return ''

          const stringValue = String(value)
          return stringValue.includes(';') || stringValue.includes(',') || stringValue.includes('"')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue
        })
        .join(';'),
    ),
  ].join('\n')
}

function DashboardFilters({
  dateRange,
  customFrom,
  customTo,
  onRangeChange,
  onCustomFromChange,
  onCustomToChange,
  onExport,
}: {
  dateRange: DateRange
  customFrom: string
  customTo: string
  onRangeChange: (range: DateRange) => void
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  onExport: (type: ExportType, format?: 'json' | 'csv') => void
}) {
  return (
    <section className="card mb-6 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground-secondary">Период:</span>
          <select value={dateRange} onChange={(event) => onRangeChange(event.target.value as DateRange)} className="select w-auto min-w-40">
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((range) => (
              <option key={range} value={range}>
                {RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </div>

        {dateRange === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={customFrom} onChange={(event) => onCustomFromChange(event.target.value)} className="input w-auto" />
            <span className="text-foreground-muted">-</span>
            <input type="date" value={customTo} onChange={(event) => onCustomToChange(event.target.value)} className="input w-auto" />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 xl:ml-auto">
          <button onClick={() => onExport('vehicles', 'csv')} className="btn btn-success">
            CSV техники
          </button>
          <button onClick={() => onExport('inspections', 'csv')} className="btn btn-primary">
            CSV осмотров
          </button>
        </div>
      </div>
    </section>
  )
}

function LoadingState() {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
      <p className="mt-3 text-foreground-muted">Загрузка данных...</p>
    </div>
  )
}

function EmptyDashboard({ canSeed, seeding, onSeed }: { canSeed: boolean; seeding: boolean; onSeed: () => void }) {
  return (
    <section className="mb-6 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center shadow-card">
      <h2 className="text-lg font-semibold text-foreground">Данных пока нет</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-foreground-secondary">
        {canSeed
          ? 'Можно заполнить систему демо-данными или начать с добавления реальной техники.'
          : 'Попросите менеджера добавить технику или подготовить демо-данные для первого запуска.'}
      </p>
      {canSeed ? (
        <button onClick={onSeed} disabled={seeding} className="btn btn-success mt-4 disabled:opacity-50">
          {seeding ? 'Создание...' : 'Создать демо-данные'}
        </button>
      ) : null}
    </section>
  )
}

function StatCard({ label, value, tone, code }: { label: string; value: number; tone: ProgressTone; code: string }) {
  const toneClassName: Record<ProgressTone, string> = {
    success: 'text-status-success bg-green-50',
    warning: 'text-status-warning bg-yellow-50',
    danger: 'text-status-danger bg-red-50',
    info: 'text-status-info bg-blue-50',
    purple: 'text-chart-purple bg-purple-50',
  }

  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={`text-3xl font-bold ${toneClassName[tone].split(' ')[0]}`}>{value}</div>
          <div className="mt-1 text-sm text-foreground-muted">{label}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold ${toneClassName[tone]}`}>
          {code}
        </div>
      </div>
    </div>
  )
}

function AccidentCard({ stats }: { stats: AccidentStats }) {
  return (
    <article className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-status-danger">Статистика ДТП</h2>
        <span className="badge badge-success">{stats.daysWithoutAccident ?? 0} дн. без ДТП</span>
      </div>
      <div className="alert-danger mb-4 rounded-card p-6 text-center">
        <div className="text-5xl font-bold text-status-danger">{stats.total || 0}</div>
        <div className="mt-1 text-sm text-foreground-secondary">Всего ДТП</div>
      </div>
      {stats.recent?.length ? (
        <div className="space-y-2">
          {stats.recent.slice(0, 3).map((accident) => (
            <div key={accident.id} className="flex items-center justify-between gap-3 rounded-card bg-muted-surface p-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-foreground">{accident.vehicle_number}</span>
                <span className="ml-2 text-foreground-muted">{accident.vehicle_name}</span>
              </div>
              <span className="shrink-0 text-foreground-muted">{formatDate(accident.created_at)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <Link href="/inspections?type=accident" className="mt-4 block text-center text-sm font-medium text-primary hover:text-primary-hover">
        Все ДТП
      </Link>
    </article>
  )
}

function RegionRankingCard({ title, items, tone }: { title: string; items: CountByRegion[]; tone: ProgressTone }) {
  const maxCount = getMaxCount(items)

  return (
    <article className="card p-6">
      <h2 className={`mb-4 text-lg font-bold ${tone === 'danger' ? 'text-status-danger' : tone === 'success' ? 'text-status-success' : 'text-status-info'}`}>
        {title}
      </h2>
      <div className="space-y-3">
        {items.slice(0, 5).map((item, index) => (
          <div key={item.region || `region-${index}`} className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted-surface text-sm font-bold text-foreground-muted">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{item.region || 'Не указано'}</div>
              <div className="progress mt-1 h-2">
                <div className={`${progressClassName[tone]} h-2 rounded-pill`} style={{ width: getPercentage(item.count, maxCount) }}></div>
              </div>
            </div>
            <span className={`text-lg font-bold ${tone === 'danger' ? 'text-status-danger' : tone === 'success' ? 'text-status-success' : 'text-status-info'}`}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}

function VehicleStatusCard({ items }: { items: CountByStatus[] }) {
  const maxCount = getMaxCount(items)

  return (
    <article className="card p-6">
      <h2 className="mb-4 text-lg font-bold text-status-info">Техника по статусу</h2>
      <div className="space-y-4">
        {items.map((item) => {
          const tone = getVehicleStatusTone(item.status)
          return (
            <ProgressRow
              key={item.status}
              label={getVehicleStatusLabel(item.status)}
              count={item.count}
              maxCount={maxCount}
              tone={tone}
            />
          )
        })}
      </div>
    </article>
  )
}

function InspectionTypeCard({ items }: { items: CountByType[] }) {
  const maxCount = getMaxCount(items)

  return (
    <article className="card p-6">
      <h2 className="mb-4 text-lg font-bold text-status-success">Осмотры по типу</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <ProgressRow
            key={item.type}
            label={getTypeLabel(item.type)}
            count={item.count}
            maxCount={maxCount}
            tone={getInspectionTypeTone(item.type)}
          />
        ))}
      </div>
    </article>
  )
}

function ProgressRow({ label, count, maxCount, tone }: { label: string; count: number; maxCount: number; tone: ProgressTone }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-foreground-secondary">
        <span>{label}</span>
        <span className="font-bold text-foreground">{count}</span>
      </div>
      <div className="progress h-4">
        <div className={`${progressClassName[tone]} h-4 rounded-pill`} style={{ width: getPercentage(count, maxCount) }}></div>
      </div>
    </div>
  )
}

function NotificationsCard({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-status-warning">Напоминания о плановых осмотрах</h2>
        <span className="text-sm text-foreground-muted">{notifications.length} шт.</span>
      </div>
      <div className="space-y-2">
        {notifications.slice(0, 3).map((notification) => (
          <div
            key={notification.vehicle_id}
            className={`flex items-center justify-between gap-3 rounded-card p-3 ${
              notification.is_overdue ? 'alert-danger' : 'alert-warning'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{notification.is_overdue ? '!' : '*'}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{notification.vehicle_number}</p>
                <p className="text-xs text-foreground-secondary">
                  {notification.is_overdue
                    ? `Просрочено на ${Math.abs(notification.days_until)} дн.`
                    : `До срока ${notification.days_until} дн.`}
                </p>
              </div>
            </div>
            <Link href={`/inspections?vehicle=${notification.vehicle_id}`} className="text-xs font-medium text-primary hover:underline">
              Осмотр
            </Link>
          </div>
        ))}
      </div>
      {notifications.length > 3 ? (
        <Link href="/settings" className="mt-3 block text-center text-sm text-primary hover:underline">
          Показать все ({notifications.length})
        </Link>
      ) : null}
    </section>
  )
}
