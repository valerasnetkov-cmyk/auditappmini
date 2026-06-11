'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import NewInspectionModal from '@/components/NewInspectionModal'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import { NoticeCard, Skeleton, StatusButton } from '@/components/ui'
import api from '@/lib/api/client'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import { normalizeVehicleNumber } from '@/lib/vehicleNumber'
import type { VehicleRecord } from '@/lib/types'
import { useVehiclesList } from './_hooks/useVehiclesList'
import { INITIAL_FORM, type VehicleFormData } from './_lib/vehicles'
import { VehiclesFilters } from './_components/VehiclesFilters'
import { VehiclesTable } from './_components/VehiclesTable'
import { VehicleModal } from './_components/VehicleModal'
import { VehicleForm } from './_components/VehicleForm'

export default function VehiclesPage() {
  const searchParams = useSearchParams()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewInspectionModal, setShowNewInspectionModal] = useState(false)
  const [selectedVehicleForInspection, setSelectedVehicleForInspection] = useState<VehicleRecord | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null)
  const [formData, setFormData] = useState<VehicleFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [showColumnMenu, setShowColumnMenu] = useState(false)

  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage()
  const list = useVehiclesList()
  const {
    state: { vehicles, regions, loading, searchQuery, statusFilter, error, sortConfig, visibleVehicles, hasMoreVehicles, totalCount },
    actions: { setError, setSearchQuery, setStatusFilter, setRegionFilter, handleSort, loadMore, reload },
  } = list

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

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '')
    setStatusFilter(searchParams.get('status') || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const selectedVehicleIdsSet = useMemo(() => new Set(selectedVehicleIds), [selectedVehicleIds])
  const selectableVisibleVehicleIds = visibleVehicles.filter((vehicle) => vehicle.status !== 'archived').map((vehicle) => vehicle.id)
  const allVisibleSelected = selectableVisibleVehicleIds.length > 0 && selectableVisibleVehicleIds.every((id) => selectedVehicleIdsSet.has(id))

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
      await reload()
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
      await reload()
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
    await reload()
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

  const toggleColumn = (column: string) => {
    setHiddenColumns((current) => (current.includes(column) ? current.filter((item) => item !== column) : [...current, column]))
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
          <div className="mb-4">
            <NoticeCard title="Создание техники временно недоступно" tone="warning" compact>{createRestrictionMessage}</NoticeCard>
          </div>
        ) : null}

        {error ? <div className="mb-4"><NoticeCard title="Не удалось выполнить действие" tone="danger" compact>{error}</NoticeCard></div> : null}

        <VehiclesFilters
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          regionFilter={list.state.regionFilter}
          regions={regions}
          hiddenColumns={hiddenColumns}
          showColumnMenu={showColumnMenu}
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
          onRegionChange={setRegionFilter}
          onToggleColumnMenu={() => setShowColumnMenu((value) => !value)}
          onToggleColumn={toggleColumn}
        />

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-foreground-muted">
            Показано {visibleVehicles.length} из {totalCount}
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
          <div className="table-card space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
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
            <StatusButton
              onClick={loadMore}
              className="btn btn-secondary"
            >
              Загрузить ещё
            </StatusButton>
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
