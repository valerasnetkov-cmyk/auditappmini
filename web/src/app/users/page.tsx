'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import ManagerAccessDenied from '@/components/ManagerAccessDenied'
import api from '@/lib/api/client'
import { useCompanyOwnerAccess } from '@/lib/useCompanyOwnerAccess'
import type { UserRecord, UserRole } from '@/lib/types'

type UserFormData = {
  email: string
  password: string
  name: string
  role: UserRole
}

type SortableUserKey = 'name' | 'email' | 'role' | 'created_at'

type SortConfig = {
  key: SortableUserKey
  direction: 'asc' | 'desc'
}

type MessageTone = 'success' | 'error'

const EMPTY_FORM: UserFormData = {
  email: '',
  password: '',
  name: '',
  role: 'inspector',
}

const PANEL_MANAGED_ROLES = new Set(['inspector', 'manager'])

function getRoleLabel(role: string) {
  if (role === 'manager') return 'Менеджер'
  if (role === 'owner') return 'Владелец'
  if (role === 'admin') return 'Администратор'
  return 'Инспектор'
}

function getRoleBadgeClass(role: string) {
  if (role === 'owner' || role === 'admin') {
    return 'bg-amber-100 text-amber-800'
  }

  if (role === 'manager') {
    return 'bg-purple-100 text-purple-700'
  }

  return 'bg-blue-100 text-blue-700'
}

function canManagePanelUser(user: UserRecord) {
  return PANEL_MANAGED_ROLES.has(user.role)
}

