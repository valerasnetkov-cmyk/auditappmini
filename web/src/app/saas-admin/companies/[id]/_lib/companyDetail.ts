import type { ResourceCompanyLimitsPayload, SaasCompanyDetailsResponse, SaasOwner } from '@/lib/types'

export type CompanyEditForm = {
  slug: string
  name: string
  region_code: string
  data_residency: string
  status: 'active' | 'inactive'
}

export type OwnerForm = {
  email: string
  name: string
}

export type LimitForm = ResourceCompanyLimitsPayload

export function numberOrNull(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ru-RU')
}

export function formatCurrency(value?: number | null, currency = 'RUB') {
  return `${formatNumber(value)} ${currency === 'RUB' ? '₽' : currency}`
}

export function formatDate(value?: string | null) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function statusTone(value?: string | null) {
  if (value === 'expired' || value === 'suspended' || value === 'inactive') return 'bg-red-50 text-red-700 ring-red-100'
  if (value === 'expiring' || value === 'grace') return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
}

export function setupStatusLabel(owner: SaasOwner) {
  const status = owner.setup?.status
  if (status === 'accepted') return 'Доступ активирован'
  if (status === 'pending') return `Ожидает до ${formatDate(owner.setup?.expires_at)}`
  if (status === 'expired') return 'Ссылка истекла'
  return 'Ссылка не создана'
}

export function setupStatusClass(owner: SaasOwner) {
  const status = owner.setup?.status
  if (status === 'accepted') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'pending') return 'bg-blue-50 text-blue-700 ring-blue-100'
  if (status === 'expired') return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-gray-50 text-gray-600 ring-gray-100'
}

export function ownerInviteMailto(owner: SaasOwner, url: string) {
  const subject = encodeURIComponent('Доступ к Аудит авто')
  const body = encodeURIComponent([
    `${owner.name}, здравствуйте.`,
    '',
    'Для активации доступа владельца компании откройте ссылку и задайте пароль:',
    url,
    '',
    'Если ссылка истекла, запросите новую у администратора ресурса.',
  ].join('\n'))

  return `mailto:${encodeURIComponent(owner.email)}?subject=${subject}&body=${body}`
}

export function limitFormFromData(data: SaasCompanyDetailsResponse | null): LimitForm {
  return {
    planCode: data?.limits?.planCode || 'pilot',
    maxVehicles: data?.limits?.maxVehicles ?? null,
    maxUsers: data?.limits?.maxUsers ?? null,
    maxStorageMb: data?.limits?.maxStorageMb ?? null,
    ocrEnabled: data?.limits?.ocrEnabled ?? true,
    accidentModuleEnabled: data?.limits?.accidentModuleEnabled ?? true,
    analyticsEnabled: data?.limits?.analyticsEnabled ?? true,
    pdfReportEnabled: data?.limits?.pdfReportEnabled ?? true,
    apiAccessEnabled: data?.limits?.apiAccessEnabled ?? false,
  }
}

export function companyFormFromData(data: SaasCompanyDetailsResponse): CompanyEditForm {
  return {
    slug: data.company.slug || data.company.id,
    name: data.company.name,
    region_code: data.company.region_code || '',
    data_residency: data.company.data_residency || '',
    status: data.company.status === 'inactive' ? 'inactive' : 'active',
  }
}
