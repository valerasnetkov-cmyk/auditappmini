'use client'

import { groupChecklist, type ChecklistItem } from '../_lib/checklist'
import type { InspectionDetail, InspectionType, PhotoRecord } from '@/lib/types'
import DefectItem from './DefectItem'

export default function ChecklistSection({
  type,
  checklist,
  inspection,
  defectPhotos,
  uploadingPhoto,
  deletingPhoto,
  disabled,
  onResultChange,
  onCommentChange,
  onPhotoUpload,
  onPhotoDelete,
}: {
  type: InspectionType
  checklist: ChecklistItem[]
  inspection: InspectionDetail
  defectPhotos: Record<string, PhotoRecord[]>
  uploadingPhoto: string | null
  deletingPhoto: string | null
  disabled: boolean
  onResultChange: (index: number, result: boolean) => void
  onCommentChange: (index: number, comment: string) => void
  onPhotoUpload: (defectTitle: string, file: File) => void
  onPhotoDelete: (defectTitle: string, photoIndex: number) => void
}) {
  const grouped = groupChecklist(type, checklist)
  const defectsCount = checklist.filter((item) => !item.result).length

  return (
    <>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Чек-лист осмотра
        {defectsCount > 0 ? (
          <span className="ml-2 text-sm text-red-600">({defectsCount} деф.)</span>
        ) : null}
      </h2>

      <div className="space-y-5">
        {Object.entries(grouped).map(([section, sectionItems]) => (
          <section key={section} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold text-slate-900">{section}</h3>
            <div className="space-y-3">
              {sectionItems.map((item) => {
                const existingDefect = inspection.defects.find(
                  (defect) => defect.title === item.title,
                )
                const photos = defectPhotos[item.title] || []

                return (
                  <DefectItem
                    key={item.title}
                    item={item}
                    existingDefect={existingDefect}
                    photos={photos}
                    uploading={uploadingPhoto === item.title}
                    deletingPhotoKey={deletingPhoto}
                    disabled={disabled}
                    onResultChange={onResultChange}
                    onCommentChange={onCommentChange}
                    onPhotoUpload={onPhotoUpload}
                    onPhotoDelete={onPhotoDelete}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
