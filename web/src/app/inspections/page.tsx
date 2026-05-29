'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { formatDate } from '@/lib/dateUtils'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import type { InspectionRecord, InspectionType, VehicleListItem } from '@/lib/types'

type SortableInspectionKey =
  | 'created_at'
  | 'accident_occurred_at'
  | 'vehicle_number'
  | 'vehicle_name'
  | 'vehicle_region'
  | 'inspector_name'
  | 'type'
  | 'defects_count'

type SortConfig = {
  key: SortableInspectionKey
  direction: 'asc' | 'desc'
}

type ToastMessage = {
  tone: 'success' | 'danger'
  text: string
}

const PAGE_SIZE = 20

const inspectionTypeTabs: Array<{ value: InspectionType | ''; label: string; className: string; activeClassName: string }> = [
  { value: '', label: 'Все', className: 'btn btn-secondary btn-sm', activeClassName: 'btn btn-primary btn-sm' },
  { value: 'accident', label: 'ДТП', className: 'badge badge-danger px-4 py-2', activeClassName: 'btn btn-danger btn-sm' },
  { value: 'scheduled', label: 'Плановые', className: 'badge badge-warning px-4 py-2', activeClassName: 'btn btn-primary btn-sm bg-purple-600 border-purple-600' },
  { value: 'quick', label: 'Быстрые', className: 'badge badge-info px-4 py-2', activeClassName: 'btn btn-primary btn-sm' },
]

