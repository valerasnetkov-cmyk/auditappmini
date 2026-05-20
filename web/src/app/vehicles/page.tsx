'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import NewInspectionModal from '@/components/NewInspectionModal'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { normalizeVehicleNumber, VEHICLE_NUMBER_HELP } from '@/lib/vehicleNumber'
import type { RegionRecord, VehicleRecord, VehicleStatus } from '@/lib/types'

const ITEMS_PER_BATCH = 20

type VehicleFormData = {
  number: string
  name: string
  status: VehicleStatus
  region: string
}

type SortableVehicleKey = 'number' | 'name' | 'region' | 'status' | 'defectsCount'

type SortConfig = {
  key: SortableVehicleKey
  direction: 'asc' | 'desc'
}

type ColumnConfig = {
  key: SortableVehicleKey
  label: string
}

const INITIAL_FORM: VehicleFormData = {
  number: '',
  name: '',
  status: 'active',
  region: '',
}

const columns: ColumnConfig[] = [
  { key: 'number', label: 'Госномер' },
  { key: 'name', label: 'Название' },
  { key: 'region', label: 'Регион' },
  { key: 'status', label: 'Статус' },
  { key: 'defectsCount', label: 'Дефекты' },
]

function getStatusLabel(status: string) {
  if (status === 'active') return 'В работе'
  if (status === 'repair') return 'Ремонт'
  return status || 'Не указано'
}

function getStatusBadgeClass(status: string) {
  if (status === 'repair') return 'badge badge-warning'
  return 'badge badge-success'
}

function getSortMarker(sortConfig: SortConfig, key: SortableVehicleKey) {
  if (sortConfig.key !== key) return '↕'
  return sortConfig.direction === 'asc' ? '↑' : '↓'
}

