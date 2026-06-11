'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import ManagerAccessDenied from '@/components/ManagerAccessDenied'
import api from '@/lib/api/client'
import { useCompanyOwnerAccess } from '@/lib/useCompanyOwnerAccess'
import type { UserRecord } from '@/lib/types'
import { Badge, EmptyState, NoticeCard, Skeleton, StatusButton } from '@/components/ui'

function getRoleLabel(role: string) {
  if (role === 'manager') return 'Менеджер'
  if (role === 'inspector') return 'Инспектор'
  if (role === 'owner') return 'Владелец'
  if (role === 'admin') return 'Администратор'
  return role
}

export default function AdminMfaListPage() {
  const ownerAccess = useCompanyOwnerAccess()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ownerAccess.allowed) return
    void loadUsers()
  }, [ownerAccess.allowed])

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

  if (ownerAccess.loading) {
    return (
      <div className="mx-auto grid min-h-screen max-w-5xl content-center gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!ownerAccess.allowed) {
    return (
      <Layout currentPage="users">
        <div className="p-6">
          <ManagerAccessDenied description="Управление MFA доступно только владельцу компании." />
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
          <StatusButton onClick={() => void loadUsers()} status={loading ? 'loading' : 'idle'} loadingLabel="Обновляем…">
            Обновить
          </StatusButton>
        </div>

        {error ? (
          <div className="mb-4"><NoticeCard title="Не удалось загрузить пользователей" tone="danger" compact>{error}</NoticeCard></div>
        ) : null}

        {loading ? (
          <div className="grid gap-3 py-4"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : (
          <div className="table-card">
            <div className="table-scroll">
              <table className="min-w-full divide-y divide-line">
                <thead className="table-header">
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
                      <EmptyState title="Пользователи не найдены" description="Добавьте пользователя, чтобы настроить для него MFA." />
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{user.name}</td>
                      <td className="px-6 py-4 text-slate-600">{user.email}</td>
                      <td className="px-6 py-4 text-slate-600">{getRoleLabel(user.role)}</td>
                      <td className="px-6 py-4">
                        <Badge tone={user.mfa_enabled ? 'success' : 'neutral'}>
                          {user.mfa_enabled ? 'Включено' : 'Выключено'}
                        </Badge>
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
          </div>
        )}

        
      </div>
    </Layout>
  )
}
