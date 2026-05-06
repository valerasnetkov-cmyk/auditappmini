"use client";

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
  const [mounted, setMounted] = useState(false)
  const [quickSearch, setQuickSearch] = useState('')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [userReady, setUserReady] = useState(false)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setUserReady(true)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const res = await api.getMe()
        if (!cancelled && res?.data) setCurrentUser(res.data)
      } catch {
        // ignore
      } finally {
        setUserReady(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // mark client mount to avoid hydration differences
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleQuickSearch = (e: any) => {
    e.preventDefault()
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
    { href: '/companies', label: 'Компании', icon: 'CO', key: 'companies', managerOnly: true },
    { href: '/profile', label: 'Профиль', icon: 'PR', key: 'profile' },
    { href: '/settings', label: 'Настройки', icon: 'ST', key: 'settings', managerOnly: true },
  ]

  const allMenuItems = menuItems
  const visibleMenuItems = allMenuItems

  return (
    <div className="app-shell flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-line bg-surface shadow-card">
        <div className="border-b border-line p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-foreground-inverse">AT</div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-foreground">Audit Tech</h1>
              <p className="text-xs text-foreground-muted">Контроль осмотров и дефектов</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleQuickSearch} className="border-b border-line-muted p-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">Q</span>
            <input
              type="text"
              placeholder="Поиск техники..."
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              className="w-full rounded-xl border border-line bg-muted-surface py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>

        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {visibleMenuItems.map((item) => {
              const isActive = currentPage === item.key
              const baseClass = 'flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all'
              const activeClass = isActive ? 'bg-primary text-foreground-inverse shadow-card' : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground'
              const linkClassName = `${baseClass} ${activeClass}`

              return (
                <li key={item.key}>
                  <Link href={item.href} className={linkClassName}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-[11px] font-semibold">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-line p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-status-danger transition-all hover:bg-red-50">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-[11px] font-semibold text-status-danger">EX</span>
            <span className="font-medium">Выйти</span>
          </button>
        </div>
      </aside>

      <main className="page flex-1 overflow-auto">{children}</main>
    </div>
  )
}
