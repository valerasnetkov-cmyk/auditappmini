'use client'

import { useMemo, useState } from 'react'
import { formatDate } from '@/lib/dateUtils'
import type { InspectionRecord } from '@/lib/types'
import { getInspectionTypeLabel, getInspectionTypeStyle } from '../_lib/vehicleDetail'

type Props = {
  inspections: InspectionRecord[]
}

type SortDirection = 'asc' | 'desc'
type SortableInspectionHistoryKey = 'created_at' | 'type' | 'inspector_name' | 'duration_seconds' | 'defects_count'
type SortConfig = {
  key: SortableInspectionHistoryKey
  direction: SortDirection
}

export default function InspectionsHistory({ inspections }: Props) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' })
  const sortedInspections = useMemo(() => {
    return [...inspections].sort((left, right) => {
      const leftValue = getSortableValue(left, sortConfig.key)
      const rightValue = getSortableValue(right, sortConfig.key)
      if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [inspections, sortConfig])

  const handleSort = (key: SortableInspectionHistoryKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <section className="table-card mt-6">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">История осмотров</h2>
      </div>

      {inspections.length === 0 ? (
        <div className="p-12 text-center text-foreground-muted">Осмотров пока нет</div>
      ) : (
        <div className="table-scroll">
          <table className="min-w-full divide-y divide-line">
            <thead className="table-header">
              <tr>
                <SortableHeader label="Дата" sortKey="created_at" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Тип" sortKey="type" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Инспектор" sortKey="inspector_name" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Длительность" sortKey="duration_seconds" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Дефекты" sortKey="defects_count" sortConfig={sortConfig} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sortedInspections.map((inspection) => (
                <tr
                  key={inspection.id}
                  className={inspection.type === 'accident' ? 'alert-danger' : 'hover:bg-surface-hover'}
                >
                  <td className="whitespace-nowrap px-6 py-4">{formatDate(inspection.created_at)}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={getInspectionTypeStyle(inspection.type)}>
                      {getInspectionTypeLabel(inspection.type)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground-secondary">
                    {inspection.inspector_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground-secondary">
                    {formatDuration(inspection.duration_seconds, inspection.completed)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {inspection.defects_count > 0 ? (
                      <span className="text-status-danger">{inspection.defects_count}</span>
                    ) : (
                      <span className="text-status-success">Нет</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function getSortableValue(inspection: InspectionRecord, key: SortableInspectionHistoryKey): string | number {
  if (key === 'created_at') return new Date(inspection.created_at).getTime()
  if (key === 'duration_seconds') return inspection.duration_seconds || 0
  if (key === 'defects_count') return inspection.defects_count || 0
  return String(inspection[key] || '').toLowerCase()
}

function getSortMarker(sortConfig: SortConfig, key: SortableInspectionHistoryKey) {
  if (sortConfig.key !== key) return '↕'
  return sortConfig.direction === 'asc' ? '↑' : '↓'
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string
  sortKey: SortableInspectionHistoryKey
  sortConfig: SortConfig
  onSort: (key: SortableInspectionHistoryKey) => void
}) {
  return (
    <th
      className="cursor-pointer whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-foreground-muted select-none"
      onClick={() => onSort(sortKey)}
      scope="col"
    >
      {label}{' '}
      <span className={sortConfig.key === sortKey ? 'text-primary' : 'text-foreground-disabled'}>
        {getSortMarker(sortConfig, sortKey)}
      </span>
    </th>
  )
}

function formatDuration(seconds?: number | null, completed?: number | boolean) {
  if (!completed || seconds === null || seconds === undefined) return 'Осмотр не завершён'
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} мин`
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`
}
