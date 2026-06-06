import type { VehicleStatus } from '@/lib/types'

export type DefectHistoryEntry = {
  id: string
  status: string
  changed_at: string
  changed_by?: string | null
  changed_by_name?: string | null
}

export function getPhotoThumbUrl(photo: { url: string; webp_url?: string | null; thumb_url?: string | null }) {
  return photo.thumb_url || photo.webp_url || photo.url
}

export function getInspectionTypeLabel(type: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

export function getInspectionTypeStyle(type: string) {
  if (type === 'quick') return 'badge badge-info'
  if (type === 'scheduled') return 'badge badge-warning'
  return 'badge badge-danger'
}

export function getVehicleStatusLabel(status?: string) {
  if (status === 'active') return 'В работе'
  if (status === 'repair') return 'Ремонт'
  return status || 'Не указано'
}

export function getVehicleStatusBadgeClass(status?: string) {
  if (status === 'repair') return 'badge badge-warning'
  return 'badge badge-success'
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Не указано'

  return date.toLocaleString('ru-RU')
}

export type StatTone = 'success' | 'warning' | 'danger' | 'info'

export const statusOptions: VehicleStatus[] = ['active', 'repair']
