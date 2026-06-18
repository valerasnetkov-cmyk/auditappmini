'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import type {
  InspectionDetail,
  InspectionApproval,
  InspectionReadiness,
  InspectionReport,
  PhotoRecord,
  PhotoRequirementsResponse,
} from '@/lib/types'

import AccidentCard from './AccidentCard'
import ChecklistSection from './ChecklistSection'
import DefectsList from './DefectsList'
import InspectionHeader from './InspectionHeader'
import InspectionApprovalCard from './InspectionApprovalCard'
import InspectionStats from './InspectionStats'
import OdometerCard from './OdometerCard'
import PhotoRequirementsSection from './PhotoRequirementsSection'
import StatusBanner from './StatusBanner'
import WarningsBanner from './WarningsBanner'
import type { ChecklistItem, StatusTone } from '../_lib/checklist'
import { NoticeCard, Stepper, type StepItem } from '@/components/ui'

export type InspectionBodyProps = {
  inspection: InspectionDetail
  checklist: ChecklistItem[]
  defectPhotos: Record<string, PhotoRecord[]>
  inspectionPhotos: Record<string, PhotoRecord[]>
  photoRequirements: PhotoRequirementsResponse | null
  readiness: InspectionReadiness | null
  report: InspectionReport | null
  reportLoading: boolean
  approval: InspectionApproval | null
  approvalLoading: boolean
  canReviewApproval: boolean
  accidentOccurredAt: string
  setAccidentOccurredAt: (value: string) => void
  accidentLocation: string
  setAccidentLocation: (value: string) => void
  odometerValue: string
  setOdometerValue: (value: string) => void
  odometerUnit: string
  setOdometerUnit: (value: string) => void
  odometerUnavailableReason: string
  setOdometerUnavailableReason: (value: string) => void
  uploadingPhoto: string | null
  deletingPhoto: string | null
  saving: boolean
  statusMessage: string
  statusTone: StatusTone
  companyUsage: ReturnType<typeof useCompanyUsage>['usage']
  writeRestrictionMessage: string
  onResultChange: (index: number, result: boolean) => void
  onCommentChange: (index: number, comment: string) => void
  onPhotoUpload: (
    defectTitle: string,
    file: File,
    onError?: (message: string) => void,
  ) => Promise<void>
  onInspectionPhotoUpload: (
    photoType: string,
    file: File,
    onError?: (message: string) => void,
  ) => Promise<void>
  onPhotoDelete: (
    defectTitle: string,
    photoId: string | undefined,
    photoIndex: number,
    onError?: (message: string) => void,
  ) => Promise<void>
  onInspectionPhotoDelete: (
    photoType: string,
    photoId: string | undefined,
    photoIndex: number,
    onError?: (message: string) => void,
  ) => Promise<void>
  onSave: () => void
  onComplete: () => void
  onCreateDefect: (data: { title: string; comment: string; severity: string }) => Promise<void>
  onGenerateReport: () => void
  onDownloadReport: () => void
  onSubmitApproval: (comment: string) => Promise<void>
  onReviewApproval: (
    status: 'approved' | 'rejected' | 'revision_required',
    comment: string,
  ) => Promise<void>
  onError: (tone: StatusTone, message: string) => void
}

