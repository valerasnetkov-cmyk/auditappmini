'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import NewInspectionModal from '@/components/NewInspectionModal'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { normalizeVehicleNumber, VEHICLE_NUMBER_HELP } from '@/lib/vehicleNumber'
import type { RegionRecord, VehicleRecord, VehicleStatus } from '@/lib/types'

const ITEMS_PER_PAGE = 20

type VehicleFormData = {
  number: string
  name: string
  status: VehicleStatus
  qr_code: string
  region: string
}

type SortableVehicleKey = 'number' | 'name' | 'region' | 'qr_code' | 'status' | 'defectsCount'

type SortConfig = {
  key: SortableVehicleKey
  direction: 'asc' | 'desc'
}

const INITIAL_FORM: VehicleFormData = {
  number: '',
  name: '',
  status: 'active',
  qr_code: '',
  region: '',
}

export default function VehiclesPage() {
  const searchParams = useSearchParams()
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [regions, setRegions] = useState<RegionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewInspectionModal, setShowNewInspectionModal] = useState(false)
  const [selectedVehicleForInspection, setSelectedVehicleForInspection] = useState<VehicleRecord | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null)
  const [formData, setFormData] = useState<VehicleFormData>(INITIAL_FORM)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'number', direction: 'asc' })
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [vehiclesRes, regionsRes] = await Promise.all([
        api.getVehicles({
          page: 1,
          limit: 100,
          search: searchQuery,
          status: statusFilter || undefined,
        }),
        api.getRegions(),
      ])

      if (vehiclesRes.error) {
        setError(vehiclesRes.error)
        return
      }

      if (regionsRes.error) {
        setError(regionsRes.error)
        return
      }

      setVehicles(vehiclesRes.data || [])
      setRegions(regionsRes.data || [])

      if (vehiclesRes.pagination) {
        setTotalCount(vehiclesRes.pagination.total)
        setTotalPages(vehiclesRes.pagination.pages)
      }
    } catch (loadError) {
      console.error('Vehicles page load error:', loadError)
      setError('Не удалось загрузить список техники')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
  }, [searchQuery, statusFilter])

  // Auto-open New Inspection modal if URL contains vehicle param (e.g. /inspections/new?vehicle=...)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const vehParam = url.searchParams.get('vehicle')
    if (!vehParam) return
    // If vehicles list already loaded, pick directly
    const found = vehicles.find((v) => v.id === vehParam)
    if (found) {
      setSelectedVehicleForInspection(found)
      setShowNewInspectionModal(true)
      return
    }
    // Otherwise fetch the vehicle info and show modal
    api.getVehicle(vehParam).then((res) => {
      if (!res?.error && res?.data) {
        // type cast to VehicleRecord to satisfy state type
        setSelectedVehicleForInspection(res.data as unknown as VehicleRecord)
        setShowNewInspectionModal(true)
      }
    }).catch(() => {
      // ignore fetch error
    })
  }, [vehicles])

  const sortedVehicles = useMemo(() => {
    let filtered = vehicles

    if (regionFilter) {
      filtered = filtered.filter((vehicle) => vehicle.region === regionFilter)
    }

    return [...filtered].sort((a, b) => {
      let aValue: string | number = a[sortConfig.key] ?? ''
      let bValue: string | number = b[sortConfig.key] ?? ''

      if (typeof aValue === 'string') aValue = aValue.toLowerCase()
      if (typeof bValue === 'string') bValue = bValue.toLowerCase()

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [vehicles, sortConfig, regionFilter])

  const columns: Array<{ key: SortableVehicleKey; label: string }> = [
    { key: 'number', label: 'Госномер' },
    { key: 'name', label: 'Название' },
    { key: 'region', label: 'Регион' },
    { key: 'qr_code', label: 'QR-код' },
    { key: 'status', label: 'Статус' },
    { key: 'defectsCount', label: 'Дефекты' },
  ]

  const handleSort = (key: SortableVehicleKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleColumn = (column: string) => {
    setHiddenColumns((prev) => (prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column]))
  }

  const resetForm = () => {
    setFormData(INITIAL_FORM)
    setFormError('')
    setSaving(false)
  }

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    try {
      const result = await api.createVehicle({
        ...formData,
        number: normalizeVehicleNumber(formData.number),
        name: formData.name.trim(),
        qr_code: formData.qr_code.trim() || undefined,
        region: formData.region || undefined,
      })

      if (result.error) {
        setFormError(result.error)
        return
      }

      setShowAddModal(false)
      resetForm()
      await loadData()
    } catch {
      setFormError('Не удалось добавить технику')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (vehicle: VehicleRecord) => {
    setEditingVehicle(vehicle)
    setFormData({
      number: vehicle.number,
      name: vehicle.name,
      status: vehicle.status,
      qr_code: vehicle.qr_code || '',
      region: vehicle.region || '',
    })
    setFormError('')
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingVehicle) return

    setSaving(true)
    setFormError('')

    try {
      const result = await api.updateVehicle(editingVehicle.id, {
        ...formData,
        number: normalizeVehicleNumber(formData.number),
        name: formData.name.trim(),
        qr_code: formData.qr_code.trim() || undefined,
        region: formData.region || undefined,
      })

      if (result.error) {
        setFormError(result.error)
        return
      }

      setEditingVehicle(null)
      resetForm()
      await loadData()
    } catch {
      setFormError('Не удалось сохранить изменения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить технику?')) return

    const result = await api.deleteVehicle(id)
    if (result.error) {
      setError(result.error)
      return
    }

    await loadData()
  }

  const renderSortIcon = (key: SortableVehicleKey) => {
    if (sortConfig.key !== key) return <span className="ml-1 text-slate-300">↕</span>
    return <span className="ml-1 text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  const renderVehicleForm = (mode: 'create' | 'edit') => (
    <form onSubmit={mode === 'create' ? handleAdd : handleUpdate}>
      <div className="space-y-4">
        {formError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <div>
          <input
            type="text"
            placeholder="Госномер, например A123BC77"
            value={formData.number}
            onChange={(event) => setFormData({ ...formData, number: normalizeVehicleNumber(event.target.value) })}
            autoCapitalize="characters"
            inputMode="text"
            maxLength={9}
            spellCheck={false}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          />
          <p className="mt-1 text-xs text-slate-500">{VEHICLE_NUMBER_HELP}</p>
        </div>

        <input
          type="text"
          placeholder="Название"
          value={formData.name}
          onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          required
        />

        <select
          value={formData.region}
          onChange={(event) => setFormData({ ...formData, region: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          <option value="">Не выбран</option>
          {regions.map((region) => (
            <option key={region.id} value={region.name}>
              {region.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="QR-код (необязательно)"
          value={formData.qr_code}
          onChange={(event) => setFormData({ ...formData, qr_code: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />

        <select
          value={formData.status}
          onChange={(event) => setFormData({ ...formData, status: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          <option value="active">В работе</option>
          <option value="repair">Ремонт</option>
        </select>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            if (mode === 'create') {
              setShowAddModal(false)
            } else {
              setEditingVehicle(null)
            }
            resetForm()
          }}
          className="rounded-lg border border-slate-200 px-4 py-2"
        >
          Отмена
        </button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {saving ? 'Сохранение...' : mode === 'create' ? 'Добавить' : 'Сохранить'}
        </button>
      </div>
    </form>
  )

  return (
    <Layout currentPage="vehicles">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Техника</h1>
          <div className="flex items-center gap-3">
            <Link href="/vehicles/new" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              Полная форма
            </Link>
            <button
              onClick={() => {
                setShowAddModal(true)
                resetForm()
              }}
              className="rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              + Добавить
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[220px] flex-1">
              <input
                type="text"
                placeholder="Поиск по номеру или названию..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Все статусы</option>
              <option value="active">В работе</option>
              <option value="repair">Ремонт</option>
            </select>

            <select
              value={regionFilter}
              onChange={(event) => {
                setRegionFilter(event.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Все регионы</option>
              {regions.map((region) => (
                <option key={region.id} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm hover:bg-slate-50"
              >
                Столбцы
              </button>
              {showColumnMenu ? (
                <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-lg">
                  {columns.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center px-4 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.includes(column.key)}
                        onChange={() => toggleColumn(column.key)}
                        className="mr-2"
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">Показано {sortedVehicles.length} из {totalCount}</div>

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
                    {!hiddenColumns.includes('number') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('number')}>
                        Госномер {renderSortIcon('number')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('name') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('name')}>
                        Название {renderSortIcon('name')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('region') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('region')}>
                        Регион {renderSortIcon('region')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('qr_code') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('qr_code')}>
                        QR-код {renderSortIcon('qr_code')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('status') ? (
                      <th className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600" onClick={() => handleSort('status')}>
                        Статус {renderSortIcon('status')}
                      </th>
                    ) : null}
                    {!hiddenColumns.includes('defectsCount') ? (
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Дефекты</th>
                    ) : null}
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Техника не найдена
                      </td>
                    </tr>
                  ) : (
                    sortedVehicles.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((vehicle) => (
                      <tr key={vehicle.id} className="hover:bg-slate-50">
                        {!hiddenColumns.includes('number') ? (
                          <td className="whitespace-nowrap px-6 py-4 font-medium">
                            <Link href={`/vehicles/${vehicle.id}`} className="text-blue-600 hover:underline">
                              {vehicle.number}
                            </Link>
                          </td>
                        ) : null}
                        {!hiddenColumns.includes('name') ? <td className="px-6 py-4">{vehicle.name}</td> : null}
                        {!hiddenColumns.includes('region') ? <td className="px-6 py-4 text-slate-600">{vehicle.region || '-'}</td> : null}
                        {!hiddenColumns.includes('qr_code') ? <td className="px-6 py-4 text-sm text-slate-500">{vehicle.qr_code || '-'}</td> : null}
                        {!hiddenColumns.includes('status') ? (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${
                                vehicle.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {vehicle.status === 'active' ? 'В работе' : 'Ремонт'}
                            </span>
                          </td>
                        ) : null}
                        {!hiddenColumns.includes('defectsCount') ? (
                          <td className="px-6 py-4">
                            {(vehicle.defectsCount || 0) > 0 ? (
                              <span className="text-red-600">{vehicle.defectsCount}</span>
                            ) : (
                              <span className="text-green-600">Нет</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => { setSelectedVehicleForInspection(vehicle); setShowNewInspectionModal(true); }} className="mr-3 text-green-600 hover:underline">Осмотр</button>
                          <button onClick={() => handleEdit(vehicle)} className="mr-3 text-blue-600 hover:underline">
                            Изменить
                          </button>
                          <button onClick={() => handleDelete(vehicle.id)} className="text-red-600 hover:underline">
                            Удалить
                          </button>
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

        {showAddModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">Добавить технику</h2>
              {renderVehicleForm('create')}
            </div>
          </div>
        ) : null}
        {showNewInspectionModal && selectedVehicleForInspection ? (
          <NewInspectionModal
            open={true}
            vehicle={selectedVehicleForInspection}
            vehicles={vehicles}
            onClose={() => {
              setShowNewInspectionModal(false)
              setSelectedVehicleForInspection(null)
            }}
          />
        ) : null}

        {editingVehicle ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">Редактировать технику</h2>
              {renderVehicleForm('edit')}
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
