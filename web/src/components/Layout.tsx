'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import api from '@/lib/api/client'
import { clearAuthToken, getAuthToken, isManagerRole } from '@/lib/auth'
import type { AuthUser } from '@/lib/types'

interface LayoutProps {
  children: React.ReactNode
  currentPage?: string
}

type MenuItem = {
  href: string
  label: string
  icon: string
  key: string
  managerOnly?: boolean
}

export default function Layout({ children, currentPage }: LayoutProps) {
  const router = useRouter()
  const [quickSearch, setQuickSearch] = useState('')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (!getAuthToken()) return

    let cancelled = false

    const loadCurrentUser = async () => {
      const result = await api.getMe()
      if (!cancelled && result.data) {
        setCurrentUser(result.data)
      }
    }

    void loadCurrentUser()

    return () => {
      cancelled = true
    }
  }, [])

  const handleQuickSearch = (event: React.FormEvent) => {
    event.preventDefault()
    if (!quickSearch.trim()) return
    router.push(`/vehicles?q=${encodeURIComponent(quickSearch.trim())}`)
  }

  const handleLogout = () => {
    clearAuthToken()
    window.location.reload()
  }

  const menuItems: MenuItem[] = [
    { href: '/', label: 'Дашборд', icon: 'AN', key: 'dashboard' },
    { href: '/vehicles', label: 'Техника', icon: 'VH', key: 'vehicles' },
    { href: '/inspections', label: 'Осмотры', icon: 'IN', key: 'inspections' },
    { href: '/defects', label: 'Дефекты', icon: 'DF', key: 'defects' },
    { href: '/users', label: 'Пользователи', icon: 'US', key: 'users', managerOnly: true },
    { href: '/profile', label: 'Профиль', icon: 'PR', key: 'profile' },
    { href: '/settings', label: 'Настройки', icon: 'ST', key: 'settings', managerOnly: true },
  ]

  const visibleMenuItems = menuItems.filter((item) => !item.managerOnly || isManagerRole(currentUser?.role))

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
              AT
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">Audit Tech</h1>
              <p className="text-xs text-slate-500">Контроль осмотров и дефектов</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleQuickSearch} className="border-b border-slate-100 p-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">Q</span>
            <input
              type="text"
              placeholder="Поиск техники..."
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {visibleMenuItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all ${
                    currentPage === item.key
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-[11px] font-semibold">
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-red-600 transition-all hover:bg-red-50"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-[11px] font-semibold text-red-700">
              EX
            </span>
            <span className="font-medium">Выйти</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
