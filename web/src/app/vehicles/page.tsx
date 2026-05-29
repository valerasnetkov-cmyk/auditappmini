'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import NewInspectionModal from '@/components/NewInspectionModal'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
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
  if (status === 'archived') return 'Архив'
  return status || 'Не указано'
}

function getStatusBadgeClass(status: string) {
  if (status === 'repair') return 'badge badge-warning'
  if (status === 'archived') return 'badge badge-secondary'
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
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage()
  const createRestriction = getCompanyOperationRestriction(companyUsage, 'create')
  const writeRestriction = getCompanyOperationRestriction(companyUsage, 'write')
  const createRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Создание техники станет доступно после проверки.'
    : createRestriction
      ? `${createRestriction.title}: ${createRestriction.message}`
      : ''
  const writeRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Изменения станут доступны после проверки.'
    : writeRestriction
      ? `${writeRestriction.title}: ${writeRestriction.message}`
      : ''

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

  useEffect(() => {
    const availableIds = new Set(vehicles.map((vehicle) => vehicle.id))
    setSelectedVehicleIds((current) => current.filter((id) => availableIds.has(id)))
  }, [vehicles])

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
  const selectedVehicleIdsSet = useMemo(() => new Set(selectedVehicleIds), [selectedVehicleIds])
  const selectableVisibleVehicleIds = visibleVehicles.filter((vehicle) => vehicle.status !== 'archived').map((vehicle) => vehicle.id)
  const allVisibleSelected = selectableVisibleVehicleIds.length > 0 && selectableVisibleVehicleIds.every((id) => selectedVehicleIdsSet.has(id))

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
    if (companyUsageLoading) {
      setFormError('Проверяем статус тарифа компании. Повторите добавление через несколько секунд.')
      return
    }

    if (createRestriction) {
      setFormError(`${createRestriction.title}: ${createRestriction.message}`)
      return
    }

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
    setFormError(writeRestrictionMessage)
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingVehicle) return
    if (companyUsageLoading) {
      setFormError('Проверяем статус тарифа компании. Повторите сохранение через несколько секунд.')
      return
    }

    if (writeRestriction) {
      setFormError(`${writeRestriction.title}: ${writeRestriction.message}`)
      return
    }

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

  const toggleVehicleSelection = (id: string) => {
    setSelectedVehicleIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      setSelectedVehicleIds((current) => current.filter((id) => !selectableVisibleVehicleIds.includes(id)))
      return
    }

    setSelectedVehicleIds((current) => [...new Set([...current, ...selectableVisibleVehicleIds])])
  }

  const clearSelection = () => {
    setSelectedVehicleIds([])
  }

  const handleArchiveVehicles = async (ids: string[]) => {
    const archiveIds = [...new Set(ids)].filter(Boolean)
    if (archiveIds.length === 0) return
    if (companyUsageLoading) {
      setError('Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
      return
    }

    if (writeRestriction) {
      setError(`${writeRestriction.title}: ${writeRestriction.message}`)
      return
    }

    if (!confirm(`Переместить в архив выбранную технику (${archiveIds.length})?`)) return

    const result = await api.archiveVehicles(archiveIds)
    if (result.error) {
      setError(result.error)
      return
    }

    setSelectedVehicleIds((current) => current.filter((id) => !archiveIds.includes(id)))
    await loadData()
  }

  const openAddModal = () => {
    resetForm()
    if (companyUsageLoading) {
      setFormError('Проверяем статус тарифа компании. Создание техники станет доступно после проверки.')
    } else if (createRestriction) {
      setFormError(`${createRestriction.title}: ${createRestriction.message}`)
    }
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
            {createRestrictionMessage ? (
              <button type="button" disabled className="btn btn-secondary disabled:opacity-50">
                Полная форма
              </button>
            ) : (
              <Link href="/vehicles/new" className="btn btn-secondary">
                Полная форма
              </Link>
            )}
            <button onClick={openAddModal} disabled={Boolean(createRestrictionMessage)} className="btn btn-primary disabled:opacity-50">
              + Добавить
            </button>
          </div>
        </header>

        <SubscriptionStatusBanner usage={companyUsage} compact />

        {createRestrictionMessage ? (
          <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">
            {createRestrictionMessage}
          </div>
        ) : null}

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

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-foreground-muted">
            Показано {sortedVehicles.length} из {totalCount}
          </div>
          {selectedVehicleIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface-soft px-4 py-3 text-sm">
              <span className="font-medium text-foreground">Выбрано: {selectedVehicleIds.length}</span>
              <button type="button" onClick={() => void handleArchiveVehicles(selectedVehicleIds)} disabled={Boolean(writeRestrictionMessage)} className="btn btn-secondary btn-sm disabled:opacity-50">
                В архив
              </button>
              <button type="button" onClick={clearSelection} className="text-foreground-muted hover:text-foreground">
                Снять выделение
              </button>
            </div>
          ) : null}
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
            selectedIds={selectedVehicleIdsSet}
            allVisibleSelected={allVisibleSelected}
            actionsDisabled={Boolean(writeRestrictionMessage)}
            createActionsDisabled={Boolean(createRestrictionMessage)}
            onSort={handleSort}
            onEdit={handleEdit}
            onArchive={(id) => void handleArchiveVehicles([id])}
            onToggleSelected={toggleVehicleSelection}
            onToggleAllVisible={toggleVisibleSelection}
            onInspect={(vehicle) => {
              if (createRestrictionMessage) return
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
              restrictionMessage={createRestrictionMessage}
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
              restrictionMessage={writeRestrictionMessage}
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
          <option value="archived">Архив</option>
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
  selectedIds,
  allVisibleSelected,
  actionsDisabled,
  createActionsDisabled,
  onSort,
  onEdit,
  onArchive,
  onToggleSelected,
  onToggleAllVisible,
  onInspect,
}: {
  vehicles: VehicleRecord[]
  hiddenColumns: string[]
  sortConfig: SortConfig
  selectedIds: Set<string>
  allVisibleSelected: boolean
  actionsDisabled: boolean
  createActionsDisabled: boolean
  onSort: (key: SortableVehicleKey) => void
  onEdit: (vehicle: VehicleRecord) => void
  onArchive: (id: string) => void
  onToggleSelected: (id: string) => void
  onToggleAllVisible: () => void
  onInspect: (vehicle: VehicleRecord) => void
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
                  selected={selectedIds.has(vehicle.id)}
                  actionsDisabled={actionsDisabled}
                  createActionsDisabled={createActionsDisabled}
                  onInspect={onInspect}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onToggleSelected={onToggleSelected}
                />
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-foreground-muted">
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
  restrictionMessage = '',
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit'
  regions: RegionRecord[]
  formData: VehicleFormData
  formError: string
  restrictionMessage?: string
  saving: boolean
  onChange: (value: VehicleFormData) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        {formError ? <div className="alert-danger rounded-card px-4 py-3 text-sm">{formError}</div> : null}
        {restrictionMessage ? <div className="alert-danger rounded-card px-4 py-3 text-sm">{restrictionMessage}</div> : null}

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
            {mode === 'edit' ? <option value="archived">Архив</option> : null}
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Отмена
        </button>
        <button type="submit" disabled={saving || Boolean(restrictionMessage)} className="btn btn-primary disabled:opacity-50">
          {saving ? 'Сохранение...' : mode === 'create' ? 'Добавить' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
