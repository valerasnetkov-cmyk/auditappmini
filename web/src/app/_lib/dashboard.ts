import type { ExportType } from '@/lib/types'

export type DateRange = 'week' | 'today' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
export type ProgressTone = 'success' | 'warning' | 'danger' | 'info' | 'purple'
export type ToastTone = 'success' | 'danger' | 'info'

export type ToastMessage = {
  tone: ToastTone
  text: string
}

export const RANGE_LABELS: Record<DateRange, string> = {
  week: 'Неделя',
  today: 'Сегодня',
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
  all: 'За все время',
  custom: 'Свой период',
}

export const TOAST_CLASS_NAME: Record<ToastTone, string> = {
  success: 'toast toast-success',
  danger: 'toast toast-error',
  info: 'toast bg-elevated text-foreground',
}

export const STAT_TONE_CLASS_NAME: Record<ProgressTone, string> = {
  success: 'text-status-success bg-green-50',
  warning: 'text-status-warning bg-yellow-50',
  danger: 'text-status-danger bg-red-50',
  info: 'text-status-info bg-blue-50',
  purple: 'text-chart-purple bg-purple-50',
}

export function getAnalyticsParams(range: DateRange, customFrom: string, customTo: string): string {
  if (range === 'week' || range === 'all') return ''

  if (range === 'custom') {
    if (!customFrom) return ''
    return `?from=${customFrom}${customTo ? `&to=${customTo}` : ''}`
  }

  const from = getRangeStart(range)
  return from ? `?from=${from}` : ''
}

export function getRangeStart(range: Exclude<DateRange, 'week' | 'all' | 'custom'>): string | undefined {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000

  if (range === 'today') return now.toISOString().split('T')[0]
  if (range === 'month') return new Date(now.getTime() - 30 * dayMs).toISOString().split('T')[0]
  if (range === 'quarter') return new Date(now.getTime() - 90 * dayMs).toISOString().split('T')[0]
  if (range === 'year') return new Date(now.getTime() - 365 * dayMs).toISOString().split('T')[0]

  return undefined
}

export function buildExcelExportFilename(type: ExportType): string {
  return `${type}_${new Date().toISOString().split('T')[0]}.xlsx`
}

export function getChartTitleToneClassName(tone: ProgressTone): string {
  if (tone === 'danger') return 'text-status-danger'
  if (tone === 'success') return 'text-status-success'
  if (tone === 'purple') return 'text-chart-purple'
  return 'text-status-info'
}
