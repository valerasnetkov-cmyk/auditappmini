'use client'

import type { FormEvent } from 'react'
import type { UserFormData } from '../_lib/users'

export function UserFormModal({
  title,
  mode,
  formData,
  formError,
  submitting,
  writeRestrictionMessage,
  onChange,
  onCancel,
  onSubmit,
}: {
  title: string
  mode: 'create' | 'edit'
  formData: UserFormData
  formError: string
  submitting: boolean
  writeRestrictionMessage: string
  onChange: (data: UserFormData) => void
  onCancel: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-900">{title}</h2>
        <form onSubmit={onSubmit}>
          <div className="space-y-4">
            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            ) : null}
            <input type="text" placeholder="Имя" value={formData.name}
              onChange={(event) => onChange({ ...formData, name: event.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2" required />
            <input type="email" placeholder="Email" value={formData.email}
              onChange={(event) => onChange({ ...formData, email: event.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2" required />
            <input type="password" placeholder={mode === 'create' ? 'Пароль' : 'Новый пароль, можно оставить пустым'}
              value={formData.password}
              onChange={(event) => onChange({ ...formData, password: event.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2" required={mode === 'create'} />
            <select value={formData.role}
              onChange={(event) => onChange({ ...formData, role: event.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="inspector">Инспектор</option>
              <option value="manager">Менеджер</option>
            </select>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2">Отмена</button>
            <button type="submit" disabled={submitting || Boolean(writeRestrictionMessage)} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
              {submitting ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
