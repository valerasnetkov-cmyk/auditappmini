'use client'

import type { RegionRecord } from '@/lib/types'
import { COLUMNS } from '../_lib/vehicles'

export function VehiclesFilters({
  searchQuery,
  statusFilter,
  regionFilter,
  inspectionStatusFilter,
  regions,
  hiddenColumns,
  showColumnMenu,
  onSearchChange,
  onStatusChange,
  onRegionChange,
  onInspectionStatusChange,
  onToggleColumnMenu,
  onToggleColumn,
}: {
  searchQuery: string
  statusFilter: string
  regionFilter: string
  inspectionStatusFilter: string
  regions: RegionRecord[]
  hiddenColumns: string[]
  showColumnMenu: boolean
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onRegionChange: (value: string) => void
  onInspectionStatusChange: (value: string) => void
  onToggleColumnMenu: () => void
  onToggleColumn: (column: string) => void
}) {
  return (
    <section className="card mb-6 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[220px] flex-1">
          <input
            type="text"
            placeholder="Поиск по номеру или названию..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="input"
          />
        </div>

        <select aria-label="Статус техники" value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className="select w-auto min-w-[180px]">
          <option value="">Все статусы</option>
          <option value="active">В работе</option>
          <option value="repair">Ремонт</option>
          <option value="archived">Архив</option>
        </select>

        <select aria-label="Регион" value={regionFilter} onChange={(event) => onRegionChange(event.target.value)} className="select w-auto min-w-[190px]">
          <option value="">Все регионы</option>
          {regions.map((region) => (
            <option key={region.id} value={region.name}>
              {region.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Статус графика осмотров"
          value={inspectionStatusFilter}
          onChange={(event) => onInspectionStatusChange(event.target.value)}
          className="select w-auto min-w-[210px]"
        >
          <option value="">Все по графику</option>
          <option value="inspection_actual">Актуальные</option>
          <option value="inspection_due_soon">Скоро нужен осмотр</option>
          <option value="inspection_overdue">Просроченные</option>
          <option value="never_inspected">Никогда не осматривались</option>
        </select>

        <div className="relative">
          <button onClick={onToggleColumnMenu} className="btn btn-secondary" type="button">
            Столбцы
          </button>
          {showColumnMenu ? (
            <div className="popover absolute right-0 top-full z-40 mt-2 min-w-[180px] p-2">
              {COLUMNS.map((column) => (
                <label key={column.key} className="flex cursor-pointer items-center rounded-control px-3 py-2 text-sm text-foreground-secondary hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.includes(column.key)}
                    onChange={() => onToggleColumn(column.key)}
                    className="mr-2"
                  />
                  {column.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
