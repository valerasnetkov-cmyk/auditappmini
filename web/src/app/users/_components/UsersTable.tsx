'use client'

import type { UserRecord } from '@/lib/types'
import { canManagePanelUser, getRoleBadgeClass, getRoleLabel, type SortConfig, type SortableUserKey } from '../_lib/users'

function renderSortIcon(sortConfig: SortConfig, key: SortableUserKey) {
  if (sortConfig.key !== key) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1 text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
}

function SortableHeader({
  columnKey,
  label,
  sortConfig,
  onSort,
}: {
  columnKey: SortableUserKey
  label: string
  sortConfig: SortConfig
  onSort: (key: SortableUserKey) => void
}) {
  return (
    <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold text-slate-600" onClick={() => onSort(columnKey)}>
      {label} {renderSortIcon(sortConfig, columnKey)}
    </th>
  )
}

export function UsersTable({
  users,
  sortConfig,
  hiddenColumns,
  writeRestrictionMessage,
  onSort,
  onEdit,
  onDelete,
}: {
  users: UserRecord[]
  sortConfig: SortConfig
  hiddenColumns: string[]
  writeRestrictionMessage: string
  onSort: (key: SortableUserKey) => void
  onEdit: (user: UserRecord) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="min-w-full divide-y divide-line">
          <thead className="table-header">
            <tr>
              {!hiddenColumns.includes('name') ? <SortableHeader columnKey="name" label="Имя" sortConfig={sortConfig} onSort={onSort} /> : null}
              {!hiddenColumns.includes('email') ? <SortableHeader columnKey="email" label="Email" sortConfig={sortConfig} onSort={onSort} /> : null}
              {!hiddenColumns.includes('role') ? <SortableHeader columnKey="role" label="Роль" sortConfig={sortConfig} onSort={onSort} /> : null}
              {!hiddenColumns.includes('created_at') ? <SortableHeader columnKey="created_at" label="Дата создания" sortConfig={sortConfig} onSort={onSort} /> : null}
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Пользователи не найдены</td>
              </tr>
            ) : (
              users.map((user) => (
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
                        <button onClick={() => onEdit(user)} disabled={Boolean(writeRestrictionMessage)} className="mr-3 text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                          Изменить
                        </button>
                        <button onClick={() => onDelete(user.id)} disabled={Boolean(writeRestrictionMessage)} className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
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
  )
}