export default function InspectionDetailBody(props: InspectionBodyProps) {
  const mutationsDisabled = Boolean(props.writeRestrictionMessage)
  const inspectionEditingDisabled = true
  const warnings: string[] = props.readiness?.missing.map((item) => item.label) || []
  if (props.inspection.type === 'accident') {
    if (!props.accidentOccurredAt.trim()) warnings.push('Укажите время ДТП')
    if (!props.accidentLocation.trim()) warnings.push('Укажите место ДТП')
  }
  if (
    (props.inspection.type === 'quick' || props.inspection.type === 'scheduled') &&
    !props.odometerValue.trim()
  ) {
    warnings.push('Укажите пробег')
  }
  props.photoRequirements?.requirements.required.forEach((photoType) => {
    if ((props.inspectionPhotos[photoType] || []).length === 0) {
      warnings.push(
        `Добавьте обязательное фото: ${props.photoRequirements!.labels[photoType] || photoType}`,
      )
    }
  })
  props.checklist
    .filter((item) => !item.result)
    .forEach((item) => {
      const photos = props.defectPhotos[item.title] || []
      if (photos.length === 0) warnings.push(`Добавьте фото дефекта: ${item.title}`)
    })

  const uniqueWarnings = [...new Set(warnings)]
  const requiredPhotosComplete = Boolean(
    props.photoRequirements &&
    props.photoRequirements.requirements.required.every(
      (photoType) => (props.inspectionPhotos[photoType] || []).length > 0,
    ),
  )
  const defectEvidenceComplete = props.checklist
    .filter((item) => !item.result)
    .every((item) => (props.defectPhotos[item.title] || []).length > 0)
  const measurementComplete = props.inspection.type === 'accident'
    ? Boolean(props.accidentOccurredAt.trim() && props.accidentLocation.trim())
    : Boolean(props.odometerValue.trim())
  const readyStates = [
    true,
    true,
    requiredPhotosComplete,
    props.checklist.length > 0,
    defectEvidenceComplete,
    measurementComplete,
    uniqueWarnings.length === 0,
  ]
  const firstIncompleteStep = readyStates.findIndex((ready) => !ready)
  const activeStep = props.inspection.completed
    ? readyStates.length
    : firstIncompleteStep === -1
      ? readyStates.length - 1
      : firstIncompleteStep
  const stepLabels = [
    ['Техника', 'Автомобиль выбран'],
    ['Тип осмотра', 'Сценарий определён'],
    ['Фото', 'Обязательные ракурсы'],
    ['Чек-лист', 'Состояние узлов'],
    ['Дефекты', 'Фото и комментарии'],
    [props.inspection.type === 'accident' ? 'ДТП' : 'Одометр', 'Подтверждающие данные'],
    ['Отчёт', 'Готовность к завершению'],
  ]
  const inspectionSteps: StepItem[] = stepLabels.map(([label, description], index) => ({
    label,
    description,
    state: props.inspection.completed || index < activeStep
      ? 'complete'
      : index === activeStep
        ? 'active'
        : 'pending',
  }))

  return (
    <Layout currentPage="inspections">
      <div className="p-6">
        <InspectionHeader
          inspection={props.inspection}
          report={props.report}
          reportLoading={props.reportLoading}
          onGenerateReport={props.onGenerateReport}
          onDownloadReport={props.onDownloadReport}
        />

        <StatusBanner message={props.statusMessage} tone={props.statusTone} />

        <SubscriptionStatusBanner usage={props.companyUsage} compact />

        {props.writeRestrictionMessage ? (
          <div className="mb-4"><NoticeCard title="Редактирование ограничено" tone="warning" compact>{props.writeRestrictionMessage}</NoticeCard></div>
        ) : null}

        <div className="mb-4">
          <NoticeCard title="Осмотр проводится только с мобильного устройства" tone="info" compact>
            Веб-панель показывает историю, доказательства, readiness и отчёты. Проведение осмотра,
            изменение чек-листа, фиксация пробега и добавление живых фото доступны только в мобильном приложении.
          </NoticeCard>
        </div>

        {uniqueWarnings.length > 0 && !props.inspection.completed ? (
          <WarningsBanner warnings={uniqueWarnings} />
        ) : null}

        {props.inspection.completed && props.approval ? (
          <InspectionApprovalCard
            approval={props.approval}
            canReview={props.canReviewApproval}
            loading={props.approvalLoading}
            disabled={mutationsDisabled}
            onSubmit={props.onSubmitApproval}
            onReview={props.onReviewApproval}
          />
        ) : null}

        <section className="card mb-6 p-5">
          <Stepper steps={inspectionSteps} label="Этапы осмотра" />
        </section>

        <InspectionStats inspection={props.inspection} />

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          {props.inspection.type === 'accident' ? (
            <AccidentCard
              inspection={props.inspection}
              accidentOccurredAt={props.accidentOccurredAt}
              setAccidentOccurredAt={props.setAccidentOccurredAt}
              accidentLocation={props.accidentLocation}
              setAccidentLocation={props.setAccidentLocation}
              odometerUnavailableReason={props.odometerUnavailableReason}
              setOdometerUnavailableReason={props.setOdometerUnavailableReason}
              disabled={inspectionEditingDisabled}
            />
          ) : props.inspection.type === 'quick' || props.inspection.type === 'scheduled' ? (
            <OdometerCard
              odometerValue={props.odometerValue}
              setOdometerValue={props.setOdometerValue}
              odometerUnit={props.odometerUnit}
              setOdometerUnit={props.setOdometerUnit}
              disabled={inspectionEditingDisabled}
            />
          ) : null}

          {props.photoRequirements ? (
            <PhotoRequirementsSection
              requirements={props.photoRequirements}
              inspectionPhotos={props.inspectionPhotos}
            />
          ) : null}

          <ChecklistSection
            type={props.inspection.type}
            checklist={props.checklist}
            inspection={props.inspection}
            defectPhotos={props.defectPhotos}
            disabled={mutationsDisabled}
            onResultChange={props.onResultChange}
            onCommentChange={props.onCommentChange}
            readOnly={inspectionEditingDisabled}
          />
        </div>

        <DefectsList
          inspection={props.inspection}
          disabled={inspectionEditingDisabled || mutationsDisabled || Boolean(props.inspection.completed)}
          saving={props.saving}
          onCreateDefect={props.onCreateDefect}
        />

        <div className="flex justify-end gap-3">
          <Link href="/inspections" className="rounded-lg border px-6 py-2 hover:bg-slate-50">
            Назад
          </Link>
        </div>
      </div>
    </Layout>
  )
}
