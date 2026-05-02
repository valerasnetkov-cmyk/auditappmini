'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { formatDate } from '@/lib/dateUtils'
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

function getTypeLabel(type: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type
}

function getTypeBadgeClass(type: string) {
  if (type === 'quick') return 'bg-blue-100 text-blue-700'
  if (type === 'scheduled') return 'bg-purple-100 text-purple-700'
  return 'bg-red-100 text-red-700'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'
  return new Date(value).toLocaleString('ru-RU')
}

export default function InspectionsPage() {
  const searchParams = useSearchParams()
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [vehicleFilter, setVehicleFilter] = useState(searchParams.get('vehicle') || '')
  const [typeFilter, setTypeFilter] = useState<InspectionType | ''>((searchParams.get('type') as InspectionType | null) || '')
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' })
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const uniqueRegions = useMemo(() => {
    const regions = new Set(vehicles.map((vehicle) => vehicle.region).filter((region): region is string => Boolean(region)))
    return Array.from(regions).sort()
  }, [vehicles])

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

      setInspections(inspectionsResponse.data || [])
      setVehicles(vehiclesResponse.data || [])

      if (inspectionsResponse.pagination) {
        setTotalCount(inspectionsResponse.pagination.total)
        setTotalPages(inspectionsResponse.pagination.pages)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
  }, [vehicleFilter, typeFilter, dateFrom, dateTo])

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
    let items = sortedInspections

    if (regionFilter) {
      items = items.filter((inspection) => inspection.vehicle_region === regionFilter)
    }

    return items
  }, [sortedInspections, regionFilter])

  const pagedInspections = useMemo(
    () => filteredInspections.slice((page - 1) * 20, page * 20),
    [filteredInspections, page],
  )

  const accidentCount = inspections.filter((inspection) => inspection.type === 'accident').length
  const scheduledCount = inspections.filter((inspection) => inspection.type === 'scheduled').length
  const quickCount = inspections.filter((inspection) => inspection.type === 'quick').length

  const handleSort = (key: SortableInspectionKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить осмотр? Это действие нельзя отменить.')) return

    setDeletingId(id)
    try {
      const result = await api.deleteInspection(id)
      if (result.error) {
        showToast(result.error, 'error')
        return
      }

      await loadData()
      showToast('Осмотр удалён')
    } finally {
      setDeletingId(null)
    }
  }

  const renderSortMarker = (key: SortableInspectionKey) => {
    if (sortConfig.key !== key) return <span className="ml-1 text-slate-300">↕</span>
    return <span className="ml-1 text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <Layout currentPage="inspections">
      <div className="p-6">
        {toast ? (
          <div
            className={`fixed right-4 top-4 z-50 rounded-lg px-6 py-3 shadow-lg ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.message}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Осмотры</h1>
            <p className="mt-1 text-sm text-slate-500">Журнал осмотров, ДТП и зафиксированных дефектов.</p>
          </div>
          <Link href="/inspections/new" className="rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700">
            + Новый осмотр
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${!typeFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Все ({inspections.length})
            </button>
            <button
              onClick={() => setTypeFilter('accident')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${typeFilter === 'accident' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
            >
              ДТП ({accidentCount})
            </button>
            <button
              onClick={() => setTypeFilter('scheduled')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${typeFilter === 'scheduled' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
            >
              Плановые ({scheduledCount})
            </button>
            <button
              onClick={() => setTypeFilter('quick')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${typeFilter === 'quick' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
            >
              Быстрые ({quickCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <select
              value={vehicleFilter}
              onChange={(event) => {
                setVehicleFilter(event.target.value)
                setPage(1)
              }}
              className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
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
              className="min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
            >
              <option value="">Все регионы</option>
              {uniqueRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">С</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" />
              <span className="text-slate-500">по</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" />
              {dateFrom || dateTo ? (
                <button
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">Показано {filteredInspections.length} из {totalCount} осмотров</div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="cursor-pointer px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('created_at')}>
                      Осмотр {renderSortMarker('created_at')}
                    </th>
                    <th className="cursor-pointer px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('accident_occurred_at')}>
                      ДТП {renderSortMarker('accident_occurred_at')}
                    </th>
                    <th className="cursor-pointer px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('vehicle_number')}>
                      Техника {renderSortMarker('vehicle_number')}
                    </th>
                    <th className="cursor-pointer px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('inspector_name')}>
                      Инспектор {renderSortMarker('inspector_name')}
                    </th>
                    <th className="cursor-pointer px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('defects_count')}>
                      Дефекты {renderSortMarker('defects_count')}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagedInspections.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        Осмотры не найдены
                      </td>
                    </tr>
                  ) : (
                    pagedInspections.map((inspection) => (
                      <tr key={inspection.id} className={inspection.type === 'accident' ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'}>
                        <td className="px-5 py-4 align-top">
                          <div className="font-medium text-slate-900">{formatDate(inspection.created_at)}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDateTime(inspection.created_at)}</div>
                          <div className="mt-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getTypeBadgeClass(inspection.type)}`}>
                              {getTypeLabel(inspection.type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {inspection.type === 'accident' ? (
                            <>
                              <div className="font-medium text-slate-900">{formatDateTime(inspection.accident_occurred_at)}</div>
                              <div className="mt-1 max-w-[260px] text-sm text-slate-600">{inspection.accident_location || 'Место не указано'}</div>
                            </>
                          ) : (
                            <span className="text-slate-400">Не применяется</span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Link href={`/vehicles/${inspection.vehicle_id}`} className="font-medium text-blue-600 hover:underline">
                            {inspection.vehicle_number}
                          </Link>
                          <div className="mt-1 text-sm text-slate-700">{inspection.vehicle_name}</div>
                          <div className="mt-1 text-xs text-slate-500">{inspection.vehicle_region || 'Регион не указан'}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="font-medium text-slate-900">{inspection.inspector_name}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {inspection.defects_count > 0 ? (
                            <span className="font-medium text-red-600">{inspection.defects_count}</span>
                          ) : (
                            <span className="font-medium text-green-600">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-col gap-2 text-sm">
                            <Link href={`/inspections/${inspection.id}`} className="text-blue-600 hover:underline">
                              Открыть осмотр
                            </Link>
                            {inspection.defects_count > 0 ? (
                              <Link href={`/defects?vehicle=${inspection.vehicle_id}`} className="text-blue-600 hover:underline">
                                Смотреть дефекты
                              </Link>
                            ) : null}
                            <button
                              onClick={() => handleDelete(inspection.id)}
                              disabled={deletingId === inspection.id}
                              className="text-left text-red-600 hover:underline disabled:opacity-50"
                            >
                              {deletingId === inspection.id ? 'Удаление...' : 'Удалить'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              Назад
            </button>
            <span className="px-4 py-2">Страница {page} из {totalPages}</span>
            <button
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page === totalPages}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              Вперёд
            </button>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
