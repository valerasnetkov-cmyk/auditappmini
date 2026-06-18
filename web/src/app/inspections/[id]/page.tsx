'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import type { InspectionReport } from '@/lib/types'
import type { AuthUser, InspectionApproval } from '@/lib/types'
import { isManagerRole } from '@/lib/auth'

import { useStatus } from './_hooks/useStatus'
import { useInspection } from './_hooks/useInspection'
import { useChecklist } from './_hooks/useChecklist'
import { useAccidentFields } from './_hooks/useAccidentFields'
import { useOdometer } from './_hooks/useOdometer'
import { usePhotoUpload } from './_hooks/usePhotoUpload'

import InspectionDetailBody from './_components/InspectionDetailBody'

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>()
  const inspectionId = params.id
  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage()
  const writeRestriction = getCompanyOperationRestriction(companyUsage, 'write')
  const writeRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Изменения станут доступны после проверки.'
    : writeRestriction
      ? `${writeRestriction.title}: ${writeRestriction.message}`
      : ''

  const { statusMessage, statusTone, show: showStatus, clear: clearStatus } = useStatus()
  const { inspection, loading, error, isNewInspection, photoRequirements, readiness, reload } =
    useInspection(inspectionId)
  const { checklist, setResult, setComment } = useChecklist(inspection)
  const { accidentOccurredAt, setAccidentOccurredAt, accidentLocation, setAccidentLocation } =
    useAccidentFields(inspection)
  const {
    odometerValue,
    setOdometerValue,
    odometerUnit,
    setOdometerUnit,
    odometerUnavailableReason,
    setOdometerUnavailableReason,
  } = useOdometer(inspection)
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
  const [report, setReport] = useState<InspectionReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [approval, setApproval] = useState<InspectionApproval | null>(null)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    void api.getMe().then((result) => {
      if (result.data) setCurrentUser(result.data)
    })
  }, [])

  useEffect(() => {
    if (!inspection?.completed) return
    void Promise.all([
      api.getInspectionReport(inspection.id),
      api.getInspectionApproval(inspection.id),
    ]).then(([reportResult, approvalResult]) => {
      if (reportResult.data) setReport(reportResult.data)
      if (approvalResult.data) setApproval(approvalResult.data)
    })
  }, [inspection?.completed, inspection?.id])

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
          odometerValue && odometerUnit
            ? odometerUnit
            : undefined,
        odometer_unavailable_reason:
          inspection.type === 'accident' && !odometerValue
            ? odometerUnavailableReason.trim()
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
        const details = result.missing?.length
          ? `: ${result.missing.map((item) => item.label).join(', ')}`
          : ''
        showStatus('error', `${result.error}${details}`)
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

  const handleCreateDefect = async (data: {
    title: string
    comment: string
    severity: string
  }) => {
    if (!inspection || !guardWrite()) return
    setSaving(true)
    clearStatus()
    try {
      const result = await api.createDefect(inspection.id, data)
      if (result.error) {
        showStatus('error', result.error)
        return
      }
      await reload()
      showStatus('success', 'Дефект добавлен')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!inspection) return
    setReportLoading(true)
    clearStatus()
    try {
      const result = await api.createInspectionReport(inspection.id)
      if (result.error || !result.data) {
        showStatus('error', result.error || 'Не удалось сформировать отчёт')
        return
      }
      setReport(result.data)
      showStatus('success', 'PDF-отчёт сформирован')
    } finally {
      setReportLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!inspection) return
    setReportLoading(true)
    clearStatus()
    try {
      const result = await api.downloadInspectionReport(inspection.id)
      if (result.error || !result.data) {
        showStatus('error', result.error || 'Не удалось скачать отчёт')
        return
      }
      const url = URL.createObjectURL(result.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `inspection-${inspection.id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setReportLoading(false)
    }
  }

  const handleSubmitApproval = async (comment: string) => {
    if (!inspection || !guardWrite()) return
    setApprovalLoading(true)
    clearStatus()
    try {
      const result = await api.submitInspection(inspection.id, comment)
      if (result.error || !result.data) {
        showStatus('error', result.error || 'Не удалось отправить осмотр')
        return
      }
      setApproval(result.data)
      showStatus('success', 'Осмотр отправлен на согласование')
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleReviewApproval = async (
    status: 'approved' | 'rejected' | 'revision_required',
    comment: string,
  ) => {
    if (!inspection || !guardWrite()) return
    setApprovalLoading(true)
    clearStatus()
    try {
      const result = await api.reviewInspection(inspection.id, status, comment)
      if (result.error || !result.data) {
        showStatus('error', result.error || 'Не удалось сохранить решение')
        return
      }
      setApproval(result.data)
      showStatus('success', status === 'approved' ? 'Осмотр согласован' : 'Решение сохранено')
    } finally {
      setApprovalLoading(false)
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
      <Layout currentPage="inspections">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="card max-w-xl p-8 text-center">
            <h1 className="text-xl font-semibold text-foreground">Осмотр проводится только в мобильном приложении</h1>
            <p className="mt-3 text-sm leading-6 text-foreground-secondary">
              Web-панель не создаёт и не проводит осмотры. Используйте мобильное приложение AuditAvto:
              инспектор, менеджер или владелец компании фиксирует живые фото камерой устройства.
            </p>
            <Link href="/inspections" className="btn btn-primary mt-6">
              Вернуться к журналу осмотров
            </Link>
          </div>
        </div>
      </Layout>
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
      readiness={readiness}
      report={report}
      reportLoading={reportLoading}
      approval={approval}
      approvalLoading={approvalLoading}
      canReviewApproval={isManagerRole(currentUser?.role)}
      accidentOccurredAt={accidentOccurredAt}
      setAccidentOccurredAt={setAccidentOccurredAt}
      accidentLocation={accidentLocation}
      setAccidentLocation={setAccidentLocation}
      odometerValue={odometerValue}
      setOdometerValue={setOdometerValue}
      odometerUnit={odometerUnit}
      setOdometerUnit={setOdometerUnit}
      odometerUnavailableReason={odometerUnavailableReason}
      setOdometerUnavailableReason={setOdometerUnavailableReason}
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
      onCreateDefect={handleCreateDefect}
      onGenerateReport={() => void handleGenerateReport()}
      onDownloadReport={() => void handleDownloadReport()}
      onSubmitApproval={handleSubmitApproval}
      onReviewApproval={handleReviewApproval}
      onError={showStatus}
    />
  )
}
