'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import type { InspectionDetail, PhotoRecord, PhotoRequirementsResponse } from '@/lib/types'

import AccidentCard from './AccidentCard'
import ChecklistSection from './ChecklistSection'
import DefectsList from './DefectsList'
import InspectionHeader from './InspectionHeader'
import InspectionStats from './InspectionStats'
import OdometerCard from './OdometerCard'
import PhotoRequirementsSection from './PhotoRequirementsSection'
import StatusBanner from './StatusBanner'
import WarningsBanner from './WarningsBanner'
import type { ChecklistItem, StatusTone } from '../_lib/checklist'

export type InspectionBodyProps = {
  inspection: InspectionDetail
  checklist: ChecklistItem[]
  defectPhotos: Record<string, PhotoRecord[]>
  inspectionPhotos: Record<string, PhotoRecord[]>
  photoRequirements: PhotoRequirementsResponse | null
  accidentOccurredAt: string
  setAccidentOccurredAt: (value: string) => void
  accidentLocation: string
  setAccidentLocation: (value: string) => void
  odometerValue: string
  setOdometerValue: (value: string) => void
  odometerUnit: string
  setOdometerUnit: (value: string) => void
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
  onPrint: () => void
  onError: (tone: StatusTone, message: string) => void
}

export default function InspectionDetailBody(props: InspectionBodyProps) {
  const mutationsDisabled = Boolean(props.writeRestrictionMessage)
  const warnings: string[] = []
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

  const showError = (message: string) => props.onError('error', message)

  return (
    <Layout currentPage="inspections">
      <div className="p-6">
        <InspectionHeader inspection={props.inspection} onPrint={props.onPrint} />

        <StatusBanner message={props.statusMessage} tone={props.statusTone} />

        <SubscriptionStatusBanner usage={props.companyUsage} compact />

        {props.writeRestrictionMessage ? (
          <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {props.writeRestrictionMessage}
          </div>
        ) : null}

        {warnings.length > 0 && !props.inspection.completed ? (
          <WarningsBanner warnings={warnings} />
        ) : null}

        <InspectionStats inspection={props.inspection} />

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          {props.inspection.type === 'accident' ? (
            <AccidentCard
              inspection={props.inspection}
              accidentOccurredAt={props.accidentOccurredAt}
              setAccidentOccurredAt={props.setAccidentOccurredAt}
              accidentLocation={props.accidentLocation}
              setAccidentLocation={props.setAccidentLocation}
              disabled={mutationsDisabled}
            />
          ) : props.inspection.type === 'quick' || props.inspection.type === 'scheduled' ? (
            <OdometerCard
              odometerValue={props.odometerValue}
              setOdometerValue={props.setOdometerValue}
              odometerUnit={props.odometerUnit}
              setOdometerUnit={props.setOdometerUnit}
              disabled={mutationsDisabled}
            />
          ) : null}

          {props.photoRequirements ? (
            <PhotoRequirementsSection
              requirements={props.photoRequirements}
              inspectionPhotos={props.inspectionPhotos}
              uploadingPhoto={props.uploadingPhoto}
              deletingPhoto={props.deletingPhoto}
              onUpload={(photoType, file) =>
                void props.onInspectionPhotoUpload(photoType, file, showError)
              }
              onDelete={(photoType, photoIndex) => {
                const photo = props.inspectionPhotos[photoType]?.[photoIndex]
                void props.onInspectionPhotoDelete(photoType, photo?.id, photoIndex, showError)
              }}
              disabled={mutationsDisabled}
            />
          ) : null}

          <ChecklistSection
            type={props.inspection.type}
            checklist={props.checklist}
            inspection={props.inspection}
            defectPhotos={props.defectPhotos}
            uploadingPhoto={props.uploadingPhoto}
            deletingPhoto={props.deletingPhoto}
            disabled={mutationsDisabled}
            onResultChange={props.onResultChange}
            onCommentChange={props.onCommentChange}
            onPhotoUpload={(defectTitle, file) =>
              void props.onPhotoUpload(defectTitle, file, showError)
            }
            onPhotoDelete={(defectTitle, photoIndex) => {
              const photo = props.defectPhotos[defectTitle]?.[photoIndex]
              void props.onPhotoDelete(defectTitle, photo?.id, photoIndex, showError)
            }}
          />
        </div>

        <DefectsList inspection={props.inspection} />

        <div className="flex justify-end gap-3">
          <Link href="/inspections" className="rounded-lg border px-6 py-2 hover:bg-slate-50">
            Назад
          </Link>
          <button
            onClick={props.onSave}
            disabled={props.saving || mutationsDisabled}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {props.saving ? 'Сохранение...' : 'Сохранить осмотр'}
          </button>
          {!props.inspection.completed ? (
            <button
              onClick={props.onComplete}
              disabled={
                props.saving ||
                warnings.length > 0 ||
                !props.photoRequirements ||
                mutationsDisabled
              }
              className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Завершить осмотр
            </button>
          ) : null}
        </div>
      </div>
    </Layout>
  )
}
