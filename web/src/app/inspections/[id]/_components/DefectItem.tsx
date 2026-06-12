'use client'

import Image from 'next/image'
import Link from 'next/link'
import { buildApiUrl } from '@/lib/api/client'
import { getPhotoPreviewUrl, getPhotoThumbUrl, type ChecklistItem } from '../_lib/checklist'
import type { InspectionDetail, PhotoRecord } from '@/lib/types'

export default function DefectItem({
  item,
  existingDefect,
  photos,
  uploading,
  deletingPhotoKey,
  disabled,
  onResultChange,
  onCommentChange,
  onPhotoUpload,
  onPhotoDelete,
}: {
  item: ChecklistItem & { index: number }
  existingDefect: InspectionDetail['defects'][number] | undefined
  photos: PhotoRecord[]
  uploading: boolean
  deletingPhotoKey: string | null
  disabled: boolean
  onResultChange: (index: number, result: boolean) => void
  onCommentChange: (index: number, comment: string) => void
  onPhotoUpload: (defectTitle: string, file: File) => void
  onPhotoDelete: (defectTitle: string, photoIndex: number) => void
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        !item.result ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{item.title}</span>
          {!item.result ? (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">Дефект</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResultChange(item.index, true)}
            className={`rounded px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              item.result ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            OK
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResultChange(item.index, false)}
            className={`rounded px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              !item.result ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            Дефект
          </button>
        </div>
      </div>

      {!item.result ? (
        <div className="space-y-3">
          {existingDefect?.id ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Link href={`/defects/${existingDefect.id}`} className="font-medium hover:underline">
                Открыть карточку дефекта
              </Link>
            </div>
          ) : null}

          <textarea
            placeholder="Описание дефекта..."
            value={item.comment}
            onChange={(event) => onCommentChange(item.index, event.target.value)}
            disabled={disabled}
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Фотографии дефекта
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((photo, photoIndex) => {
                const photoKey = `${item.title}-${photoIndex}`
                const isDeleting = deletingPhotoKey === photoKey
                return (
                  <div key={`${photo.url}-${photoIndex}`} className="group relative">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')
                      }
                    >
                      <Image
                        src={buildApiUrl(getPhotoThumbUrl(photo))}
                        alt="Дефект"
                        width={80}
                        height={80}
                        unoptimized
                        className="h-20 w-20 rounded border object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onPhotoDelete(item.title, photoIndex)}
                      disabled={isDeleting || disabled}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {isDeleting ? '...' : 'x'}
                    </button>
                  </div>
                )
              })}

              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-slate-300 transition-colors hover:border-blue-400 hover:bg-blue-50">
                {uploading ? (
                  <span className="ui-inline-spinner" aria-label="Загрузка фото" />
                ) : (
                  <span className="text-2xl text-slate-400">+</span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled}
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files?.[0]) {
                      onPhotoUpload(item.title, event.target.files[0])
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