export default function UsersPage() {
  const ownerAccess = useCompanyOwnerAccess()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<MessageTone>('success')
  const [formError, setFormError] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'name',
    direction: 'asc',
  })

  useEffect(() => {
    if (!ownerAccess.allowed) return
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAccess.allowed])

  const showStatus = (tone: MessageTone, message: string) => {
    setStatusTone(tone)
    setStatusMessage(message)
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const result = await api.getUsers()
      if (result.error) {
        showStatus('error', result.error)
        return
      }

      setUsers(result.data || [])
      setStatusMessage('')
    } catch {
      showStatus('error', 'Не удалось загрузить список пользователей')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      if (search && !`${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())) return false
      if (roleFilter && user.role !== roleFilter) return false
      return true
    })

    return filtered.sort((a, b) => {
      let aValue: string | number = a[sortConfig.key] ?? ''
      let bValue: string | number = b[sortConfig.key] ?? ''

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = String(bValue).toLowerCase()
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [users, search, roleFilter, sortConfig])

  const columns: Array<{ key: SortableUserKey; label: string }> = [
    { key: 'name', label: 'Имя' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Роль' },
    { key: 'created_at', label: 'Дата создания' },
  ]

  const handleSort = (key: SortableUserKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleColumn = (column: string) => {
    setHiddenColumns((prev) => (prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column]))
  }

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingUser(null)
    setFormError('')
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = (user: UserRecord) => {
    if (!canManagePanelUser(user)) {
      showStatus('error', 'Системные роли не редактируются в панели пользователя')
      return
    }

    setEditingUser(user)
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
    })
    setFormError('')
    setShowEditModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    resetForm()
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    resetForm()
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setStatusMessage('')
    setFormError('')

    try {
      const result = await api.createUser({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.name.trim(),
        role: formData.role,
      })

      if (result.error) {
        setFormError(result.error)
        return
      }

      closeCreateModal()
      showStatus('success', 'Пользователь создан')
      await loadUsers()
    } catch {
      setFormError('Не удалось создать пользователя')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingUser) return

    setSubmitting(true)
    setStatusMessage('')
    setFormError('')

    try {
      const result = await api.updateUser(editingUser.id, {
        email: formData.email.trim(),
        name: formData.name.trim(),
        role: formData.role,
        password: formData.password || undefined,
      })

      if (result.error) {
        setFormError(result.error)
        return
      }

      closeEditModal()
      showStatus('success', 'Изменения сохранены')
      await loadUsers()
    } catch {
      setFormError('Не удалось сохранить изменения')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить пользователя?')) return

    setStatusMessage('')
    const result = await api.deleteUser(id)
    if (result.error) {
      showStatus('error', result.error)
      return
    }

    showStatus('success', 'Пользователь удалён')
    await loadUsers()
  }

  const renderSortIcon = (key: SortableUserKey) => {
    if (sortConfig.key !== key) return <span className="ml-1 text-slate-300">↕</span>
    return <span className="ml-1 text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  const renderForm = (mode: 'create' | 'edit') => (
    <form onSubmit={mode === 'create' ? handleCreate : handleUpdate}>
      <div className="space-y-4">
        {formError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <input
          type="text"
          placeholder="Имя"
          value={formData.name}
          onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(event) => setFormData({ ...formData, email: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          required
        />

        <input
          type="password"
          placeholder={mode === 'create' ? 'Пароль' : 'Новый пароль, можно оставить пустым'}
          value={formData.password}
          onChange={(event) => setFormData({ ...formData, password: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          required={mode === 'create'}
        />

        <select
          value={formData.role}
          onChange={(event) => setFormData({ ...formData, role: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          <option value="inspector">Инспектор</option>
          <option value="manager">Менеджер</option>
        </select>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={mode === 'create' ? closeCreateModal : closeEditModal}
          className="rounded-lg border border-slate-200 px-4 py-2"
        >
          Отмена
        </button>
        <button type="submit" disabled={submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {submitting ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
        </button>
      </div>
    </form>
  )

  if (ownerAccess.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!ownerAccess.allowed) {
    return (
      <Layout currentPage="users">
        <div className="p-6">
          <ManagerAccessDenied description="Управление пользователями доступно только владельцу компании." />
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="users">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Пользователи</h1>
          <button onClick={openCreateModal} className="rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700">
            + Добавить
          </button>
        </div>

        {statusMessage ? (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${statusTone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {statusMessage}
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              placeholder="Поиск по имени или email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-4 py-2.5"
            />

            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5">
              <option value="">Все роли</option>
              <option value="inspector">Инспектор</option>
              <option value="manager">Менеджер</option>
              <option value="owner">Владелец</option>
              <option value="admin">Администратор</option>
            </select>

            <div className="relative">
              <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="rounded-xl border border-slate-200 px-4 py-2.5 hover:bg-slate-50">
                Столбцы
              </button>
              {showColumnMenu ? (
                <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-lg">
                  {columns.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center px-4 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.includes(column.key)}
                        onChange={() => toggleColumn(column.key)}
                        className="mr-2"
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">Найдено: {filteredUsers.length}</div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="table-card">
            <div className="table-scroll">
              <table className="min-w-full divide-y divide-line">
                <thead className="table-header">
                  <tr>
                    {!hiddenColumns.includes('name') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold text-slate-600" onClick={() => handleSort('name')}>
                        Имя {renderSortIcon('name')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('email') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold text-slate-600" onClick={() => handleSort('email')}>
                        Email {renderSortIcon('email')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('role') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold text-slate-600" onClick={() => handleSort('role')}>
                        Роль {renderSortIcon('role')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('created_at') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold text-slate-600" onClick={() => handleSort('created_at')}>
                        Дата создания {renderSortIcon('created_at')}
                      </th>
                    ) : null}
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        {!hiddenColumns.includes('name') ? <td className="px-6 py-4 font-medium text-slate-900">{user.name}</td> : null}
                        {!hiddenColumns.includes('email') ? <td className="px-6 py-4 text-slate-600">{user.email}</td> : null}
                        {!hiddenColumns.includes('role') ? (
                          <td className="px-6 py-4">
                            <span className={`rounded px-2 py-1 text-xs ${getRoleBadgeClass(user.role)}`}>{getRoleLabel(user.role)}</span>
                          </td>
                        ) : null}
                        {!hiddenColumns.includes('created_at') ? (
                          <td className="px-6 py-4 text-sm text-slate-500">{new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                        ) : null}
                        <td className="px-6 py-4 text-right">
                          {canManagePanelUser(user) ? (
                            <>
                              <button onClick={() => openEditModal(user)} className="mr-3 text-blue-600 hover:underline">
                                Изменить
                              </button>
                              <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:underline">
                                Удалить
                              </button>
                            </>
                          ) : (
                            <span className="text-sm text-slate-400">Системная роль</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showCreateModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Новый пользователь</h2>
              {renderForm('create')}
            </div>
          </div>
        ) : null}

        {showEditModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Редактировать пользователя</h2>
              {renderForm('edit')}
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
