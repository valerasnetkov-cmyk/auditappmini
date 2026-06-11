'use client'

import type { FormEvent } from 'react'
import { NoticeCard, StatusButton } from '@/components/ui'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>
        <form onSubmit={onSubmit}>
          <div className="space-y-4">
            {formError ? (
              <NoticeCard title="Проверьте данные" tone="danger" compact>{formError}</NoticeCard>
            ) : null}
            <input type="text" placeholder="Имя" value={formData.name}
              onChange={(event) => onChange({ ...formData, name: event.target.value })}
              className="input" required />
            <input type="email" placeholder="Email" value={formData.email}
              onChange={(event) => onChange({ ...formData, email: event.target.value })}
              className="input" required />
            <input type="password" placeholder={mode === 'create' ? 'Пароль' : 'Новый пароль, можно оставить пустым'}
              value={formData.password}
              onChange={(event) => onChange({ ...formData, password: event.target.value })}
              className="input" required={mode === 'create'} />
            <select value={formData.role}
              onChange={(event) => onChange({ ...formData, role: event.target.value })}
              className="select">
              <option value="inspector">Инспектор</option>
              <option value="manager">Менеджер</option>
            </select>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
            <StatusButton
              type="submit"
              status={submitting ? 'loading' : 'idle'}
              loadingLabel="Сохраняем…"
              disabled={Boolean(writeRestrictionMessage)}
              className="btn btn-primary disabled:opacity-50"
            >
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </StatusButton>
          </div>
        </form>
      </div>
    </div>
  )
}
