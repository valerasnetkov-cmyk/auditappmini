import type { ResourceCompanyLimitsPayload, SaasCompanyStats, SaasOwner } from '@/lib/types'

export type CompanyForm = {
  id: string
  slug: string
  name: string
}

export type OwnerForm = {
  companyId: string
  email: string
  name: string
}

export type LimitForm = ResourceCompanyLimitsPayload & {
  companyId: string
}

export const emptyCompanyForm: CompanyForm = { id: '', slug: '', name: '' }

export const emptyOwnerForm: OwnerForm = { companyId: '', email: '', name: '' }

export const emptyLimitForm: LimitForm = {
  companyId: '',
  planCode: 'pilot',
  maxVehicles: null,
  maxUsers: null,
  maxStorageMb: null,
  ocrEnabled: true,
  accidentModuleEnabled: true,
  analyticsEnabled: true,
  pdfReportEnabled: true,
  apiAccessEnabled: false,
}

export function numberOrNull(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function displayLimit(value?: number | null) {
  return value === null || value === undefined ? 'Без лимита' : String(value)
}

export function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ru-RU')
}

export function formatCurrency(value?: number | null) {
  return `${formatNumber(value)} ₽`
}

export function formatDate(value?: string | null) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
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

export function companyLimitForm(company: SaasCompanyStats | undefined): LimitForm {
  return {
    companyId: company?.id || '',
    planCode: company?.limits?.planCode || 'pilot',
    maxVehicles: company?.limits?.maxVehicles ?? null,
    maxUsers: company?.limits?.maxUsers ?? null,
    maxStorageMb: company?.limits?.maxStorageMb ?? null,
    ocrEnabled: company?.limits?.ocrEnabled ?? true,
    accidentModuleEnabled: company?.limits?.accidentModuleEnabled ?? true,
    analyticsEnabled: company?.limits?.analyticsEnabled ?? true,
    pdfReportEnabled: company?.limits?.pdfReportEnabled ?? true,
    apiAccessEnabled: company?.limits?.apiAccessEnabled ?? false,
  }
}

export function filterCompanies(companies: SaasCompanyStats[], search: string, statusFilter: string) {
  const query = search.trim().toLowerCase()
  return companies.filter((company) => {
    const ownerText = (company.ownerUsers || []).map((owner) => `${owner.name} ${owner.email}`).join(' ')
    const matchesQuery = !query || `${company.name} ${company.slug} ${company.id} ${ownerText}`.toLowerCase().includes(query)
    const matchesStatus =
      statusFilter === 'all' ||
      company.status === statusFilter ||
      (statusFilter === 'no-owner' && !company.owners) ||
      (statusFilter === 'no-limits' && !company.limits?.planCode) ||
      (statusFilter === 'expired' && ['expired', 'suspended'].includes(company.subscription?.status || '')) ||
      (statusFilter === 'expiring' && ['expiring', 'grace'].includes(company.subscription?.status || ''))
    return matchesQuery && matchesStatus
  })
}
