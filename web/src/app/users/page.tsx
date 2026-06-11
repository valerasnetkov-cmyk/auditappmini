'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Layout from '@/components/Layout'
import ManagerAccessDenied from '@/components/ManagerAccessDenied'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import { NoticeCard, Skeleton, StatusButton } from '@/components/ui'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyOwnerAccess } from '@/lib/useCompanyOwnerAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import { UserFormModal } from './_components/UserFormModal'
import { UsersFilters } from './_components/UsersFilters'
import { UsersTable } from './_components/UsersTable'
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUserForm,
  useUsersFilter,
  useUsersList,
} from './_hooks/useUsers'

export default function UsersPage() {
  const ownerAccess = useCompanyOwnerAccess()
  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage(ownerAccess.allowed)
  const list = useUsersList()
  const form = useUserForm()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])

  const writeRestriction = getCompanyOperationRestriction(companyUsage, 'write')
  const writeRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Управление пользователями станет доступно после проверки.'
    : writeRestriction
      ? `${writeRestriction.title}: ${writeRestriction.message}`
      : ''

  const filteredUsers = useUsersFilter(list.users, list.sortConfig, search, roleFilter)

  useEffect(() => {
    if (!ownerAccess.allowed) return
    void list.loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAccess.allowed])

  const onToggleColumn = (column: string) => {
    setHiddenColumns((prev) => (prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column]))
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (companyUsageLoading) return form.actions.setFormError('Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
    if (writeRestriction) return form.actions.setFormError(`${writeRestriction.title}: ${writeRestriction.message}`)
    form.actions.setSubmitting(true)
    form.actions.setFormError('')
    try {
      const result = await createUser(form.state.formData)
      if (result.error) return form.actions.setFormError(result.error)
      form.actions.closeCreateModal()
      list.showStatus('success', 'Пользователь создан')
      await list.loadUsers()
    } catch {
      form.actions.setFormError('Не удалось создать пользователя')
    } finally {
      form.actions.setSubmitting(false)
    }
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.state.editingUser) return
    if (companyUsageLoading) return form.actions.setFormError('Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
    if (writeRestriction) return form.actions.setFormError(`${writeRestriction.title}: ${writeRestriction.message}`)
    form.actions.setSubmitting(true)
    form.actions.setFormError('')
    try {
      const result = await updateUser(form.state.editingUser.id, form.state.formData)
      if (result.error) return form.actions.setFormError(result.error)
      form.actions.closeEditModal()
      list.showStatus('success', 'Изменения сохранены')
      await list.loadUsers()
    } catch {
      form.actions.setFormError('Не удалось сохранить изменения')
    } finally {
      form.actions.setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (companyUsageLoading) return list.showStatus('error', 'Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
    if (writeRestriction) return list.showStatus('error', `${writeRestriction.title}: ${writeRestriction.message}`)
    if (!confirm('Удалить пользователя?')) return
    const result = await deleteUser(id)
    if (result.error) return list.showStatus('error', result.error)
    list.showStatus('success', 'Пользователь удалён')
    await list.loadUsers()
  }

  if (ownerAccess.loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6">
        <div className="w-full space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
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
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title text-2xl">Пользователи</h1>
            <p className="mt-1 text-sm text-foreground-muted">Сотрудники, роли и доступ к рабочему кабинету компании.</p>
          </div>
          <StatusButton onClick={() => form.actions.openCreateModal(writeRestrictionMessage)}
            disabled={Boolean(writeRestrictionMessage)}
            className="btn btn-primary disabled:opacity-50">
            + Добавить
          </StatusButton>
        </div>

        <SubscriptionStatusBanner usage={companyUsage} compact />

        {writeRestrictionMessage ? (
          <div className="mb-4">
            <NoticeCard title="Управление временно недоступно" tone="warning" compact>{writeRestrictionMessage}</NoticeCard>
          </div>
        ) : null}

        {list.statusMessage ? (
          <div className="mb-4">
            <NoticeCard
              title={list.statusTone === 'success' ? 'Готово' : 'Не удалось выполнить действие'}
              tone={list.statusTone === 'success' ? 'success' : 'danger'}
              compact
            >
              {list.statusMessage}
            </NoticeCard>
          </div>
        ) : null}

        <UsersFilters
          search={search} roleFilter={roleFilter} hiddenColumns={hiddenColumns}
          onSearchChange={setSearch} onRoleFilterChange={setRoleFilter} onToggleColumn={onToggleColumn}
        />

        <div className="mb-4 text-sm text-slate-500">Найдено: {filteredUsers.length}</div>

        {list.loading ? (
          <div className="table-card space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <UsersTable
            users={filteredUsers} sortConfig={list.sortConfig} hiddenColumns={hiddenColumns}
            writeRestrictionMessage={writeRestrictionMessage}
            onSort={list.handleSort}
            onEdit={(user) => form.actions.openEditModal(user, writeRestrictionMessage, (msg) => list.showStatus('error', msg))}
            onDelete={handleDelete}
          />
        )}

        {form.state.showCreateModal ? <UserFormModal title="Новый пользователь" mode="create"
          formData={form.state.formData} formError={form.state.formError} submitting={form.state.submitting}
          writeRestrictionMessage={writeRestrictionMessage} onChange={form.actions.setFormData}
          onCancel={form.actions.closeCreateModal} onSubmit={handleCreate} /> : null}

        {form.state.showEditModal ? <UserFormModal title="Редактировать пользователя" mode="edit"
          formData={form.state.formData} formError={form.state.formError} submitting={form.state.submitting}
          writeRestrictionMessage={writeRestrictionMessage} onChange={form.actions.setFormData}
          onCancel={form.actions.closeEditModal} onSubmit={handleUpdate} /> : null}
      </div>
    </Layout>
  )
}
