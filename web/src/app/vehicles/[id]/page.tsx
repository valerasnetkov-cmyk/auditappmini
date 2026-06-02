'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import DefectsSection from './_components/DefectsSection'
import InspectionsHistory from './_components/InspectionsHistory'
import StatCard from './_components/StatCard'
import StatusHistory from './_components/StatusHistory'
import StatusModal from './_components/StatusModal'
import VehicleInfoCard from './_components/VehicleInfoCard'
import { getVehicleStatusBadgeClass, getVehicleStatusLabel } from './_lib/vehicleDetail'
import { useDefectActions } from './_hooks/useDefectActions'
import { useStatusModal } from './_hooks/useStatusModal'
import { useToast } from './_hooks/useToast'
import { useVehicleDetailData } from './_hooks/useVehicleDetailData'

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>()
  const vehicleId = params.id

  const data = useVehicleDetailData(vehicleId)
  const { toast, showToast } = useToast()
  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage()
  const createRestriction = getCompanyOperationRestriction(companyUsage, 'create')
  const writeRestriction = getCompanyOperationRestriction(companyUsage, 'write')
  const createRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Новый осмотр станет доступен после проверки.'
    : createRestriction
      ? `${createRestriction.title}: ${createRestriction.message}`
      : ''
  const writeRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Изменения станут доступны после проверки.'
    : writeRestriction
      ? `${writeRestriction.title}: ${writeRestriction.message}`
      : ''

  const guard = {
    loading: companyUsageLoading,
    restrictionTitle: writeRestriction?.title,
    restrictionMessage: writeRestriction?.message,
    setError: data.setError,
  }

  const defects = useDefectActions(guard)
  const statusModal = useStatusModal(guard)

  const closeDefect = (defectId: string) => void defects.closeDefect(defectId, data.reloadDefects, showToast)
  const reopenDefect = (defectId: string) => void defects.reopenDefect(defectId, data.reloadDefects, showToast)
  const handleStatusChange = () => {
    if (!data.vehicle) return
    void statusModal.handleStatusChange(
      data.vehicle,
      vehicleId,
      showToast,
      (next) => data.setVehicle(next),
      data.reloadHistory,
    )
  }

  if (data.loading) {
    return (
      <Layout currentPage="vehicles">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (data.error || !data.vehicle) {
    return (
      <Layout currentPage="vehicles">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="card max-w-lg p-8 text-center">
            <p className="mb-4 text-status-danger">{data.error || 'Техника не найдена'}</p>
            <Link href="/vehicles" className="text-primary hover:underline">
              Назад к списку техники
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const totalInspections = data.inspections.length
  const accidentCount = data.inspections.filter((inspection) => inspection.type === 'accident').length
  const totalDefects = data.inspections.reduce((sum, inspection) => sum + (inspection.defects_count || 0), 0)

  return (
    <Layout currentPage="vehicles">
      <div className="p-6">
        {toast ? <div className="toast toast-success">{toast}</div> : null}

        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/vehicles" className="mb-2 inline-block text-sm text-primary hover:underline">
              Назад к списку техники
            </Link>
            <h1 className="page-title text-2xl">{data.vehicle.number}</h1>
            <p className="mt-1 text-foreground-muted">{data.vehicle.name}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {createRestrictionMessage ? (
              <button type="button" disabled className="btn btn-primary disabled:opacity-50">
                Провести осмотр
              </button>
            ) : (
              <Link href={`/inspections/new?vehicle=${data.vehicle.id}`} className="btn btn-primary">
                Провести осмотр
              </Link>
            )}
            <button
              onClick={() => statusModal.openStatusModal(data.vehicle?.status || '')}
              disabled={Boolean(writeRestrictionMessage)}
              className={`${getVehicleStatusBadgeClass(data.vehicle.status)} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {getVehicleStatusLabel(data.vehicle.status)}
            </button>
          </div>
        </header>

        <SubscriptionStatusBanner usage={companyUsage} compact />

        {createRestrictionMessage || writeRestrictionMessage ? (
          <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">
            {createRestrictionMessage || writeRestrictionMessage}
          </div>
        ) : null}

        {data.error ? <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">{data.error}</div> : null}

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Всего осмотров" value={totalInspections} tone="info" />
          <StatCard
            label="Текущий статус"
            value={getVehicleStatusLabel(data.vehicle.status)}
            tone={data.vehicle.status === 'repair' ? 'warning' : 'success'}
          />
          <StatCard label="Осмотров типа ДТП" value={accidentCount} tone="danger" />
          <StatCard label="Всего дефектов" value={totalDefects} tone="warning" />
        </section>

        <VehicleInfoCard vehicle={data.vehicle} />
        <InspectionsHistory inspections={data.inspections} />
        <DefectsSection
          defects={data.defects}
          defectHistories={defects.defectHistories}
          defectHistoriesVisible={defects.defectHistoriesVisible}
          actionsDisabled={Boolean(writeRestrictionMessage)}
          onCloseDefect={closeDefect}
          onReopenDefect={reopenDefect}
          onToggleHistory={defects.toggleDefectHistory}
        />
        <StatusHistory history={data.history} />
      </div>

      {statusModal.showStatusModal ? (
        <StatusModal
          vehicleStatus={data.vehicle.status}
          newStatus={statusModal.newStatus}
          statusReason={statusModal.statusReason}
          updating={statusModal.updating}
          onNewStatusChange={statusModal.setNewStatus}
          onReasonChange={statusModal.setStatusReason}
          onClose={statusModal.closeStatusModal}
          onSave={handleStatusChange}
        />
      ) : null}
    </Layout>
  )
}