export default function VehiclesPage() {
  const searchParams = useSearchParams()
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [regions, setRegions] = useState<RegionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '')
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_BATCH)
  const [totalCount, setTotalCount] = useState(0)
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
      setTotalCount(vehiclesRes.pagination?.total || vehiclesRes.data?.length || 0)
    } catch {
      setError('Не удалось загрузить список техники')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter])

  useEffect(() => {
    const vehicleId = searchParams.get('vehicle')
    if (!vehicleId) return

    const found = vehicles.find((vehicle) => vehicle.id === vehicleId)
    if (found) {
      setSelectedVehicleForInspection(found)
      setShowNewInspectionModal(true)
      return
    }

    void api.getVehicle(vehicleId).then((result) => {
      if (!result.error && result.data) {
        setSelectedVehicleForInspection(result.data as VehicleRecord)
        setShowNewInspectionModal(true)
      }
    })
  }, [vehicles, searchParams])

  const sortedVehicles = useMemo(() => {
    const filtered = regionFilter ? vehicles.filter((vehicle) => vehicle.region === regionFilter) : vehicles

    return [...filtered].sort((left, right) => {
      let leftValue: string | number = left[sortConfig.key] ?? ''
      let rightValue: string | number = right[sortConfig.key] ?? ''

      if (typeof leftValue === 'string') leftValue = leftValue.toLowerCase()
      if (typeof rightValue === 'string') rightValue = rightValue.toLowerCase()

      if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [vehicles, sortConfig, regionFilter])

  const visibleVehicles = sortedVehicles.slice(0, visibleCount)
  const hasMoreVehicles = visibleCount < sortedVehicles.length

  const handleSort = (key: SortableVehicleKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleColumn = (column: string) => {
    setHiddenColumns((current) => (current.includes(column) ? current.filter((item) => item !== column) : [...current, column]))
  }

  const resetForm = () => {
    setFormData(INITIAL_FORM)
    setFormError('')
    setSaving(false)
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    try {
      const result = await api.createVehicle({
        ...formData,
        number: normalizeVehicleNumber(formData.number),
        name: formData.name.trim(),
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
      region: vehicle.region || '',
    })
    setFormError('')
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingVehicle) return

    setSaving(true)
    setFormError('')

    try {
      const result = await api.updateVehicle(editingVehicle.id, {
        ...formData,
        number: normalizeVehicleNumber(formData.number),
        name: formData.name.trim(),
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

  const openAddModal = () => {
    resetForm()
    setShowAddModal(true)
  }

  const closeVehicleModal = () => {
    setShowAddModal(false)
    setEditingVehicle(null)
    resetForm()
  }

  return (
    <Layout currentPage="vehicles">
      <div className="p-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title text-2xl">Техника</h1>
            <p className="mt-1 text-sm text-foreground-muted">Справочник техники, статусов, регионов и быстрый запуск осмотров.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/vehicles/new" className="btn btn-secondary">
              Полная форма
            </Link>
            <button onClick={openAddModal} className="btn btn-primary">
              + Добавить
            </button>
          </div>
        </header>

        {error ? <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">{error}</div> : null}

        <VehiclesFilters
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          regionFilter={regionFilter}
          regions={regions}
          hiddenColumns={hiddenColumns}
          showColumnMenu={showColumnMenu}
          onSearchChange={(value) => {
            setSearchQuery(value)
            setVisibleCount(ITEMS_PER_BATCH)
          }}
          onStatusChange={(value) => {
            setStatusFilter(value)
            setVisibleCount(ITEMS_PER_BATCH)
          }}
          onRegionChange={(value) => {
            setRegionFilter(value)
            setVisibleCount(ITEMS_PER_BATCH)
          }}
          onToggleColumnMenu={() => setShowColumnMenu((value) => !value)}
          onToggleColumn={toggleColumn}
        />

        <div className="mb-4 text-sm text-foreground-muted">
          Показано {sortedVehicles.length} из {totalCount}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="mt-3 text-sm text-foreground-muted">Загрузка техники...</p>
          </div>
        ) : (
          <VehiclesTable
            vehicles={visibleVehicles}
            hiddenColumns={hiddenColumns}
            sortConfig={sortConfig}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onInspect={(vehicle) => {
              setSelectedVehicleForInspection(vehicle)
              setShowNewInspectionModal(true)
            }}
          />
        )}

        {hasMoreVehicles ? (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setVisibleCount((value) => Math.min(value + ITEMS_PER_BATCH, sortedVehicles.length))}
              className="btn btn-secondary"
            >
              Загрузить ещё
            </button>
          </div>
        ) : null}

        {showAddModal ? (
          <VehicleModal title="Добавить технику" onClose={closeVehicleModal}>
            <VehicleForm
              mode="create"
              regions={regions}
              formData={formData}
              formError={formError}
              saving={saving}
              onChange={setFormData}
              onSubmit={handleAdd}
              onCancel={closeVehicleModal}
            />
          </VehicleModal>
        ) : null}

        {editingVehicle ? (
          <VehicleModal title="Редактировать технику" onClose={closeVehicleModal}>
            <VehicleForm
              mode="edit"
              regions={regions}
              formData={formData}
              formError={formError}
              saving={saving}
              onChange={setFormData}
              onSubmit={handleUpdate}
              onCancel={closeVehicleModal}
            />
          </VehicleModal>
        ) : null}

        {showNewInspectionModal && selectedVehicleForInspection ? (
          <NewInspectionModal
            open
            vehicle={selectedVehicleForInspection}
            vehicles={vehicles}
            onClose={() => {
              setShowNewInspectionModal(false)
              setSelectedVehicleForInspection(null)
            }}
          />
        ) : null}
      </div>
    </Layout>
  )
}

function VehiclesFilters({
  searchQuery,
  statusFilter,
  regionFilter,
  regions,
  hiddenColumns,
  showColumnMenu,
  onSearchChange,
  onStatusChange,
  onRegionChange,
  onToggleColumnMenu,
  onToggleColumn,
}: {
  searchQuery: string
  statusFilter: string
  regionFilter: string
  regions: RegionRecord[]
  hiddenColumns: string[]
  showColumnMenu: boolean
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onRegionChange: (value: string) => void
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

        <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className="select w-auto min-w-[180px]">
          <option value="">Все статусы</option>
          <option value="active">В работе</option>
          <option value="repair">Ремонт</option>
        </select>

        <select value={regionFilter} onChange={(event) => onRegionChange(event.target.value)} className="select w-auto min-w-[190px]">
          <option value="">Все регионы</option>
          {regions.map((region) => (
            <option key={region.id} value={region.name}>
              {region.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <button onClick={onToggleColumnMenu} className="btn btn-secondary" type="button">
            Столбцы
          </button>
          {showColumnMenu ? (
            <div className="popover absolute right-0 top-full z-10 mt-2 min-w-[180px] p-2">
              {columns.map((column) => (
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

function VehiclesTable({
  vehicles,
  hiddenColumns,
  sortConfig,
  onSort,
  onEdit,
  onDelete,
  onInspect,
}: {
  vehicles: VehicleRecord[]
  hiddenColumns: string[]
  sortConfig: SortConfig
  onSort: (key: SortableVehicleKey) => void
  onEdit: (vehicle: VehicleRecord) => void
  onDelete: (id: string) => void
  onInspect: (vehicle: VehicleRecord) => void
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="min-w-full divide-y divide-line">
          <thead className="table-header">
            <tr>
              {columns.map((column) =>
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
                  onInspect={onInspect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-foreground-muted">
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

function VehicleRow({
  vehicle,
  hiddenColumns,
  onInspect,
  onEdit,
  onDelete,
}: {
  vehicle: VehicleRecord
  hiddenColumns: string[]
  onInspect: (vehicle: VehicleRecord) => void
  onEdit: (vehicle: VehicleRecord) => void
  onDelete: (id: string) => void
}) {
  return (
    <tr className="hover:bg-surface-hover">
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
        <button onClick={() => onInspect(vehicle)} className="mr-3 text-status-success hover:underline">
          Осмотр
        </button>
        <button onClick={() => onEdit(vehicle)} className="mr-3 text-primary hover:underline">
          Изменить
        </button>
        <button onClick={() => onDelete(vehicle.id)} className="text-status-danger hover:underline">
          Удалить
        </button>
      </td>
    </tr>
  )
}

function VehicleModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground" type="button">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function VehicleForm({
  mode,
  regions,
  formData,
  formError,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit'
  regions: RegionRecord[]
  formData: VehicleFormData
  formError: string
  saving: boolean
  onChange: (value: VehicleFormData) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        {formError ? <div className="alert-danger rounded-card px-4 py-3 text-sm">{formError}</div> : null}

        <div>
          <label className="label">Госномер</label>
          <input
            type="text"
            placeholder="Например A123BC77"
            value={formData.number}
            onChange={(event) => onChange({ ...formData, number: normalizeVehicleNumber(event.target.value) })}
            autoCapitalize="characters"
            inputMode="text"
            maxLength={9}
            spellCheck={false}
            className="input"
            required
          />
          <p className="mt-1 text-xs text-foreground-muted">{VEHICLE_NUMBER_HELP}</p>
        </div>

        <div>
          <label className="label">Название</label>
          <input
            type="text"
            placeholder="Название техники"
            value={formData.name}
            onChange={(event) => onChange({ ...formData, name: event.target.value })}
            className="input"
            required
          />
        </div>

        <div>
          <label className="label">Регион</label>
          <select value={formData.region} onChange={(event) => onChange({ ...formData, region: event.target.value })} className="select">
            <option value="">Не выбран</option>
            {regions.map((region) => (
              <option key={region.id} value={region.name}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Статус</label>
          <select value={formData.status} onChange={(event) => onChange({ ...formData, status: event.target.value })} className="select">
            <option value="active">В работе</option>
            <option value="repair">Ремонт</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Отмена
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
          {saving ? 'Сохранение...' : mode === 'create' ? 'Добавить' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
