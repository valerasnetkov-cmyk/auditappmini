"use client"

import { useMemo } from 'react'
import type { InspectionRecord } from '@/lib/types'

type OdometerHistoryProps = {
  inspections: InspectionRecord[]
}

export default function OdometerHistory({ inspections }: OdometerHistoryProps) {
  const inspectionsWithOdometer = useMemo(() => {
    return inspections
      .filter(i => i.type === 'quick' || i.type === 'scheduled')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [inspections])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatOdometer = (value?: number | null, unit?: string) => {
    if (!value) return '—'
    return `${value.toLocaleString('ru-RU')} ${unit || 'км'}`
  }

  return (
    <div className="card p-4">
      <h3 className="text-lg font-semibold mb-4">История пробега</h3>
      
      {inspectionsWithOdometer.length === 0 ? (
        <p className="text-sm text-gray-500">Нет данных о пробеге</p>
      ) : (
        <div className="space-y-2">
          {inspectionsWithOdometer.map((inspection, idx) => (
            <div key={inspection.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{formatDate(inspection.created_at)}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  inspection.type === 'accident' 
                    ? 'bg-red-100 text-red-700' 
                    : inspection.type === 'scheduled'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {inspection.type === 'quick' ? 'Быстрый' : inspection.type === 'scheduled' ? 'Плановый' : 'ДТП'}
                </span>
              </div>
              <div className="font-medium">
                {/* В будущем здесь будет настоящий odometer_value из inspection */}
                <span className="text-gray-400">—</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}