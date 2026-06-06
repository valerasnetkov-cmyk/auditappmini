'use client'

import Link from 'next/link'
import type { VehicleRecord } from '@/lib/types'
import { getStatusBadgeClass, getStatusLabel } from '../_lib/vehicles'

export function VehicleRow({
  vehicle,
  hiddenColumns,
  selected,
  actionsDisabled,
  createActionsDisabled,
  onInspect,
  onEdit,
  onArchive,
  onToggleSelected,
}: {
  vehicle: VehicleRecord
  hiddenColumns: string[]
  selected: boolean
  actionsDisabled: boolean
  createActionsDisabled: boolean
  onInspect: (vehicle: VehicleRecord) => void
  onEdit: (vehicle: VehicleRecord) => void
  onArchive: (id: string) => void
  onToggleSelected: (id: string) => void
}) {
  const isArchived = vehicle.status === 'archived'

  return (
    <tr className="hover:bg-surface-hover">
      <td className="whitespace-nowrap px-6 py-4">
        <input
          type="checkbox"
          checked={selected}
          disabled={isArchived || actionsDisabled}
          onChange={() => onToggleSelected(vehicle.id)}
          aria-label={`Выбрать технику ${vehicle.number}`}
          className="h-4 w-4 rounded border-line disabled:opacity-40"
        />
      </td>
      {!hiddenColumns.includes('number') ? (
        <td className="whitespace-nowrap px-6 py-4 font-medium">
          <Link href={`/vehicles/${vehicle.id}`} className="text-primary hover:underline">
            {vehicle.number}
          </Link>
        </td>
      ) : null}
      {!hiddenColumns.includes('name') ? <td className="px-6 py-4 text-foreground">{vehicle.name}</td> : null}
      {!hiddenColumns.includes('region') ? <td className="px-6 py-4 text-foreground-secondary">{vehicle.region || '-'}</td> : null}
      {!hiddenColumns.includes('status') ? (
        <td className="whitespace-nowrap px-6 py-4">
          <span className={getStatusBadgeClass(vehicle.status)}>{getStatusLabel(vehicle.status)}</span>
        </td>
      ) : null}
      {!hiddenColumns.includes('defectsCount') ? (
        <td className="px-6 py-4">
          {(vehicle.defectsCount || 0) > 0 ? (
            <span className="font-medium text-status-danger">{vehicle.defectsCount}</span>
          ) : (
            <span className="font-medium text-status-success">Нет</span>
          )}
        </td>
      ) : null}
      <td className="px-6 py-4 text-center">
        {!isArchived ? (
          <button onClick={() => onInspect(vehicle)} disabled={createActionsDisabled} className="mr-3 text-status-success hover:underline disabled:cursor-not-allowed disabled:opacity-50">
            Осмотр
          </button>
        ) : null}
        <button onClick={() => onEdit(vehicle)} disabled={actionsDisabled} className="mr-3 text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">
          Изменить
        </button>
        {!isArchived ? (
          <button onClick={() => onArchive(vehicle.id)} disabled={actionsDisabled} className="text-status-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50">
            В архив
          </button>
        ) : null}
      </td>
    </tr>
  )
}
