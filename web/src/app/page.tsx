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
  DashboardStats,
  ExportType,
  NotificationItem,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

type DateRange = 'week' | 'today' | 'month' | 'quarter' | 'year' | 'all' | 'custom'

function getTypeLabel(type: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type
}

function getAnalyticsParams(range: DateRange, customFrom: string, customTo: string) {
  if (range === 'week' || range === 'all') {
    return ''
  }

  if (range === 'custom') {
    if (!customFrom) return ''
    return `?from=${customFrom}${customTo ? `&to=${customTo}` : ''}`
  }

  const now = new Date()
  let from = ''

  switch (range) {
    case 'today':
      from = now.toISOString().split('T')[0]
      break
    case 'month':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      break
    case 'quarter':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      break
    case 'year':
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      break
  }

  return from ? `?from=${from}` : ''
}

function getRangeStart(range: Exclude<DateRange, 'week' | 'all' | 'custom'>) {
  const now = new Date()

  switch (range) {
    case 'today':
      return now.toISOString().split('T')[0]
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
}

function getMaxCount(items: Array<{ count: number }> | undefined) {
  return Math.max(...(items?.map((item) => item.count) || [1]))
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
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    const params = getAnalyticsParams(dateRange, customFrom, customTo)
    void loadDashboard(params)
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

      if (notifRes.error) {
        showToast(`Уведомления недоступны: ${notifRes.error}`)
      }

      if (analyticsRes.error) {
        showToast(`Аналитика недоступна: ${analyticsRes.error}`)
      }

      const statsData: Partial<DashboardStats> = statsRes.data || {}
      const notificationsData = notifRes.data || []
      const analyticsData = analyticsRes.data || {}

      setStats({
        totalVehicles: statsData.totalVehicles || 0,
        vehiclesWithDefects: statsData.vehiclesWithDefects || 0,
        totalInspections: statsData.totalInspections || 0,
        inspectionsToday: statsData.inspectionsToday || 0,
      })
      setNotifications(notificationsData)
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

    if (range === 'custom' || range === 'week' || range === 'all') {
      return
    }

    const from = getRangeStart(range)
    const today = new Date().toISOString().split('T')[0]
    setCustomFrom(from)
    setCustomTo(today)
  }

  const handleExport = async (type: ExportType, format: 'json' | 'csv' = 'csv') => {
    try {
      const result = await api.exportData(type)
      const items = result.data ?? []

      if (items.length === 0) {
        showToast('Нет данных для экспорта')
        return
      }

      let content: string
      let mimeType: string
      let filename: string

      if (format === 'csv') {
        const headers = Object.keys(items[0])
        content = '\ufeff' + [
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
        mimeType = 'text/csv;charset=utf-8'
        filename = `${type}_${new Date().toISOString().split('T')[0]}.csv`
      } else {
        content = JSON.stringify(items, null, 2)
        mimeType = 'application/json'
        filename = `${type}_${new Date().toISOString().split('T')[0]}.json`
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      showToast(`Файл ${filename} подготовлен`)
    } catch {
      showToast('Не удалось выполнить экспорт')
    }
  }

  const handleSeed = async () => {
    if (!isManagerRole(currentUser?.role)) {
      showToast('Создавать демо-данные может только менеджер')
      return
    }

    if (!confirm('Создать демо-данные?')) return

    setSeeding(true)
    try {
      const result = await api.seedData({ vehicles: 30, inspections: 50 })
      if (result.error) {
        showToast(result.error)
        return
      }

      await loadDashboard(getAnalyticsParams(dateRange, customFrom, customTo))
      showToast('Демо-данные созданы')
    } catch {
      showToast('Не удалось создать демо-данные')
    } finally {
      setSeeding(false)
    }
  }

  const handleLogout = () => {
    clearAuthToken()
    window.location.reload()
  }

  const canSeedDemoData = isManagerRole(currentUser?.role)
  const backendHint = 'Убедитесь, что backend запущен на http://localhost:3001. Для локального старта используйте npm run dev из корня проекта.'

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-lg bg-white p-8 text-center shadow-md">
          <h1 className="text-2xl font-bold text-red-600">{error}</h1>
          <p className="mt-3 max-w-md text-sm text-slate-500">{backendHint}</p>
          <button onClick={() => window.location.reload()} className="mt-4 rounded bg-blue-600 px-4 py-2 text-white">
            Повторить
          </button>
        </div>
      </div>
    )
  }

  return (
    <Layout currentPage="dashboard">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Дашборд</h1>
            <p className="mt-1 text-sm text-slate-500">Сводка по технике, осмотрам, дефектам и напоминаниям.</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.totalVehicles === 0 && canSeedDemoData ? (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {seeding ? 'Создание...' : 'Создать демо-данные'}
              </button>
            ) : null}
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Выйти
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Период:</span>
              <select
                value={dateRange}
                onChange={(event) => handleDateRangeChange(event.target.value as DateRange)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Неделя</option>
                <option value="today">Сегодня</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="year">Год</option>
                <option value="all">За всё время</option>
                <option value="custom">Свой период</option>
              </select>
            </div>

            {dateRange === 'custom' ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : null}

            <div className="ml-auto flex gap-4">
              <button
                onClick={() => handleExport('vehicles', 'csv')}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                CSV техники
              </button>
              <button
                onClick={() => handleExport('inspections', 'csv')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                CSV осмотров
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-3 text-slate-500">Загрузка данных...</p>
          </div>
        ) : (
          <>
            {stats.totalVehicles === 0 ? (
              <div className="mb-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Данных пока нет</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {canSeedDemoData
                    ? 'Можно заполнить систему демо-данными или начать с добавления реальной техники.'
                    : 'Попросите менеджера добавить технику или подготовить демо-данные для первого запуска.'}
                </p>
                {canSeedDemoData ? (
                  <button
                    onClick={handleSeed}
                    disabled={seeding}
                    className="mt-4 inline-flex rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {seeding ? 'Создание...' : 'Создать демо-данные'}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-blue-600">{stats.totalVehicles}</div>
                    <div className="mt-1 text-sm text-slate-500">Всего техники</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-700">
                    VH
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-green-600">{data?.total?.inspections || stats.totalInspections}</div>
                    <div className="mt-1 text-sm text-slate-500">Всего осмотров</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-sm font-semibold text-green-700">
                    IN
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-red-600">{data?.total?.defects || 0}</div>
                    <div className="mt-1 text-sm text-slate-500">Всего дефектов</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-sm font-semibold text-red-700">
                    DF
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-purple-600">{data?.week?.inspections || 0}</div>
                    <div className="mt-1 text-sm text-slate-500">За выбранный период</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-sm font-semibold text-purple-700">
                    PR
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {accidentStats ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-red-600">Статистика ДТП</h2>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                      {accidentStats.daysWithoutAccident ?? 0} дн. без ДТП
                    </span>
                  </div>
                  <div className="mb-4 rounded-2xl bg-red-50 p-6 text-center">
                    <div className="text-5xl font-bold text-red-600">{accidentStats.total || 0}</div>
                    <div className="mt-1 text-sm text-slate-600">Всего ДТП</div>
                  </div>
                  {accidentStats.recent && accidentStats.recent.length > 0 ? (
                    <div className="space-y-2">
                      {accidentStats.recent.slice(0, 3).map((accident) => (
                        <div key={accident.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                          <div>
                            <span className="font-medium text-slate-700">{accident.vehicle_number}</span>
                            <span className="ml-2 text-slate-400">{accident.vehicle_name}</span>
                          </div>
                          <span className="text-slate-500">{formatDate(accident.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Link href="/inspections?type=accident" className="mt-4 block text-center text-sm font-medium text-blue-600 hover:text-blue-700">
                    Все ДТП
                  </Link>
                </div>
              ) : null}

              {data?.defectsByRegion && data.defectsByRegion.length > 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-orange-600">Дефекты по регионам</h2>
                  <div className="space-y-3">
                    {data.defectsByRegion.slice(0, 5).map((item, idx) => (
                      <div key={item.region || `region-${idx}`} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-700">{item.region || 'Не указано'}</div>
                          <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-red-500"
                              style={{ width: `${Math.min(100, (item.count / getMaxCount(data.defectsByRegion)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-red-600">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-blue-600">Техника по статусу</h2>
                {data?.vehiclesByStatus?.map((item) => {
                  const percentage = getMaxCount(data.vehiclesByStatus) > 0 ? (item.count / getMaxCount(data.vehiclesByStatus)) * 100 : 0
                  const color = item.status === 'active' ? 'bg-green-500' : 'bg-orange-500'

                  return (
                    <div key={item.status} className="mb-3">
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{item.status === 'active' ? 'В работе' : 'Ремонт'}</span>
                        <span className="font-bold">{item.count}</span>
                      </div>
                      <div className="h-4 w-full rounded-full bg-slate-100">
                        <div className={`${color} h-4 rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-green-600">Осмотры по типу</h2>
                {data?.inspectionsByType?.map((item) => {
                  const percentage = getMaxCount(data.inspectionsByType) > 0 ? (item.count / getMaxCount(data.inspectionsByType)) * 100 : 0
                  const colors: Record<string, string> = {
                    quick: 'bg-blue-500',
                    scheduled: 'bg-purple-500',
                    accident: 'bg-red-500',
                  }

                  return (
                    <div key={item.type} className="mb-3">
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{getTypeLabel(item.type)}</span>
                        <span className="font-bold">{item.count}</span>
                      </div>
                      <div className="h-4 w-full rounded-full bg-slate-100">
                        <div className={`${colors[item.type] || 'bg-gray-500'} h-4 rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {data?.vehiclesByRegion && data.vehiclesByRegion.length > 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-blue-600">Техника по регионам</h2>
                  <div className="space-y-3">
                    {data.vehiclesByRegion.slice(0, 5).map((item, idx) => (
                      <div key={item.region || `vehicles-region-${idx}`} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-700">{item.region || 'Не указано'}</div>
                          <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: `${Math.min(100, (item.count / getMaxCount(data.vehiclesByRegion)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-blue-600">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {data?.inspectionsByRegion && data.inspectionsByRegion.length > 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-green-600">Осмотры по регионам</h2>
                  <div className="space-y-3">
                    {data.inspectionsByRegion.slice(0, 5).map((item, idx) => (
                      <div key={item.region || `inspections-region-${idx}`} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-700">{item.region || 'Не указано'}</div>
                          <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-green-500"
                              style={{ width: `${Math.min(100, (item.count / getMaxCount(data.inspectionsByRegion)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-green-600">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {notifications.length > 0 ? (
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-yellow-600">Напоминания о плановых осмотрах</h2>
                  <span className="text-sm text-gray-500">{notifications.length} шт.</span>
                </div>
                <div className="space-y-2">
                  {notifications.slice(0, 3).map((notification) => (
                    <div
                      key={notification.vehicle_id}
                      className={`flex items-center justify-between rounded-lg p-3 ${
                        notification.is_overdue ? 'bg-red-50' : 'bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{notification.is_overdue ? '!' : '*'}</span>
                        <div>
                          <p className="text-sm font-medium">{notification.vehicle_number}</p>
                          <p className="text-xs text-gray-500">
                            {notification.is_overdue
                              ? `Просрочено на ${Math.abs(notification.days_until)} дн.`
                              : `До срока ${notification.days_until} дн.`}
                          </p>
                        </div>
                      </div>
                      <Link href={`/inspections?vehicle=${notification.vehicle_id}`} className="text-xs text-blue-600 hover:underline">
                        Осмотр
                      </Link>
                    </div>
                  ))}
                </div>
                {notifications.length > 3 ? (
                  <Link href="/settings" className="mt-3 block text-center text-sm text-blue-600 hover:underline">
                    Показать все ({notifications.length})
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-gray-800 px-6 py-3 text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </Layout>
  )
}
