'use client'

import { useCallback, useMemo, useState } from 'react'
import api from '@/lib/api/client'
import type { UserRecord } from '@/lib/types'
import { EMPTY_FORM, type MessageTone, type SortConfig, type UserFormData } from '../_lib/users'

export function useUsersList() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<MessageTone>('success')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' })

  const showStatus = useCallback((tone: MessageTone, message: string) => {
    setStatusTone(tone)
    setStatusMessage(message)
  }, [])

  const loadUsers = useCallback(async () => {
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
  }, [showStatus])

  const handleSort = useCallback((key: SortConfig['key']) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  return { users, loading, statusMessage, statusTone, sortConfig, loadUsers, showStatus, handleSort, setUsers }
}

export function useUsersFilter(
  users: UserRecord[],
  sortConfig: SortConfig,
  search: string,
  roleFilter: string,
) {
  return useMemo(() => {
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
  }, [users, sortConfig, search, roleFilter])
}

export function useUserForm() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM)
    setEditingUser(null)
    setFormError('')
  }, [])

  const openCreateModal = useCallback((writeRestrictionMessage: string) => {
    resetForm()
    setFormError(writeRestrictionMessage)
    setShowCreateModal(true)
  }, [resetForm])

  const openEditModal = useCallback((user: UserRecord, writeRestrictionMessage: string, onError: (msg: string) => void) => {
    if (!canManageCheckSafe(user)) {
      onError('Системные роли не редактируются в панели пользователя')
      return
    }
    setEditingUser(user)
    setFormData({ email: user.email, password: '', name: user.name, role: user.role })
    setFormError(writeRestrictionMessage)
    setShowEditModal(true)
  }, [])

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false)
    resetForm()
  }, [resetForm])

  const closeEditModal = useCallback(() => {
    setShowEditModal(false)
    resetForm()
  }, [resetForm])

  return {
    state: { showCreateModal, showEditModal, editingUser, formData, formError, submitting },
    actions: { setFormData, setFormError, setSubmitting, openCreateModal, openEditModal, closeCreateModal, closeEditModal, resetForm },
  }
}

import { canManagePanelUser } from '../_lib/users'

function canManageCheckSafe(user: UserRecord) {
  return canManagePanelUser(user)
}

export function useCreateUser() {
  return useCallback(async (payload: UserFormData) => {
    return api.createUser({
      email: payload.email.trim(),
      password: payload.password,
      name: payload.name.trim(),
      role: payload.role,
    })
  }, [])
}

export function useUpdateUser() {
  return useCallback(async (id: string, payload: UserFormData) => {
    return api.updateUser(id, {
      email: payload.email.trim(),
      name: payload.name.trim(),
      role: payload.role,
      password: payload.password || undefined,
    })
  }, [])
}

export function useDeleteUser() {
  return useCallback(async (id: string) => {
    return api.deleteUser(id)
  }, [])
}
