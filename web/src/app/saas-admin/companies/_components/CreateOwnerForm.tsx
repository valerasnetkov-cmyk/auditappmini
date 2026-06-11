'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { SaasCompanyStats } from '@/lib/types'
import type { OwnerForm } from '../_lib/companies'
import { StatusButton } from '@/components/ui'

type Props = {
  form: OwnerForm
  setForm: Dispatch<SetStateAction<OwnerForm>>
  companies: SaasCompanyStats[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

export default function CreateOwnerForm({ form, setForm, companies, onSubmit, saving }: Props) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-white p-4">
      <h2 className="text-base font-semibold">Создать владельца компании</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <select
          className="rounded-lg border px-3 py-2"
          value={form.companyId}
          onChange={(event) => setForm((prev) => ({ ...prev, companyId: event.target.value }))}
          required
        >
          <option value="">Компания</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
        <input
          className="rounded-lg border px-3 py-2"
          type="email"
          placeholder="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Имя"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />
      </div>
      <StatusButton className="mt-4" status={saving ? 'loading' : 'idle'} loadingLabel="Создаём владельца…">
        Создать владельца
      </StatusButton>
    </form>
  )
}
