"use client";

import { useEffect, useState } from 'react'
import type { ComponentType, FormEvent, SVGProps } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BellAlertIcon,
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  RectangleGroupIcon,
  TagIcon,
  TruckIcon,
  UserCircleIcon,
  UserGroupIcon,
  ArrowLeftStartOnRectangleIcon,
} from '@heroicons/react/24/outline'
import api from '@/lib/api/client'
import { getAuthToken, hasAuthSession, isAdminRole, isCompanyOwnerRole, isManagerRole } from '@/lib/auth'

const PILOT_HREF = 'mailto:info@auditavto.ru?subject=Запустить пилот AuditAvto'

interface LayoutProps {
  children: React.ReactNode
  currentPage?: string
}

type MenuItem = {
  href: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  key: string
  adminOnly?: boolean
  managerOnly?: boolean
  ownerOnly?: boolean
}

function readStoredRole() {
  const token = getAuthToken()
  if (!token) return null

  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

export default function Layout({ children, currentPage }: LayoutProps) {
  const router = useRouter()
  const [quickSearch, setQuickSearch] = useState('')
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [accessMode, setAccessMode] = useState<string>('standard')

  useEffect(() => {
    if (!hasAuthSession()) return

    let cancelled = false

    const loadCurrentUser = async () => {
      const result = await api.getMe()
      if (!cancelled && result.data?.role) {
        setCurrentRole(result.data.role)
        setAccessMode(result.data.access_mode || 'standard')
      } else if (!cancelled) {
        setCurrentRole(readStoredRole())
      }
    }

    void loadCurrentUser()

    return () => {
      cancelled = true
    }
  }, [])

  const handleQuickSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!quickSearch.trim()) return
    router.push(`/vehicles?q=${encodeURIComponent(quickSearch.trim())}`)
  }

  const handleLogout = () => {
    void api.logout()
    router.replace('/login')
  }

  const menuItems: MenuItem[] = [
    { href: '/dashboard', label: 'Дашборд', icon: ChartBarSquareIcon, key: 'dashboard' },
    { href: '/vehicles', label: 'Техника', icon: TruckIcon, key: 'vehicles' },
    { href: '/inspections', label: 'Осмотры', icon: ClipboardDocumentCheckIcon, key: 'inspections' },
    { href: '/defects', label: 'Дефекты', icon: ExclamationTriangleIcon, key: 'defects' },
    { href: '/users', label: 'Пользователи', icon: UserGroupIcon, key: 'users', ownerOnly: true },
    { href: '/saas-admin', label: 'Обзор', icon: RectangleGroupIcon, key: 'saas-admin', adminOnly: true },
    { href: '/saas-admin/dashboard', label: 'Дашборд', icon: ChartBarSquareIcon, key: 'resource-dashboard', adminOnly: true },
    { href: '/saas-admin/companies', label: 'Компании', icon: BuildingOffice2Icon, key: 'resource-companies', adminOnly: true },
    { href: '/saas-admin/plans', label: 'Тарифы', icon: TagIcon, key: 'resource-plans', adminOnly: true },
    { href: '/saas-admin/payments', label: 'Платежи', icon: CreditCardIcon, key: 'resource-payments', adminOnly: true },
    { href: '/saas-admin/alerts', label: 'Уведомления', icon: BellAlertIcon, key: 'resource-alerts', adminOnly: true },
    { href: '/profile', label: 'Профиль', icon: UserCircleIcon, key: 'profile' },
    { href: '/settings', label: 'Настройки', icon: Cog6ToothIcon, key: 'settings', managerOnly: true },
  ]

  const resourceAdminContext = ['saas-admin', 'resource-dashboard', 'resource-companies', 'resource-plans', 'resource-payments', 'resource-alerts'].includes(currentPage || '') || isAdminRole(currentRole)
  const isDemo = accessMode === 'demo_readonly'

  const visibleMenuItems = menuItems.filter((item) => {
    if (resourceAdminContext) {
      return item.adminOnly || item.key === 'profile'
    }
    if (item.adminOnly) return isAdminRole(currentRole)
    if (isDemo && (item.key === 'settings' || item.key === 'profile')) return false
    if (item.ownerOnly) return isCompanyOwnerRole(currentRole)
    if (item.managerOnly) return isManagerRole(currentRole)
    return true
  })

  return (
    <div className="app-shell flex min-h-screen flex-col lg:flex-row">
      <aside className="flex h-auto w-full shrink-0 flex-col border-b border-line bg-surface shadow-card lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="border-b border-line p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              <Image className="brand-mark-light" src="/brand/auditavto-mark.svg" alt="" fill sizes="40px" />
              <Image className="brand-mark-dark" src="/brand/auditavto-mark-dark.svg" alt="" fill sizes="40px" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight text-foreground">AuditAvto</h1>
              <p className="text-xs text-foreground-muted">
                {resourceAdminContext ? 'Администрирование ресурса' : 'Контроль осмотров и дефектов'}
              </p>
            </div>
          </div>
        </div>

        {!resourceAdminContext ? (
          <form onSubmit={handleQuickSearch} className="border-b border-line-muted p-4">
            <div className="relative">
              <MagnifyingGlassIcon aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Поиск техники..."
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                className="w-full rounded-xl border border-line bg-muted-surface py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>
        ) : null}

        <nav className="flex-1 overflow-x-auto p-3">
          <ul className="flex gap-2 lg:block lg:space-y-1">
            {visibleMenuItems.map((item) => {
              const isActive = currentPage === item.key
              const Icon = item.icon
              const baseClass = 'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all'
              const activeClass = isActive ? 'bg-primary text-foreground-inverse shadow-card' : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground'
              const linkClassName = `${baseClass} ${activeClass}`

              return (
                <li key={item.key}>
                  <Link href={item.href} className={`${linkClassName} whitespace-nowrap`}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-white/15' : 'bg-muted-surface group-hover:bg-surface'}`}>
                      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-line p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-status-danger transition-all hover:bg-red-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
              <ArrowLeftStartOnRectangleIcon aria-hidden="true" className="h-[18px] w-[18px]" />
            </span>
            <span className="font-medium">Выйти</span>
          </button>
        </div>
      </aside>

      <main className="page min-w-0 flex-1">
        {isDemo ? (
          <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <strong>Демо-режим.</strong> Вы смотрите тестовую компанию. Изменение данных ограничено.
            </p>
            <a href={PILOT_HREF} className="font-semibold text-primary hover:text-primary-hover">
              Запросить пилот для своей компании
            </a>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  )
}
