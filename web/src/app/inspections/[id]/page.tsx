'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import type { InspectionType } from '@/lib/types'

import { useStatus } from './_hooks/useStatus'
import { useInspection } from './_hooks/useInspection'
import { useChecklist } from './_hooks/useChecklist'
import { useAccidentFields } from './_hooks/useAccidentFields'
import { useOdometer } from './_hooks/useOdometer'
import { usePhotoUpload } from './_hooks/usePhotoUpload'
import { printIncidentCard } from './_lib/printIncidentCard'

import NewInspectionForm from './_components/NewInspectionForm'
import InspectionDetailBody from './_components/InspectionDetailBody'

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>()
  const inspectionId = params.id
  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage()
  const createRestriction = getCompanyOperationRestriction(companyUsage, 'create')
  const writeRestriction = getCompanyOperationRestriction(companyUsage, 'write')
  const writeRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Изменения станут доступны после проверки.'
    : writeRestriction
      ? `${writeRestriction.title}: ${writeRestriction.message}`
      : ''

  const { statusMessage, statusTone, show: showStatus, clear: clearStatus } = useStatus()
  const { inspection, loading, error, isNewInspection, photoRequirements, reload } =
    useInspection(inspectionId)
  const { checklist, setResult, setComment } = useChecklist(inspection)
  const { accidentOccurredAt, setAccidentOccurredAt, accidentLocation, setAccidentLocation } =
    useAccidentFields(inspection)
  const { odometerValue, setOdometerValue, odometerUnit, setOdometerUnit } = useOdometer(inspection)
  const {
    defectPhotos,
    inspectionPhotos,
    uploadingPhoto,
    deletingPhoto,
    uploadDefectPhoto,
    uploadInspectionPhoto,
    deleteDefectPhoto,
    deleteInspectionPhoto,
  } = usePhotoUpload(inspection)

  const [saving, setSaving] = useState(false)

  const guardWrite = (): boolean => {
    if (companyUsageLoading) {
      showStatus('error', 'Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
      return false
    }
    if (writeRestriction) {
      showStatus('error', `${writeRestriction.title}: ${writeRestriction.message}`)
      return false
    }
    return true
  }

  const handleCreate = async (
    vehicleId: string,
    type: InspectionType,
    accidentData?: { occurredAt?: string; location?: string },
  ) => {
    clearStatus()
    if (companyUsageLoading) {
      showStatus('error', 'Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
      return
    }
    if (createRestriction) {
      showStatus('error', `${createRestriction.title}: ${createRestriction.message}`)
      return
    }
    try {
      const result = await api.createInspection({
        vehicle_id: vehicleId,
        type,
        checklist: [],
        accident_occurred_at:
          type === 'accident' && accidentData?.occurredAt
            ? new Date(accidentData.occurredAt).toISOString()
            : undefined,
        accident_location:
          type === 'accident' ? accidentData?.location?.trim() : undefined,
      })
      if (result.error) {
        showStatus('error', result.error)
        return
      }
      if (result.data?.id) {
        window.location.href = `/inspections/${result.data.id}`
        return
      }
      showStatus('error', 'Не удалось создать осмотр')
    } catch {
      showStatus('error', 'Ошибка создания осмотра')
    }
  }

  const handleSave = async () => {
    if (!inspection) return
    clearStatus()
    if (!guardWrite()) return
    if (inspection.type === 'accident' && (!accidentOccurredAt.trim() || !accidentLocation.trim())) {
      showStatus('error', 'Для осмотра ДТП укажите время и место происшествия')
      return
    }
    setSaving(true)
    try {
      const result = await api.updateInspection(inspection.id, {
        checklist: checklist.map((item) => ({
          id: item.id,
          title: item.title,
          result: item.result,
          comment: item.comment,
        })),
        accident_occurred_at:
          inspection.type === 'accident' && accidentOccurredAt
            ? new Date(accidentOccurredAt).toISOString()
            : undefined,
        accident_location: inspection.type === 'accident' ? accidentLocation : undefined,
        odometer_value:
          (inspection.type === 'quick' || inspection.type === 'scheduled') && odometerValue
            ? parseInt(odometerValue, 10)
            : undefined,
        odometer_unit:
          (inspection.type === 'quick' || inspection.type === 'scheduled') && odometerUnit
            ? odometerUnit
            : undefined,
      })
      if (result.error) {
        showStatus('error', `Ошибка сохранения: ${result.error}`)
        return
      }
      await reload()
      showStatus('success', 'Осмотр сохранен')
    } catch {
      showStatus('error', 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!inspection) return
    clearStatus()
    if (!guardWrite()) return
    setSaving(true)
    try {
      const result = await api.completeInspection(inspection.id)
      if (result.error) {
        showStatus('error', result.error)
        return
      }
      await reload()
      showStatus('success', 'Осмотр завершён')
    } catch {
      showStatus('error', 'Ошибка завершения осмотра')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout currentPage="inspections">
        <div className="flex min-h-[60vh] items-center justify-center p-6 text-slate-500">
          Загрузка...
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout currentPage="inspections">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="text-center">
            <p className="mb-4 text-red-600">{error}</p>
            <Link href="/inspections" className="text-blue-600 hover:underline">
              Назад к осмотрам
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  if (isNewInspection) {
    return (
      <NewInspectionForm
        onCreate={handleCreate}
        statusMessage={statusMessage}
        statusTone={statusTone}
      />
    )
  }

  if (!inspection) {
    return (
      <Layout currentPage="inspections">
        <div className="flex min-h-[60vh] items-center justify-center p-6 text-slate-500">
          Осмотр не найден
        </div>
      </Layout>
    )
  }

  return (
    <InspectionDetailBody
      inspection={inspection}
      checklist={checklist}
      defectPhotos={defectPhotos}
      inspectionPhotos={inspectionPhotos}
      photoRequirements={photoRequirements}
      accidentOccurredAt={accidentOccurredAt}
      setAccidentOccurredAt={setAccidentOccurredAt}
      accidentLocation={accidentLocation}
      setAccidentLocation={setAccidentLocation}
      odometerValue={odometerValue}
      setOdometerValue={setOdometerValue}
      odometerUnit={odometerUnit}
      setOdometerUnit={setOdometerUnit}
      uploadingPhoto={uploadingPhoto}
      deletingPhoto={deletingPhoto}
      saving={saving}
      statusMessage={statusMessage}
      statusTone={statusTone}
      companyUsage={companyUsage}
      writeRestrictionMessage={writeRestrictionMessage}
      onResultChange={setResult}
      onCommentChange={setComment}
      onPhotoUpload={uploadDefectPhoto}
      onInspectionPhotoUpload={uploadInspectionPhoto}
      onPhotoDelete={deleteDefectPhoto}
      onInspectionPhotoDelete={deleteInspectionPhoto}
      onSave={handleSave}
      onComplete={handleComplete}
      onPrint={() => printIncidentCard(inspection)}
      onError={showStatus}
    />
  )
}
