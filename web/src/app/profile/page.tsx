'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { clearAuthToken, isResourceRole, requireAuthToken } from '@/lib/auth'
import type { AnalyticsOverview, AuthUser, DashboardStats, ServiceProfile } from '@/lib/types'

type ProfileStats = {
  totalVehicles: number
  totalInspections: number
  totalDefects: number
  weekInspections: number
  companies?: number
  monthlyRevenueRub?: number
  adminSummary?: boolean
}

function getRoleLabel(role: string) {
  if (role === 'manager') return 'Менеджер'
  if (role === 'inspector') return 'Инспектор'
  if (role === 'admin') return 'Администратор'
  if (role === 'resource_manager') return 'Сотрудник SaaS'
  return role
}

function getRoleStyle(role: string) {
  if (role === 'manager') return 'bg-purple-100 text-purple-800'
  if (role === 'admin') return 'bg-red-100 text-red-800'
  if (role === 'resource_manager') return 'bg-amber-100 text-amber-800'
  return 'bg-blue-100 text-blue-800'
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [analyticsDisabled, setAnalyticsDisabled] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '' })
  const [serviceProfile, setServiceProfile] = useState<ServiceProfile | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError('')
      setAnalyticsDisabled(false)

      const authResult = await api.getAuth()

      if (authResult.error === 'AUTH_REQUIRED') {
        setError('AUTH_REQUIRED')
        return
      }

      if (authResult.error) {
        setError(authResult.error)
        return
      }

      if (authResult.data) {
        setUser(authResult.data)
        setProfileForm({ name: authResult.data.name, email: authResult.data.email, password: '' })
      }

      if (isResourceRole(authResult.data?.role)) {
        const [resourceResult, serviceProfileResult] = await Promise.all([
          api.getSaasAdminStats(),
          api.getServiceProfile(),
        ])
        if (serviceProfileResult.data) setServiceProfile(serviceProfileResult.data)

        if (resourceResult.error) {
          setError(resourceResult.error)
          return
        }

        setStats({
          totalVehicles: resourceResult.data?.totals.vehicles || 0,
          totalInspections: resourceResult.data?.totals.inspections || 0,
          totalDefects: resourceResult.data?.totals.defects || 0,
          weekInspections: resourceResult.data?.totals.inspections30d || 0,
          companies: resourceResult.data?.totals.activeCompanies || 0,
          monthlyRevenueRub: resourceResult.data?.billing?.monthlyRevenueRub || 0,
          adminSummary: true,
        })
        return
      }

      const [usageResult, dashboardResult] = await Promise.all([
        api.getCompanyUsage(),
        api.getDashboardStats(),
      ])

      if ([usageResult, dashboardResult].some((result) => result.error === 'AUTH_REQUIRED')) {
        setError('AUTH_REQUIRED')
        return
      }

      const analyticsAllowed = usageResult.data?.features.analytics.enabled !== false
      setAnalyticsDisabled(!analyticsAllowed)

      if (analyticsAllowed) {
        const analyticsResult = await api.getAnalyticsOverview()

        if (analyticsResult.error) {
          setError(analyticsResult.error)
          return
        }

        const overview: AnalyticsOverview = analyticsResult.data || {}
        setStats({
          totalVehicles: overview.total?.vehicles || 0,
          totalInspections: overview.total?.inspections || 0,
          totalDefects: overview.total?.defects || 0,
          weekInspections: overview.week?.inspections || 0,
        })
      } else if (dashboardResult.data) {
        const dashboard: Partial<DashboardStats> = dashboardResult.data
        setStats({
          totalVehicles: dashboard.totalVehicles || 0,
          totalInspections: dashboard.totalInspections || 0,
          totalDefects: dashboard.vehiclesWithDefects || 0,
          weekInspections: dashboard.inspectionsToday || 0,
        })
      }
    } catch {
      setError('Не удалось загрузить профиль')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuthToken()
    window.location.reload()
  }

  const savePersonalProfile = async () => {
    const result = await api.updateResourceProfile(profileForm)
    if (result.data) {
      setUser(result.data)
      setProfileForm((current) => ({ ...current, password: '' }))
      setMessage('Личные данные обновлены')
    } else setError(result.error || 'Не удалось обновить профиль')
  }

  const saveServiceProfile = async () => {
    if (!serviceProfile) return
    const result = await api.updateServiceProfile(serviceProfile)
    if (result.data) {
      setServiceProfile(result.data)
      setMessage('Реквизиты сервиса обновлены')
    } else setError(result.error || 'Не удалось обновить реквизиты')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Layout currentPage="profile">
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Профиль</h1>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        <div className="max-w-2xl">
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                <span className="text-3xl font-bold text-blue-600">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold">{user?.name}</h2>
                <p className="text-gray-500">{user?.email}</p>
                <span className={`mt-2 inline-block rounded px-3 py-1 text-sm ${getRoleStyle(user?.role || '')}`}>
                  {getRoleLabel(user?.role || '')}
                </span>
              </div>
            </div>
          </div>

          {stats ? (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 font-semibold">{stats.adminSummary ? 'Сводка ресурса' : 'Статистика системы'}</h3>
              {analyticsDisabled && !stats.adminSummary ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Аналитика отключена тарифом компании. Ниже показана краткая оперативная сводка без расширенной аналитики.
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.adminSummary ? stats.companies : stats.totalVehicles}</div>
                  <div className="text-sm text-gray-600">{stats.adminSummary ? 'Компании' : 'Техника'}</div>
                </div>
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.adminSummary ? stats.totalVehicles : stats.totalInspections}</div>
                  <div className="text-sm text-gray-600">{stats.adminSummary ? 'Техника' : 'Осмотры'}</div>
                </div>
                <div className="rounded-lg bg-orange-50 p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.totalDefects}</div>
                  <div className="text-sm text-gray-600">{stats.adminSummary ? 'Дефекты' : analyticsDisabled ? 'Техника с дефектами' : 'Дефекты'}</div>
                </div>
                <div className="rounded-lg bg-purple-50 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.adminSummary ? `${Number(stats.monthlyRevenueRub || 0).toLocaleString('ru-RU')} ₽` : stats.weekInspections}</div>
                  <div className="text-sm text-gray-600">{stats.adminSummary ? 'MRR' : analyticsDisabled ? 'Сегодня' : 'За неделю'}</div>
                </div>
              </div>
            </div>
          ) : null}

          {user && isResourceRole(user.role) ? (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h3 className="font-semibold">Личные данные</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input className="rounded-lg border px-3 py-2" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Имя" />
                <input className="rounded-lg border px-3 py-2" type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} placeholder="Email" />
                <input className="rounded-lg border px-3 py-2 md:col-span-2" type="password" minLength={8} value={profileForm.password} onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })} placeholder="Новый пароль (необязательно)" />
              </div>
              <button type="button" onClick={() => void savePersonalProfile()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Сохранить профиль</button>
            </div>
          ) : null}

          {serviceProfile ? (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h3 className="font-semibold">Реквизиты SaaS-сервиса</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ['service_name', 'Название сервиса'], ['legal_name', 'Юридическое название'],
                  ['inn', 'ИНН'], ['kpp', 'КПП'], ['ogrn', 'ОГРН'], ['bank_name', 'Банк'],
                  ['bik', 'БИК'], ['bank_account', 'Расчётный счёт'],
                  ['correspondent_account', 'Корреспондентский счёт'], ['billing_email', 'Billing email'],
                  ['support_email', 'Email поддержки'], ['support_phone', 'Телефон поддержки'],
                  ['legal_address', 'Юридический адрес'], ['postal_address', 'Почтовый адрес'],
                ].map(([field, label]) => (
                  <input
                    key={field}
                    className="rounded-lg border px-3 py-2"
                    placeholder={label}
                    value={String(serviceProfile[field as keyof ServiceProfile] || '')}
                    onChange={(e) => setServiceProfile({ ...serviceProfile, [field]: e.target.value })}
                  />
                ))}
              </div>
              <button type="button" onClick={() => void saveServiceProfile()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Сохранить реквизиты</button>
            </div>
          ) : null}

          <button onClick={handleLogout} className="w-full rounded-lg border border-red-200 py-3 text-red-600 hover:bg-red-50">
            Выйти из системы
          </button>
        </div>
      </div>
    </Layout>
  )
}
