import type { UserRecord, UserRole } from '@/lib/types'

export type UserFormData = {
  email: string
  password: string
  name: string
  role: UserRole
}

export type SortableUserKey = 'name' | 'email' | 'role' | 'created_at'

export type SortConfig = {
  key: SortableUserKey
  direction: 'asc' | 'desc'
}

export type MessageTone = 'success' | 'error'

export const EMPTY_FORM: UserFormData = {
  email: '',
  password: '',
  name: '',
  role: 'inspector',
}

export const PANEL_MANAGED_ROLES = new Set<UserRole>(['inspector', 'manager'])

export const USER_COLUMNS: Array<{ key: SortableUserKey; label: string }> = [
  { key: 'name', label: 'Имя' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Роль' },
  { key: 'created_at', label: 'Дата создания' },
]

export function getRoleLabel(role: string): string {
  if (role === 'manager') return 'Менеджер'
  if (role === 'owner') return 'Владелец'
  if (role === 'admin') return 'Администратор'
  return 'Инспектор'
}

export function getRoleBadgeClass(role: string): string {
  if (role === 'owner' || role === 'admin') return 'bg-amber-100 text-amber-800'
  if (role === 'manager') return 'bg-purple-100 text-purple-700'
  return 'bg-blue-100 text-blue-700'
}

export function canManagePanelUser(user: UserRecord): boolean {
  return PANEL_MANAGED_ROLES.has(user.role)
}
