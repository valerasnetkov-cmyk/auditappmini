'use client'

import { Dispatch, FormEvent, SetStateAction } from 'react'
import type { CompanyEditForm } from '../_lib/companyDetail'

type Props = {
  form: CompanyEditForm
  setForm: Dispatch<SetStateAction<CompanyEditForm | null>>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

export default function SupportNotesPanel({ form, setForm, onSubmit, saving }: Props) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Сопровождение</h2>
          <p className="mt-1 text-xs text-gray-500">Внутренние заметки resource-admin без обращения к tenant-данным.</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Сохранить
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <label className="block text-xs font-medium text-gray-600">
          Заметки
          <textarea
            className="mt-1 min-h-32 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
            value={form.support_notes}
            onChange={(event) => setForm((prev) => prev ? { ...prev, support_notes: event.target.value } : prev)}
            placeholder="Контекст сопровождения, риски, договоренности"
          />
        </label>
        <div className="grid gap-3">
          <label className="block text-xs font-medium text-gray-600">
            Следующий шаг
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
              value={form.support_next_step}
              onChange={(event) => setForm((prev) => prev ? { ...prev, support_next_step: event.target.value } : prev)}
              placeholder="Что нужно сделать дальше"
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Последний контакт
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
              value={form.support_last_contact_at}
              onChange={(event) => setForm((prev) => prev ? { ...prev, support_last_contact_at: event.target.value } : prev)}
            />
          </label>
        </div>
      </div>
    </form>
  )
}
