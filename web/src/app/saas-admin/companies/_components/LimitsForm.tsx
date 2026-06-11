'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { SaasCompanyStats } from '@/lib/types'
import { companyLimitForm, numberOrNull } from '../_lib/companies'
import type { LimitForm } from '../_lib/companies'
import { StatusButton } from '@/components/ui'

type Plan = { code: string; name: string }

type Props = {
  form: LimitForm
  setForm: Dispatch<SetStateAction<LimitForm>>
  companies: SaasCompanyStats[]
  plans: Plan[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

export default function LimitsForm({ form, setForm, companies, plans, onSubmit, saving }: Props) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-white p-4">
      <h2 className="text-base font-semibold">Тариф, лимиты и модули компании</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <select
          className="rounded-lg border px-3 py-2"
          value={form.companyId}
          onChange={(event) => setForm(companyLimitForm(companies.find((company) => company.id === event.target.value)))}
          required
        >
          <option value="">Компания</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
        <select
          className="rounded-lg border px-3 py-2"
          value={form.planCode || ''}
          onChange={(event) => setForm((prev) => ({ ...prev, planCode: event.target.value }))}
        >
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>{plan.name}</option>
          ))}
        </select>
        <input
          className="rounded-lg border px-3 py-2"
          inputMode="numeric"
          placeholder="Лимит техники"
          value={form.maxVehicles ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, maxVehicles: numberOrNull(event.target.value) }))}
        />
        <input
          className="rounded-lg border px-3 py-2"
          inputMode="numeric"
          placeholder="Лимит пользователей"
          value={form.maxUsers ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, maxUsers: numberOrNull(event.target.value) }))}
        />
        <input
          className="rounded-lg border px-3 py-2"
          inputMode="numeric"
          placeholder="Хранилище, МБ"
          value={form.maxStorageMb ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, maxStorageMb: numberOrNull(event.target.value) }))}
        />
      </div>
      <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(form.ocrEnabled)}
            onChange={(event) => setForm((prev) => ({ ...prev, ocrEnabled: event.target.checked }))}
          />
          OCR
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(form.accidentModuleEnabled)}
            onChange={(event) => setForm((prev) => ({ ...prev, accidentModuleEnabled: event.target.checked }))}
          />
          ДТП-модуль
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(form.analyticsEnabled)}
            onChange={(event) => setForm((prev) => ({ ...prev, analyticsEnabled: event.target.checked }))}
          />
          Аналитика
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(form.apiAccessEnabled)}
            onChange={(event) => setForm((prev) => ({ ...prev, apiAccessEnabled: event.target.checked }))}
          />
          API-доступ
        </label>
      </div>
      <StatusButton
        className="mt-4"
        disabled={saving || !form.companyId}
        status={saving ? 'loading' : 'idle'}
        loadingLabel="Сохраняем лимиты…"
      >
        Сохранить лимиты
      </StatusButton>
    </form>
  )
}
