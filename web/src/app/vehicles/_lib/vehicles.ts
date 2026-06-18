import type { VehicleStatus } from '@/lib/types'

export type VehicleFormData = {
  number: string
  name: string
  status: VehicleStatus
  region: string
  quickInspectionIntervalDays: string
  plannedInspectionIntervalDays: string
}

export type SortableVehicleKey = 'number' | 'name' | 'region' | 'status' | 'defectsCount' | 'inspectionSchedule'

export type SortConfig = {
  key: SortableVehicleKey
  direction: 'asc' | 'desc'
}

export type ColumnConfig = {
  key: SortableVehicleKey
  label: string
}

export const ITEMS_PER_BATCH = 20

export const INITIAL_FORM: VehicleFormData = {
  number: '',
  name: '',
  status: 'active',
  region: '',
  quickInspectionIntervalDays: '',
  plannedInspectionIntervalDays: '',
}

export const COLUMNS: ColumnConfig[] = [
  { key: 'number', label: 'Госномер' },
  { key: 'name', label: 'Название' },
  { key: 'region', label: 'Регион' },
  { key: 'status', label: 'Статус' },
  { key: 'defectsCount', label: 'Дефекты' },
  { key: 'inspectionSchedule', label: 'График осмотров' },
]

export function getStatusLabel(status: string) {
  if (status === 'active') return 'В работе'
  if (status === 'repair') return 'Ремонт'
  if (status === 'archived') return 'Архив'
  return status || 'Не указано'
}

export function getStatusBadgeClass(status: string) {
  if (status === 'repair') return 'badge badge-warning'
  if (status === 'archived') return 'badge badge-secondary'
  return 'badge badge-success'
}

export function getSortMarker(sortConfig: SortConfig, key: SortableVehicleKey) {
  if (sortConfig.key !== key) return '↕'
  return sortConfig.direction === 'asc' ? '↑' : '↓'
}
