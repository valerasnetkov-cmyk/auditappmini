'use client'

import { useState } from 'react'
import { USER_COLUMNS } from '../_lib/users'

export function UsersFilters({
  search,
  roleFilter,
  hiddenColumns,
  onSearchChange,
  onRoleFilterChange,
  onToggleColumn,
}: {
  search: string
  roleFilter: string
  hiddenColumns: string[]
  onSearchChange: (value: string) => void
  onRoleFilterChange: (value: string) => void
  onToggleColumn: (column: string) => void
}) {
  const [showColumnMenu, setShowColumnMenu] = useState(false)

  return (
    <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-4 py-2.5"
        />

        <select value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5">
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
              {USER_COLUMNS.map((column) => (
                <label key={column.key} className="flex cursor-pointer items-center px-4 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.includes(column.key)}
                    onChange={() => onToggleColumn(column.key)}
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
  )
}
