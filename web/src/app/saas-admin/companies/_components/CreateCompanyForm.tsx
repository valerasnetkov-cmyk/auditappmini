'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { CompanyForm } from '../_lib/companies'
import { StatusButton } from '@/components/ui'

type Props = {
  form: CompanyForm
  setForm: Dispatch<SetStateAction<CompanyForm>>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

export default function CreateCompanyForm({ form, setForm, onSubmit, saving }: Props) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-white p-4">
      <h2 className="text-base font-semibold">Создать компанию</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="id"
          value={form.id}
          onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))}
        />
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="slug"
          value={form.slug}
          onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
        />
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Название"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />
      </div>
      <StatusButton className="mt-4" status={saving ? 'loading' : 'idle'} loadingLabel="Создаём компанию…">
        Создать
      </StatusButton>
    </form>
  )
}
