'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import type { AnalyticsOverview, CompanyUsageResponse, AuthUser, DashboardStats, ExportType, NotificationItem } from '@/lib/types'
import { buildExcelExportFilename, getAnalyticsParams, type DateRange } from '../_lib/dashboard'
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
    overdueInspections: 0,
    openDefects: 0,
    criticalDefects: 0,
    unfinishedInspections: 0,
    failedPhotoUploads: 0,
  })
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [accidentStats, setAccidentStats] = useState<AnalyticsOverview['accidents'] | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [usage, setUsage] = useState<CompanyUsageResponse | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshUsage = useCallback(async () => {
    const result = await api.getCompanyUsage()
    if (!result.error) setUsage(result.data || null)
  }, [])

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
        overdueInspections: statsData.overdueInspections || 0,
        openDefects: statsData.openDefects || 0,
        criticalDefects: statsData.criticalDefects || 0,
        unfinishedInspections: statsData.unfinishedInspections || 0,
        failedPhotoUploads: statsData.failedPhotoUploads || 0,
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

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshUsage()
    }
    const refreshOnFocus = () => {
      void refreshUsage()
    }
    const intervalId = window.setInterval(() => {
      void refreshUsage()
    }, 60 * 60 * 1000)

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshOnFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [refreshUsage])

  return { stats, notifications, accidentStats, analytics, usage, user, loading, error, load }
}

export function useDashboardExport() {
  const [seeding, setSeeding] = useState(false)

  const exportData = useCallback(
    async (type: ExportType, showToast: (text: string, tone?: ToastTone) => void, exportEnabled: boolean) => {
      if (!exportEnabled) {
        showToast('Экспорт отчётов отключён тарифом компании', 'info')
        return
      }

      try {
        const result = await api.exportData(type)
        if (result.error) {
          showToast(result.error, 'danger')
          return
        }

        const items = result.data?.data ?? []

        if (!items.length) {
          showToast('Нет данных для экспорта', 'info')
          return
        }

        const ExcelJS = await import('exceljs')
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Отчёт')
        const headers = Object.keys(items[0])

        worksheet.columns = headers.map((header) => ({
          header,
          key: header,
          width: Math.min(42, Math.max(14, header.length + 4)),
        }))
        worksheet.addRows(items)
        worksheet.views = [{ state: 'frozen', ySplit: 1 }]
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: headers.length },
        }
        worksheet.getRow(1).font = { bold: true }
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEFF6FF' },
        }
        headers.forEach((header, index) => {
          const column = worksheet.getColumn(index + 1)
          let maxLength = header.length
          column.values.forEach((value) => {
            maxLength = Math.max(maxLength, String(value ?? '').length)
          })
          column.width = Math.min(48, Math.max(14, maxLength + 2))
        })

        const filename = buildExcelExportFilename(type)
        const content = await workbook.xlsx.writeBuffer()
        const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
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
