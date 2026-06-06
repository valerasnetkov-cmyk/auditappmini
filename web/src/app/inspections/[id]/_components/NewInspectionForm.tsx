'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import api from '@/lib/api/client'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import { getTypeSelectedStyle, getTypeLabel, type StatusTone } from '../_lib/checklist'
import type { InspectionType, VehicleListItem } from '@/lib/types'

export default function NewInspectionForm({
  onCreate,
  statusMessage,
  statusTone,
}: {
  onCreate: (
    vehicleId: string,
    type: InspectionType,
    accidentData?: { occurredAt?: string; location?: string },
  ) => void
  statusMessage: string
  statusTone: StatusTone
}) {
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [selectedType, setSelectedType] = useState<InspectionType>('quick')
  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')
  const { usage, loading: usageLoading } = useCompanyUsage()
  const createRestriction = getCompanyOperationRestriction(usage, 'create')
  const createRestrictionMessage = usageLoading
    ? 'Проверяем статус тарифа компании. Создание осмотра станет доступно после проверки.'
    : createRestriction
      ? `${createRestriction.title}: ${createRestriction.message}`
      : ''
  const accidentEnabled = usage?.features.accidentModule.enabled !== false
  const accidentAvailable = accidentEnabled && !usageLoading
  const effectiveSelectedType = !accidentAvailable && selectedType === 'accident' ? 'quick' : selectedType
  const canCreate =
    !createRestrictionMessage &&
    Boolean(selectedVehicle) &&
    (effectiveSelectedType !== 'accident' ||
      (accidentAvailable && accidentOccurredAt.trim() && accidentLocation.trim()))

  useEffect(() => {
    void api.getVehiclesList().then((response) => setVehicles(response.data || []))
  }, [])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (createRestrictionMessage) return
    if (!selectedVehicle) return
    if (
      effectiveSelectedType === 'accident' &&
      (!accidentAvailable || !accidentOccurredAt.trim() || !accidentLocation.trim())
    ) {
      return
    }

    onCreate(selectedVehicle, effectiveSelectedType, {
      occurredAt: accidentOccurredAt,
      location: accidentLocation,
    })
  }

  const bannerStyles =
    statusTone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'

  return (
    <Layout currentPage="inspections">
      <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-xl font-bold text-slate-900">Новый осмотр</h1>

          {statusMessage ? (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${bannerStyles}`}>{statusMessage}</div>
          ) : null}

          <SubscriptionStatusBanner usage={usage} compact />

          {createRestrictionMessage ? (
            <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {createRestrictionMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Техника</label>
              <select
                value={selectedVehicle}
                onChange={(event) => setSelectedVehicle(event.target.value)}
                disabled={Boolean(createRestrictionMessage)}
                className="w-full rounded-lg border px-4 py-2"
                required
              >
                <option value="">Выберите технику</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.number} · {vehicle.name} {vehicle.region ? `(${vehicle.region})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Тип осмотра</label>
              <div className="grid grid-cols-3 gap-2">
                {(['quick', 'scheduled', 'accident'] as InspectionType[]).map((type) => {
                  const typeDisabled =
                    Boolean(createRestrictionMessage) || (type === 'accident' && !accidentAvailable)

                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={typeDisabled}
                      onClick={() => {
                        if (!typeDisabled) setSelectedType(type)
                      }}
                      className={`rounded-lg border px-4 py-3 text-center ${
                        effectiveSelectedType === type ? getTypeSelectedStyle(type) : 'border-slate-300'
                      } ${typeDisabled ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70' : ''}`}
                    >
                      {getTypeLabel(type)}
                    </button>
                  )
                })}
              </div>
              {!accidentEnabled ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Модуль ДТП отключён для текущего тарифа компании. Создание ДТП-осмотров недоступно.
                </p>
              ) : null}
            </div>

            {effectiveSelectedType === 'accident' ? (
              <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Время ДТП</label>
                  <input
                    type="datetime-local"
                    value={accidentOccurredAt}
                    onChange={(event) => setAccidentOccurredAt(event.target.value)}
                    disabled={Boolean(createRestrictionMessage)}
                    className="w-full rounded-lg border px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Место ДТП</label>
                  <input
                    type="text"
                    value={accidentLocation}
                    onChange={(event) => setAccidentLocation(event.target.value)}
                    disabled={Boolean(createRestrictionMessage)}
                    placeholder="Например: Южно-Сахалинск, ул. Ленина, 25"
                    className="w-full rounded-lg border px-4 py-2"
                    required
                  />
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canCreate}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Начать осмотр
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/inspections" className="text-sm text-blue-600 hover:underline">
              Отмена
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}
