'use client'

import type { VehicleRecord } from '@/lib/types'
import { COLUMNS, getSortMarker, type SortConfig, type SortableVehicleKey } from '../_lib/vehicles'
import { VehicleRow } from './VehicleRow'

export function VehiclesTable({
  vehicles,
  hiddenColumns,
  sortConfig,
  selectedIds,
  allVisibleSelected,
  actionsDisabled,
  onSort,
  onEdit,
  onArchive,
  onToggleSelected,
  onToggleAllVisible,
}: {
  vehicles: VehicleRecord[]
  hiddenColumns: string[]
  sortConfig: SortConfig
  selectedIds: Set<string>
  allVisibleSelected: boolean
  actionsDisabled: boolean
  onSort: (key: SortableVehicleKey) => void
  onEdit: (vehicle: VehicleRecord) => void
  onArchive: (id: string) => void
  onToggleSelected: (id: string) => void
  onToggleAllVisible: () => void
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="min-w-full divide-y divide-line">
          <thead className="table-header">
            <tr>
              <th className="w-12 px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={actionsDisabled}
                  onChange={onToggleAllVisible}
                  aria-label="Выбрать все видимые строки"
                  className="h-4 w-4 rounded border-line"
                />
              </th>
              {COLUMNS.map((column) =>
                hiddenColumns.includes(column.key) ? null : (
                  <th
                    key={column.key}
                    className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted"
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}{' '}
                    <span className={sortConfig.key === column.key ? 'text-primary' : 'text-foreground-disabled'}>
                      {getSortMarker(sortConfig, column.key)}
                    </span>
                  </th>
                ),
              )}
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vehicles.length ? (
              vehicles.map((vehicle) => (
                <VehicleRow
                  key={vehicle.id}
                  vehicle={vehicle}
                  hiddenColumns={hiddenColumns}
                  selected={selectedIds.has(vehicle.id)}
                  actionsDisabled={actionsDisabled}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onToggleSelected={onToggleSelected}
                />
              ))
            ) : (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-6 py-12 text-center text-foreground-muted">
                  Техника не найдена
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
