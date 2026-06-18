'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { buildApiUrl } from '@/lib/api/client'
import { formatDateTime, getPhotoPreviewUrl, getPhotoThumbUrl } from '../_lib/checklist'
import type { InspectionDetail } from '@/lib/types'

export default function DefectsList({
  inspection,
  disabled,
  saving,
  onCreateDefect,
}: {
  inspection: InspectionDetail
  disabled: boolean
  saving: boolean
  onCreateDefect: (data: { title: string; comment: string; severity: string }) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [severity, setSeverity] = useState('medium')

  const create = async () => {
    if (!title.trim()) return
    await onCreateDefect({ title: title.trim(), comment: comment.trim(), severity })
    setTitle('')
    setComment('')
    setSeverity('medium')
    setShowForm(false)
  }

  return (
    <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Все дефекты осмотра ({inspection.defects.length})
        </h2>
        {!inspection.completed && !disabled ? (
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="btn btn-secondary btn-sm"
          >
            Добавить вручную
          </button>
        ) : null}
      </div>
      {showForm ? (
        <div className="mb-4 grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-2">
          <label>
            <span className="label">Название дефекта</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="input" />
          </label>
          <label>
            <span className="label">Критичность</span>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="select">
              <option value="low">Низкая</option>
              <option value="medium">Средняя</option>
              <option value="high">Высокая</option>
              <option value="critical">Критическая</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="label">Описание</span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} className="textarea min-h-20" />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={saving || !title.trim()}
              onClick={() => void create()}
              className="btn btn-primary btn-sm disabled:opacity-50"
            >
              {saving ? 'Добавляем...' : 'Добавить дефект'}
            </button>
          </div>
        </div>
      ) : null}
      {!inspection.defects.length ? (
        <p className="text-sm text-slate-500">Дефекты пока не зафиксированы.</p>
      ) : null}
      <div className="space-y-4">
        {inspection.defects.map((defect) => (
          <div key={defect.id} className="rounded-lg border bg-slate-50 p-4">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-slate-900">{defect.title}</div>
                  <span className={defect.severity === 'critical' ? 'badge badge-danger' : defect.severity === 'high' ? 'badge badge-warning' : 'badge badge-info'}>
                    {defect.severity === 'critical' ? 'Критический' : defect.severity === 'high' ? 'Высокий' : defect.severity === 'low' ? 'Низкий' : 'Средний'}
                  </span>
                </div>
                {defect.comment ? <p className="mt-1 text-sm text-slate-600">{defect.comment}</p> : null}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">{formatDateTime(defect.created_at)}</div>
                <Link href={`/defects/${defect.id}`} className="text-xs text-blue-600 hover:underline">
                  Подробнее
                </Link>
              </div>
            </div>

            {inspection.type === 'accident' ? (
              <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                ДТП: {formatDateTime(inspection.accident_occurred_at)} ·{' '}
                {inspection.accident_location || 'Место не указано'}
              </div>
            ) : null}

            {defect.photos.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {defect.photos.map((photo, index) => (
                  <button
                    key={`${photo.url}-${index}`}
                    type="button"
                    onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}
                  >
                    <Image
                      src={buildApiUrl(getPhotoThumbUrl(photo))}
                      alt="Фото дефекта"
                      width={96}
                      height={96}
                      unoptimized
                      className="h-24 w-24 rounded border object-cover hover:opacity-80"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400">Нет фото</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
