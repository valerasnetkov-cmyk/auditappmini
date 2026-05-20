"use client";

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VehicleRecord } from '@/lib/types'
import { useCompanyUsage } from '@/lib/useCompanyUsage'

type InspectionType = 'quick' | 'scheduled' | 'accident'

type Props = {
  open: boolean
  vehicle: VehicleRecord
  vehicles?: VehicleRecord[]
  onClose?: () => void
}

function isInspectionType(value: string): value is InspectionType {
  return value === 'quick' || value === 'scheduled' || value === 'accident'
}

export default function NewInspectionModal({ open, vehicle, onClose }: Props) {
  const router = useRouter()
  const [type, setType] = useState<InspectionType>('quick')
  const { usage, loading: usageLoading } = useCompanyUsage(open)
  const accidentEnabled = usage?.features.accidentModule.enabled !== false
  const accidentAvailable = accidentEnabled && !usageLoading
  const effectiveType = !accidentAvailable && type === 'accident' ? 'quick' : type

  if (!open) return null
  // Basic modal overlay
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Новый осмотр</h3>
        <div className="mb-4 text-sm text-slate-700">Автомобиль: {vehicle?.number} · {vehicle?.name}</div>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Тип осмотра</label>
          <select
            value={effectiveType}
            onChange={(e) => {
              if (isInspectionType(e.target.value)) setType(e.target.value)
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="quick">Быстрый</option>
            <option value="scheduled">Плановый</option>
            <option value="accident" disabled={!accidentAvailable}>
              ДТП{accidentEnabled ? '' : ' — недоступно тарифом'}
            </option>
          </select>
          {!accidentEnabled ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Модуль ДТП отключён для текущего тарифа компании. Обратитесь к владельцу компании.
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2">Отмена</button>
          <button
            onClick={() => {
              router.push(`/inspections/new?vehicle=${vehicle?.id}&type=${effectiveType}`)
              onClose?.()
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Начать осмотр
          </button>
        </div>
      </div>
    </div>
  )
}
