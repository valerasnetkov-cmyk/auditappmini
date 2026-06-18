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
  disabled,
  readOnly = false,
  onResultChange,
  onCommentChange,
}: {
  item: ChecklistItem & { index: number }
  existingDefect: InspectionDetail['defects'][number] | undefined
  photos: PhotoRecord[]
  disabled: boolean
  readOnly?: boolean
  onResultChange: (index: number, result: boolean) => void
  onCommentChange: (index: number, comment: string) => void
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
        {readOnly ? (
          <span className={`rounded px-3 py-1 text-sm ${item.result ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {item.result ? 'OK' : 'Дефект'}
          </span>
        ) : (
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
        )}
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
            disabled={disabled || readOnly}
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Фотографии дефекта
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((photo, photoIndex) => {
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
                  </div>
                )
              })}

              {!photos.length ? (
                <span className="text-xs text-slate-400">
                  Фото дефекта появится после синхронизации мобильного осмотра
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
