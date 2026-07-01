'use client'

import { FormEvent } from 'react'
import type { SaasPlan } from '@/lib/types'
import { numberOrNull } from '../_lib/companyDetail'
import type { LimitForm } from '../_lib/companyDetail'

type Props = {
  form: LimitForm
  setForm: (updater: (prev: LimitForm) => LimitForm) => void
  plans: SaasPlan[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

export default function LimitsForm({ form, setForm, plans, onSubmit, saving }: Props) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">Тариф, лимиты и модули</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.planCode || ''}
          onChange={(event) => {
            const plan = plans.find((item) => item.code === event.target.value)
            setForm((prev) => ({
              ...prev,
              planCode: event.target.value,
              maxVehicles: plan?.limits.maxVehicles ?? null,
              maxUsers: plan?.limits.maxUsers ?? null,
              maxInspectionsPerMonth: plan?.limits.maxInspectionsPerMonth ?? null,
              maxStorageMb: plan?.limits.maxStorageMb ?? null,
              ocrMonthlyLimit: plan?.limits.ocrMonthlyLimit ?? null,
              ocrEnabled: plan?.features.ocrEnabled ?? false,
              accidentModuleEnabled: plan?.features.accidentModuleEnabled ?? false,
              analyticsEnabled: plan?.features.analyticsEnabled ?? false,
              pdfReportEnabled: plan?.features.pdfReportEnabled ?? false,
              apiAccessEnabled: plan?.features.apiAccessEnabled ?? false,
            }))
          }}
        >
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>{plan.name}</option>
          ))}
        </select>
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          inputMode="numeric"
          placeholder="Лимит техники"
          value={form.maxVehicles ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, maxVehicles: numberOrNull(event.target.value) }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          inputMode="numeric"
          placeholder="Лимит пользователей"
          value={form.maxUsers ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, maxUsers: numberOrNull(event.target.value) }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          inputMode="numeric"
          placeholder="Осмотры в месяц"
          value={form.maxInspectionsPerMonth ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, maxInspectionsPerMonth: numberOrNull(event.target.value) }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          inputMode="numeric"
          placeholder="Хранилище, МБ"
          value={form.maxStorageMb ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, maxStorageMb: numberOrNull(event.target.value) }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          inputMode="numeric"
          placeholder="OCR в месяц"
          value={form.ocrMonthlyLimit ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, ocrMonthlyLimit: numberOrNull(event.target.value) }))}
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
            checked={Boolean(form.pdfReportEnabled)}
            onChange={(event) => setForm((prev) => ({ ...prev, pdfReportEnabled: event.target.checked }))}
          />
          PDF-отчёты
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
      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Сохранить тариф и лимиты
      </button>
    </form>
  )
}
