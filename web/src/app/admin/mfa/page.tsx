'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/app/contexts/ToastContext'
import Link from 'next/link'
import Layout from '@/components/Layout'
import ManagerAccessDenied from '@/components/ManagerAccessDenied'
import api from '@/lib/api/client'
import { useManagerAccess } from '@/lib/useManagerAccess'
import type { UserRecord } from '@/lib/types'

function getRoleLabel(role: string) {
  if (role === 'manager') return 'Менеджер'
  if (role === 'inspector') return 'Инспектор'
  return role
}

export default function AdminMfaListPage() {
  const managerAccess = useManagerAccess()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  useEffect(() => {
    if (!managerAccess.allowed) return
    void loadUsers()
  }, [managerAccess.allowed])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')

      const result = await api.getUsers()
      if (result.error) {
        setError(result.error)
        return
      }

      setUsers(result.data || [])
    } catch {
      setError('Не удалось загрузить список пользователей')
    } finally {
      setLoading(false)
    }
  }

  const seedDemoData = async () => {
    try {
      await fetch('http://localhost:3001/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      await loadUsers()
      showToast('Demo данные посеяны')
    } catch {
      showToast('Не удалось Seed Demo Data')
    }
  }

  if (managerAccess.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!managerAccess.allowed) {
    return (
      <Layout currentPage="users">
        <div className="p-6">
          <ManagerAccessDenied description="Управление MFA доступно только менеджеру." />
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="users">
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Управление MFA</h1>
            <p className="mt-1 text-sm text-slate-500">Подключение двухфакторной аутентификации для пользователей системы.</p>
          </div>
      <button onClick={() => void loadUsers()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Обновить
      </button>
      <button onClick={seedDemoData} className="ml-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
        Seed Demo Data
      </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Имя</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Роль</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">MFA</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Пользователи не найдены
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{user.name}</td>
                      <td className="px-6 py-4 text-slate-600">{user.email}</td>
                      <td className="px-6 py-4 text-slate-600">{getRoleLabel(user.role)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.mfa_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {user.mfa_enabled ? 'Включено' : 'Выключено'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/mfa/${user.id}`} className="text-blue-600 hover:underline">
                          Настроить MFA
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        
      </div>
    </Layout>
  )
}
