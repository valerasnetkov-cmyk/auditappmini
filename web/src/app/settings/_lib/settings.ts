import type { CompanyFeatureAccess, CompanyResourceUsage, ServiceNotificationRecipient } from '@/lib/types'

export type ImportResult = {
  imported: number
  errors: { row: number; error: string }[]
  regionsAdded?: number
}

export type StatusMessage = {
  tone: 'success' | 'warning' | 'danger' | 'info'
  text: string
}

export const COMPANY_USAGE_STALE_BACKEND_ERROR =
  'Backend на http://localhost:3001 запущен старой версией и не знает endpoint /api/company/usage. Перезапустите backend из корня проекта или командой npm --prefix backend run dev.'

export function formatCompanyUsageError(error: string) {
  if (error === 'HTTP 404') return COMPANY_USAGE_STALE_BACKEND_ERROR
  return `Не удалось загрузить тариф компании: ${error}`
}

export type ParsedVehicle = {
  number: string
  name: string
  region: string
}

export function getRegionVehicleCount(region: { vehicle_count?: number; vehicleCount?: number }) {
  return Number(region.vehicle_count ?? region.vehicleCount ?? 0)
}

export function parseToken(value: unknown) {
  return String(value || '').trim()
}

export function normalizePlateValue(value: unknown) {
  return parseToken(value).replace(/\s+/g, '').toUpperCase()
}

export function isRussianPlateLike(value: string) {
  return /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/i.test(value)
}

export function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0))
}

export function formatPlanCode(code?: string | null) {
  if (!code) return 'Без тарифа'
  return code.toUpperCase()
}

export function formatUsageValue(usage: CompanyResourceUsage) {
  if (usage.unlimited || usage.max === null) {
    return `${formatNumber(usage.current)} / без лимита`
  }
  return `${formatNumber(usage.current)} / ${formatNumber(usage.max)}`
}

export function getUsageBarWidth(usage: CompanyResourceUsage) {
  if (usage.percent === null || usage.percent === undefined) return '0%'
  return `${Math.max(0, Math.min(100, usage.percent))}%`
}

export function getUsageTone(usage: CompanyResourceUsage) {
  if (usage.exceeded) return 'bg-status-danger'
  if (usage.percent !== null && usage.percent >= 90) return 'bg-status-warning'
  return 'bg-status-success'
}

export function getUsageHint(usage: CompanyResourceUsage, unit: string) {
  if (usage.unlimited || usage.max === null) return 'Лимит не задан'
  if (usage.exceeded) return `Превышение на ${formatNumber(usage.current - usage.max)} ${unit}`
  return `Осталось ${formatNumber(usage.remaining)} ${unit}`
}

export function getFeatureLabel(feature: CompanyFeatureAccess) {
  return feature.enabled ? 'Доступно' : 'Отключено тарифом'
}

export function getFeatureClassName(feature: CompanyFeatureAccess) {
  return feature.enabled
    ? 'border-green-100 bg-green-50 text-status-success'
    : 'border-red-100 bg-red-50 text-status-danger'
}

export function recipientRoleLabel(role: ServiceNotificationRecipient['role']) {
  return role === 'owner' ? 'Владелец' : 'Менеджер'
}

import { getCompanyOperationRestriction, type CompanyOperationRestriction } from '@/lib/companyAccess'

export function buildWriteBlockedMessage(
  usage: import('@/lib/types').CompanyUsageResponse | null,
  loading: boolean,
  restriction: CompanyOperationRestriction | null,
): string {
  if (loading) {
    return 'Проверяем статус тарифа компании. Изменения станут доступны после проверки.'
  }
  if (restriction) {
    return `${restriction.title}: ${restriction.message}`
  }
  return ''
}

export function pickRestriction(usage: import('@/lib/types').CompanyUsageResponse | null, mode: 'create' | 'write') {
  return getCompanyOperationRestriction(usage, mode)
}
