'use client'

import { FormEvent, useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { ResourceServiceUser } from '@/lib/types'

const permissionLabels: Record<string, string> = {
  'dashboard.view': 'Дашборд',
  'companies.view': 'Компании: просмотр',
  'companies.manage': 'Компании: управление',
  'company_billing_details.view': 'Реквизиты компаний: просмотр',
  'company_billing_details.manage': 'Реквизиты компаний: управление',
  'plans.view': 'Тарифы: просмотр',
  'plans.manage': 'Тарифы: управление',
  'payments.view': 'Платежи: просмотр',
  'payments.manage': 'Платежи: управление',
  'notifications.view': 'Уведомления: просмотр',
  'notifications.manage': 'Уведомления: управление',
  'templates.view': 'Шаблоны: просмотр',
  'templates.manage': 'Шаблоны: управление',
  'service_users.view': 'Команда: просмотр',
  'service_users.manage': 'Команда: управление',
  'service_profile.view': 'Профиль сервиса: просмотр',
  'service_profile.manage': 'Профиль сервиса: управление',
}

export default function ServiceUsersPage() {
  const [users, setUsers] = useState<ResourceServiceUser[]>([])
  const [presets, setPresets] = useState<Record<string, string[]>>({})
  const [permissions, setPermissions] = useState<string[]>([])
  const [form, setForm] = useState({ name: '', email: '', password: '', preset: 'support', permissions: [] as string[] })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Record<string, string[]>>({})

  const load = async () => {
    const result = await api.getResourceServiceUsers()
    if (result.data) {
      setUsers(result.data.users)
      setPresets(result.data.presets)
      setPermissions(result.data.permissions)
    } else setError(result.error || 'Не удалось загрузить команду')
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const choosePreset = (preset: string) => {
    setForm((current) => ({ ...current, preset, permissions: [...(presets[preset] || [])] }))
  }

  const togglePermission = (permission: string) => {
    setForm((current) => ({
      ...current,
      preset: 'custom',
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const result = await api.createResourceServiceUser(form)
    if (result.data) {
      setMessage('Сотрудник добавлен')
      setForm({ name: '', email: '', password: '', preset: 'support', permissions: presets.support || [] })
      await load()
    } else setError(result.error || 'Не удалось добавить сотрудника')
  }

  const toggleStatus = async (user: ResourceServiceUser) => {
    const result = await api.updateResourceServiceUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' })
    if (result.data) await load()
    else setError(result.error || 'Не удалось изменить статус')
  }

  const toggleUserPermission = (user: ResourceServiceUser, permission: string) => {
    setEditing((current) => {
      const selected = current[user.id] || user.permissions
      return {
        ...current,
        [user.id]: selected.includes(permission)
          ? selected.filter((item) => item !== permission)
          : [...selected, permission],
      }
    })
  }

  const savePermissions = async (user: ResourceServiceUser) => {
    const result = await api.updateResourceServiceUser(user.id, {
      preset: 'custom',
      permissions: editing[user.id] || user.permissions,
    })
    if (result.data) {
      setEditing((current) => {
        const next = { ...current }
        delete next[user.id]
        return next
      })
      await load()
    } else setError(result.error || 'Не удалось сохранить права')
  }

  return (
    <Layout currentPage="resource-service-users">
      <div className="resource-admin-page mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Resource team</p>
          <h1 className="mt-2 text-3xl font-semibold">Команда сервиса</h1>
          <p className="mt-3 text-sm text-gray-600">Сотрудники SaaS работают вне tenant-контуров и получают только явно назначенные права.</p>
        </div>
        {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

        <form onSubmit={submit} className="rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Добавить сотрудника</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input className="rounded-lg border px-3 py-2" placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="rounded-lg border px-3 py-2" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="rounded-lg border px-3 py-2" type="password" minLength={8} placeholder="Временный пароль" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <select className="rounded-lg border px-3 py-2" value={form.preset} onChange={(e) => choosePreset(e.target.value)}>
              {Object.keys(presets).map((preset) => <option key={preset} value={preset}>{preset}</option>)}
            </select>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {permissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />
                {permissionLabels[permission] || permission}
              </label>
            ))}
          </div>
          <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Добавить сотрудника</button>
        </form>

        <section className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Сотрудник</th><th className="px-4 py-3">Роль</th><th className="px-4 py-3">Права</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Действие</th></tr></thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3"><div className="font-medium">{user.name}</div><div className="text-xs text-gray-500">{user.email}</div></td>
                  <td className="px-4 py-3">{user.role === 'admin' ? 'Главный администратор' : user.preset}</td>
                  <td className="max-w-xl px-4 py-3 text-xs text-gray-600">
                    {user.role === 'admin' ? 'Полный доступ' : editing[user.id] ? (
                      <div className="grid gap-1">
                        {permissions.map((permission) => (
                          <label key={permission} className="flex items-center gap-2">
                            <input type="checkbox" checked={editing[user.id].includes(permission)} onChange={() => toggleUserPermission(user, permission)} />
                            {permissionLabels[permission] || permission}
                          </label>
                        ))}
                      </div>
                    ) : user.permissions.map((item) => permissionLabels[item] || item).join(', ')}
                  </td>
                  <td className="px-4 py-3">{user.status}</td>
                  <td className="px-4 py-3">
                    {user.role === 'resource_manager' ? (
                      <div className="flex flex-col gap-2">
                        <button type="button" className="text-left text-blue-700" onClick={() => setEditing((current) => ({ ...current, [user.id]: [...user.permissions] }))}>Изменить права</button>
                        {editing[user.id] ? <button type="button" className="text-left text-emerald-700" onClick={() => void savePermissions(user)}>Сохранить права</button> : null}
                        <button type="button" className="text-left text-red-700" onClick={() => void toggleStatus(user)}>{user.status === 'active' ? 'Отключить' : 'Включить'}</button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Layout>
  )
}