function getTypeLabel(type: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

function getTypeBadgeClass(type: string) {
  if (type === 'quick') return 'badge badge-info'
  if (type === 'scheduled') return 'badge badge-warning'
  return 'badge badge-danger'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Не указано'

  return date.toLocaleString('ru-RU')
}

function getSortMarker(sortConfig: SortConfig, key: SortableInspectionKey) {
  if (sortConfig.key !== key) return '↕'
  return sortConfig.direction === 'asc' ? '↑' : '↓'
}

export default function InspectionsPage() {
  const searchParams = useSearchParams()
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [vehicleFilter, setVehicleFilter] = useState(searchParams.get('vehicle') || '')
  const [typeFilter, setTypeFilter] = useState<InspectionType | ''>((searchParams.get('type') as InspectionType | null) || '')
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' })
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage()
  const createRestriction = getCompanyOperationRestriction(companyUsage, 'create')
  const writeRestriction = getCompanyOperationRestriction(companyUsage, 'write')
  const createRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Создание осмотра станет доступно после проверки.'
    : createRestriction
      ? `${createRestriction.title}: ${createRestriction.message}`
      : ''
  const writeRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Изменения станут доступны после проверки.'
    : writeRestriction
      ? `${writeRestriction.title}: ${writeRestriction.message}`
      : ''

  const showToast = (text: string, tone: ToastMessage['tone'] = 'success') => {
    setToast({ text, tone })
    window.setTimeout(() => setToast(null), 3000)
  }

  const loadData = async () => {
    try {
      setLoading(true)

      const [inspectionsResponse, vehiclesResponse] = await Promise.all([
        api.getInspections({
          page: 1,
          limit: 100,
          type: typeFilter || undefined,
          vehicle: vehicleFilter || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        }),
        api.getVehiclesList(),
      ])

      if (inspectionsResponse.error) {
        showToast(inspectionsResponse.error, 'danger')
        return
      }

      if (vehiclesResponse.error) {
        showToast(vehiclesResponse.error, 'danger')
      }

      setInspections(inspectionsResponse.data || [])
      setVehicles(vehiclesResponse.data || [])
      setTotalCount(inspectionsResponse.pagination?.total || inspectionsResponse.data?.length || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleFilter, typeFilter, dateFrom, dateTo])

  const uniqueRegions = useMemo(() => {
    const regions = new Set(vehicles.map((vehicle) => vehicle.region).filter((region): region is string => Boolean(region)))
    return Array.from(regions).sort((left, right) => left.localeCompare(right, 'ru'))
  }, [vehicles])

  const sortedInspections = useMemo(() => {
    return [...inspections].sort((left, right) => {
      let leftValue: string | number = left[sortConfig.key] ?? ''
      let rightValue: string | number = right[sortConfig.key] ?? ''

      if (sortConfig.key === 'created_at' || sortConfig.key === 'accident_occurred_at') {
        leftValue = leftValue ? new Date(String(leftValue)).getTime() : 0
        rightValue = rightValue ? new Date(String(rightValue)).getTime() : 0
      } else if (typeof leftValue === 'string') {
        leftValue = leftValue.toLowerCase()
        rightValue = String(rightValue).toLowerCase()
      }

      if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [inspections, sortConfig])

  const filteredInspections = useMemo(() => {
    if (!regionFilter) return sortedInspections
    return sortedInspections.filter((inspection) => inspection.vehicle_region === regionFilter)
  }, [sortedInspections, regionFilter])

  const totalPages = Math.max(1, Math.ceil(filteredInspections.length / PAGE_SIZE))
  const pagedInspections = filteredInspections.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const accidentCount = inspections.filter((inspection) => inspection.type === 'accident').length
  const scheduledCount = inspections.filter((inspection) => inspection.type === 'scheduled').length
  const quickCount = inspections.filter((inspection) => inspection.type === 'quick').length
  const typeCounts: Record<string, number> = {
    accident: accidentCount,
    scheduled: scheduledCount,
    quick: quickCount,
  }

  const handleSort = (key: SortableInspectionKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleDelete = async (id: string) => {
    if (companyUsageLoading) {
      showToast('Проверяем статус тарифа компании. Повторите действие через несколько секунд.', 'danger')
      return
    }

    if (writeRestriction) {
      showToast(`${writeRestriction.title}: ${writeRestriction.message}`, 'danger')
      return
    }

    if (!confirm('Удалить осмотр? Это действие нельзя отменить.')) return

    setDeletingId(id)
    try {
      const result = await api.deleteInspection(id)
      if (result.error) {
        showToast(result.error, 'danger')
        return
      }

      await loadData()
      showToast('Осмотр удален')
    } finally {
      setDeletingId(null)
    }
  }

  const clearDateFilters = () => {
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <Layout currentPage="inspections">
      <div className="p-6">
        {toast ? (
          <div className={toast.tone === 'success' ? 'toast toast-success' : 'toast toast-error'}>
            {toast.text}
          </div>
        ) : null}

        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title text-2xl">Осмотры</h1>
            <p className="mt-1 text-sm text-foreground-muted">Журнал осмотров, ДТП и зафиксированных дефектов.</p>
          </div>
          {createRestrictionMessage ? (
            <button type="button" disabled className="btn btn-primary disabled:opacity-50">
              + Новый осмотр
            </button>
          ) : (
            <Link href="/inspections/new" className="btn btn-primary">
            + Новый осмотр
            </Link>
          )}
        </header>

        <SubscriptionStatusBanner usage={companyUsage} compact />

        {createRestrictionMessage || writeRestrictionMessage ? (
          <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">
            {createRestrictionMessage || writeRestrictionMessage}
          </div>
        ) : null}

        <section className="card mb-6 p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {inspectionTypeTabs.map((tab) => (
              <button
                key={tab.value || 'all'}
                onClick={() => {
                  setTypeFilter(tab.value)
                  setPage(1)
                }}
                className={typeFilter === tab.value ? tab.activeClassName : tab.className}
              >
                {tab.label} ({tab.value ? typeCounts[tab.value] || 0 : inspections.length})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <select
              value={vehicleFilter}
              onChange={(event) => {
                setVehicleFilter(event.target.value)
                setPage(1)
              }}
              className="select min-w-[220px]"
            >
              <option value="">Вся техника</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.number} · {vehicle.name}
                </option>
              ))}
            </select>

            <select
              value={regionFilter}
              onChange={(event) => {
                setRegionFilter(event.target.value)
                setPage(1)
              }}
              className="select min-w-[180px]"
            >
              <option value="">Все регионы</option>
              {uniqueRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground-muted">С</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="input w-auto" />
              <span className="text-foreground-muted">по</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="input w-auto" />
              {dateFrom || dateTo ? (
                <button onClick={clearDateFilters} className="btn btn-secondary btn-sm">
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mb-4 text-sm text-foreground-muted">
          Показано {filteredInspections.length} из {totalCount} осмотров
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="mt-3 text-sm text-foreground-muted">Загрузка осмотров...</p>
          </div>
        ) : (
          <InspectionsTable
            inspections={pagedInspections}
            sortConfig={sortConfig}
            deletingId={deletingId}
            actionsDisabled={Boolean(writeRestrictionMessage)}
            onSort={handleSort}
            onDelete={handleDelete}
          />
        )}

        {totalPages > 1 ? (
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="btn btn-secondary disabled:opacity-50">
              Назад
            </button>
            <span className="px-4 py-2 text-foreground-secondary">Страница {page} из {totalPages}</span>
            <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="btn btn-secondary disabled:opacity-50">
              Вперед
            </button>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}

function InspectionsTable({
  inspections,
  sortConfig,
  deletingId,
  actionsDisabled,
  onSort,
  onDelete,
}: {
  inspections: InspectionRecord[]
  sortConfig: SortConfig
  deletingId: string | null
  actionsDisabled: boolean
  onSort: (key: SortableInspectionKey) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="min-w-full divide-y divide-line">
          <thead className="table-header">
            <tr>
              <SortableHeader label="Осмотр" sortKey="created_at" sortConfig={sortConfig} onSort={onSort} />
              <SortableHeader label="ДТП" sortKey="accident_occurred_at" sortConfig={sortConfig} onSort={onSort} />
              <SortableHeader label="Техника" sortKey="vehicle_number" sortConfig={sortConfig} onSort={onSort} />
              <SortableHeader label="Инспектор" sortKey="inspector_name" sortConfig={sortConfig} onSort={onSort} />
              <SortableHeader label="Дефекты" sortKey="defects_count" sortConfig={sortConfig} onSort={onSort} />
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {inspections.length ? (
              inspections.map((inspection) => (
                <InspectionRow key={inspection.id} inspection={inspection} deletingId={deletingId} actionsDisabled={actionsDisabled} onDelete={onDelete} />
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-foreground-muted">
                  Осмотры не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string
  sortKey: SortableInspectionKey
  sortConfig: SortConfig
  onSort: (key: SortableInspectionKey) => void
}) {
  return (
    <th
      className="cursor-pointer px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted"
      onClick={() => onSort(sortKey)}
    >
      {label} <span className={sortConfig.key === sortKey ? 'text-primary' : 'text-foreground-disabled'}>{getSortMarker(sortConfig, sortKey)}</span>
    </th>
  )
}

function InspectionRow({
  inspection,
  deletingId,
  actionsDisabled,
  onDelete,
}: {
  inspection: InspectionRecord
  deletingId: string | null
  actionsDisabled: boolean
  onDelete: (id: string) => void
}) {
  return (
    <tr className={inspection.type === 'accident' ? 'alert-danger' : 'hover:bg-surface-hover'}>
      <td className="px-5 py-4 align-top">
        <div className="font-medium text-foreground">{formatDate(inspection.created_at)}</div>
        <div className="mt-1 text-xs text-foreground-muted">{formatDateTime(inspection.created_at)}</div>
        <div className="mt-2">
          <span className={getTypeBadgeClass(inspection.type)}>{getTypeLabel(inspection.type)}</span>
        </div>
      </td>
      <td className="px-5 py-4 align-top">
        {inspection.type === 'accident' ? (
          <>
            <div className="font-medium text-foreground">{formatDateTime(inspection.accident_occurred_at)}</div>
            <div className="mt-1 max-w-[260px] text-sm text-foreground-secondary">{inspection.accident_location || 'Место не указано'}</div>
          </>
        ) : (
          <span className="text-foreground-muted">Не применяется</span>
        )}
      </td>
      <td className="px-5 py-4 align-top">
        <Link href={`/vehicles/${inspection.vehicle_id}`} className="font-medium text-primary hover:underline">
          {inspection.vehicle_number}
        </Link>
        <div className="mt-1 text-sm text-foreground-secondary">{inspection.vehicle_name}</div>
        <div className="mt-1 text-xs text-foreground-muted">{inspection.vehicle_region || 'Регион не указан'}</div>
      </td>
      <td className="px-5 py-4 align-top">
        <div className="font-medium text-foreground">{inspection.inspector_name}</div>
      </td>
      <td className="px-5 py-4 align-top">
        {inspection.defects_count > 0 ? (
          <span className="font-medium text-status-danger">{inspection.defects_count}</span>
        ) : (
          <span className="font-medium text-status-success">0</span>
        )}
      </td>
      <td className="px-5 py-4 align-top">
        <div className="flex flex-col gap-2 text-sm">
          <Link href={`/inspections/${inspection.id}`} className="text-primary hover:underline">
            Открыть осмотр
          </Link>
          {inspection.defects_count > 0 ? (
            <Link href={`/defects?vehicle=${inspection.vehicle_id}`} className="text-primary hover:underline">
              Смотреть дефекты
            </Link>
          ) : null}
          <button onClick={() => onDelete(inspection.id)} disabled={deletingId === inspection.id || actionsDisabled} className="text-left text-status-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50">
            {deletingId === inspection.id ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </td>
    </tr>
  )
}
