'use client'

import { useCallback, useState } from 'react'
import api from '@/lib/api/client'
import type { AnalyticsOverview, CompanyUsageResponse, AuthUser, DashboardStats, ExportType, NotificationItem } from '@/lib/types'
import { buildExportFilename, getAnalyticsParams, makeCsv, type DateRange } from '../_lib/dashboard'
import type { ToastTone } from '../_lib/dashboard'

type LoadDashboardDeps = {
  router: { replace: (path: string) => void }
  showToast: (text: string, tone?: ToastTone) => void
  dateRange: DateRange
  customFrom: string
  customTo: string
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    vehiclesWithDefects: 0,
    totalInspections: 0,
    inspectionsToday: 0,
  })
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [accidentStats, setAccidentStats] = useState<AnalyticsOverview['accidents'] | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [usage, setUsage] = useState<CompanyUsageResponse | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async ({ router, showToast, dateRange, customFrom, customTo }: LoadDashboardDeps) => {
    try {
      setLoading(true)
      setError('')

      const [statsRes, notifRes, meRes, usageRes] = await Promise.all([
        api.getDashboardStats(),
        api.getNotifications(),
        api.getMe(),
        api.getCompanyUsage(),
      ])

      const authExpired = [statsRes, notifRes, meRes, usageRes].some((result) => result.error === 'AUTH_REQUIRED')
      if (authExpired) {
        router.replace('/login')
        return
      }

      if (statsRes.error) {
        setError(statsRes.error)
        return
      }

      if (notifRes.error) showToast(`Уведомления недоступны: ${notifRes.error}`, 'danger')
      if (usageRes.error) showToast(`Ограничения компании недоступны: ${usageRes.error}`, 'danger')

      const statsData: Partial<DashboardStats> = statsRes.data || {}
      const usageData = usageRes.data || null
      const analyticsAllowed = usageData?.features.analytics.enabled !== false
      let analyticsData: AnalyticsOverview | null = null

      if (analyticsAllowed) {
        const analyticsRes = await api.getAnalyticsOverview(getAnalyticsParams(dateRange, customFrom, customTo))

        if (analyticsRes.error === 'AUTH_REQUIRED') {
          router.replace('/login')
          return
        }

        if (analyticsRes.error) {
          showToast(`Аналитика недоступна: ${analyticsRes.error}`, 'danger')
        }

        analyticsData = analyticsRes.data || null
      }

      setStats({
        totalVehicles: statsData.totalVehicles || 0,
        vehiclesWithDefects: statsData.vehiclesWithDefects || 0,
        totalInspections: statsData.totalInspections || 0,
        inspectionsToday: statsData.inspectionsToday || 0,
      })
      setNotifications(notifRes.data || [])
      setAccidentStats(analyticsData?.accidents || null)
      setAnalytics(analyticsData)
      setUsage(usageData)
      setUser(meRes.data || null)
    } catch {
      setError('Не удалось загрузить данные дашборда')
    } finally {
      setLoading(false)
    }
  }, [])

  return { stats, notifications, accidentStats, analytics, usage, user, loading, error, load }
}

export function useDashboardExport() {
  const [seeding, setSeeding] = useState(false)

  const exportData = useCallback(
    async (type: ExportType, showToast: (text: string, tone?: ToastTone) => void, analyticsEnabled: boolean) => {
      if (!analyticsEnabled) {
        showToast('Аналитика и экспорт отключены тарифом компании', 'info')
        return
      }

      try {
        const result = await api.exportData(type)
        const items = result.data ?? []

        if (!items.length) {
          showToast('Нет данных для экспорта', 'info')
          return
        }

        const filename = buildExportFilename(type, 'csv')
        const content = makeCsv(items)
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
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
    },
    [],
  )

  const seedData = useCallback(
    async (
      showToast: (text: string, tone?: ToastTone) => void,
      canSeed: boolean,
      createRestriction: { title: string; message: string } | null,
      onSuccess: () => Promise<void>,
    ) => {
      if (!canSeed) {
        showToast('Создавать демо-данные может только менеджер', 'danger')
        return
      }

      if (createRestriction) {
        showToast(`${createRestriction.title}: ${createRestriction.message}`, 'danger')
        return
      }

      if (typeof window !== 'undefined' && !window.confirm('Создать демо-данные?')) return

      setSeeding(true)
      try {
        const result = await api.seedData({ vehicles: 30, inspections: 50 })
        if (result.error) {
          showToast(result.error, 'danger')
          return
        }

        await onSuccess()
        showToast('Демо-данные созданы', 'success')
      } catch {
        showToast('Не удалось создать демо-данные', 'danger')
      } finally {
        setSeeding(false)
      }
    },
    [],
  )

  return { seeding, exportData, seedData }
}
