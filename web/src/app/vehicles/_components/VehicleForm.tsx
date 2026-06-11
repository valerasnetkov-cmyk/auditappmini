'use client'

import type { FormEvent } from 'react'
import type { RegionRecord } from '@/lib/types'
import { NoticeCard, StatusButton } from '@/components/ui'
import { normalizeVehicleNumber, VEHICLE_NUMBER_HELP } from '@/lib/vehicleNumber'
import type { VehicleFormData } from '../_lib/vehicles'

export function VehicleForm({
  mode,
  regions,
  formData,
  formError,
  restrictionMessage = '',
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit'
  regions: RegionRecord[]
  formData: VehicleFormData
  formError: string
  restrictionMessage?: string
  saving: boolean
  onChange: (value: VehicleFormData) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        {formError ? <NoticeCard title="Проверьте данные" tone="danger" compact>{formError}</NoticeCard> : null}
        {restrictionMessage && restrictionMessage !== formError ? (
          <NoticeCard title="Изменения временно недоступны" tone="warning" compact>{restrictionMessage}</NoticeCard>
        ) : null}

        <div>
          <label className="label">Госномер</label>
          <input
            type="text"
            placeholder="Например A123BC77"
            value={formData.number}
            onChange={(event) => onChange({ ...formData, number: normalizeVehicleNumber(event.target.value) })}
            autoCapitalize="characters"
            inputMode="text"
            maxLength={9}
            spellCheck={false}
            className="input"
            required
          />
          <p className="mt-1 text-xs text-foreground-muted">{VEHICLE_NUMBER_HELP}</p>
        </div>

        <div>
          <label className="label">Название</label>
          <input
            type="text"
            placeholder="Название техники"
            value={formData.name}
            onChange={(event) => onChange({ ...formData, name: event.target.value })}
            className="input"
            required
          />
        </div>

        <div>
          <label className="label">Регион</label>
          <select value={formData.region} onChange={(event) => onChange({ ...formData, region: event.target.value })} className="select">
            <option value="">Не выбран</option>
            {regions.map((region) => (
              <option key={region.id} value={region.name}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Статус</label>
          <select value={formData.status} onChange={(event) => onChange({ ...formData, status: event.target.value })} className="select">
            <option value="active">В работе</option>
            <option value="repair">Ремонт</option>
            {mode === 'edit' ? <option value="archived">Архив</option> : null}
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Отмена
        </button>
        <StatusButton
          type="submit"
          status={saving ? 'loading' : 'idle'}
          loadingLabel="Сохраняем…"
          disabled={Boolean(restrictionMessage)}
          className="btn btn-primary disabled:opacity-50"
        >
          {mode === 'create' ? 'Добавить' : 'Сохранить'}
        </StatusButton>
      </div>
    </form>
  )
}
