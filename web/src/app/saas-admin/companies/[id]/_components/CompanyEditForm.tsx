'use client'

import { Dispatch, FormEvent, SetStateAction } from 'react'
import type { CompanyEditForm } from '../_lib/companyDetail'

type Props = {
  form: CompanyEditForm
  setForm: Dispatch<SetStateAction<CompanyEditForm | null>>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

export default function CompanyEditForm({ form, setForm, onSubmit, saving }: Props) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">Основные данные</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.name}
          onChange={(event) => setForm((prev) => prev ? { ...prev, name: event.target.value } : prev)}
          placeholder="Название"
          required
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.slug}
          onChange={(event) => setForm((prev) => prev ? { ...prev, slug: event.target.value } : prev)}
          placeholder="Slug"
          required
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.region_code}
          onChange={(event) => setForm((prev) => prev ? { ...prev, region_code: event.target.value } : prev)}
          placeholder="Регион"
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.data_residency}
          onChange={(event) => setForm((prev) => prev ? { ...prev, data_residency: event.target.value } : prev)}
          placeholder="Data residency"
        />
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.status}
          onChange={(event) => setForm((prev) => prev ? { ...prev, status: event.target.value === 'inactive' ? 'inactive' : 'active' } : prev)}
        >
          <option value="active">Активна</option>
          <option value="inactive">Отключена</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Сохранить компанию
      </button>
    </form>
  )
}
