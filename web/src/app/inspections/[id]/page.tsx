'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api, { buildApiUrl } from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import type { ChecklistItemResponse, InspectionDetail, InspectionType, PhotoRecord, PhotoRequirementsResponse, VehicleListItem } from '@/lib/types'

type ChecklistItem = {
  id?: string
  title: string
  result: boolean
  comment: string
}

type StatusTone = 'success' | 'error'

function getPhotoPreviewUrl(photo: PhotoRecord) {
  return photo.webp_url || photo.url
}

function getPhotoThumbUrl(photo: PhotoRecord) {
  return photo.thumb_url || photo.webp_url || photo.url
}

const QUICK_CHECKLIST = ['Внешний вид', 'Повреждения кузова', 'Колеса', 'Стекла', 'Госномер']
const SCHEDULED_CHECKLIST = [
  'Внешний вид',
  'Повреждения кузова',
  'Лакокрасочное покрытие',
  'Колеса',
  'Стекла',
  'Фары',
  'Зеркала',
  'Двери',
  'Госномер',
  'Двигатель',
  'Салон',
  'Приборная панель',
]
const ACCIDENT_CHECKLIST = ['Повреждения кузова', 'Остекление', 'Ходовая', 'Кузов', 'Безопасность']

const CHECKLIST_SECTIONS: Record<string, Record<string, string[]>> = {
  quick: {
    'Кузов': ['Внешний вид', 'Повреждения кузова'],
    'Ходовая': ['Колеса'],
    'Прочее': ['Стекла', 'Госномер'],
  },
  scheduled: {
    'Кузов': ['Внешний вид', 'Повреждения кузова', 'Лакокрасочное покрытие', 'Стекла', 'Фары', 'Зеркала', 'Двери', 'Госномер'],
    'Ходовая': ['Колеса'],
    'Двигатель': ['Двигатель'],
    'Салон': ['Салон', 'Приборная панель'],
  },
  accident: {
    'Кузов': ['Повреждения кузова', 'Кузов'],
    'Ходовая': ['Ходовая'],
    'Безопасность': ['Остекление', 'Безопасность'],
  },
}

function getTypeLabel(type?: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указан'
}

function getTypeStyle(type?: string) {
  if (type === 'accident') return 'bg-red-100 text-red-800'
  if (type === 'scheduled') return 'bg-purple-100 text-purple-800'
  return 'bg-blue-100 text-blue-800'
}

function getTypeSelectedStyle(type?: string) {
  if (type === 'accident') return 'border-red-500 bg-red-100 text-red-800'
  if (type === 'scheduled') return 'border-purple-500 bg-purple-100 text-purple-800'
  return 'border-blue-500 bg-blue-100 text-blue-800'
}

function getChecklistTemplate(type: InspectionType) {
  if (type === 'scheduled') return SCHEDULED_CHECKLIST
  if (type === 'accident') return ACCIDENT_CHECKLIST
  return QUICK_CHECKLIST
}

function getItemSection(type: InspectionType, title: string) {
  const sections = CHECKLIST_SECTIONS[type] || CHECKLIST_SECTIONS.quick
  for (const [section, items] of Object.entries(sections)) {
    if (items.includes(title)) return section
  }
  return 'Прочее'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'
  return new Date(value).toLocaleString('ru-RU')
}

function toDatetimeLocalValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function groupChecklist(type: InspectionType, items: ChecklistItem[]) {
  return items.reduce<Record<string, Array<ChecklistItem & { index: number }>>>((groups, item, index) => {
    const section = getItemSection(type, item.title)
    groups[section] = groups[section] || []
    groups[section].push({ ...item, index })
    return groups
  }, {})
}

function getPhotoCount(defects: InspectionDetail['defects']) {
  return defects.reduce((sum, defect) => sum + (defect.photos?.length || 0), 0)
}

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>()
  const inspectionId = params.id

  const [inspection, setInspection] = useState<InspectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isNewInspection, setIsNewInspection] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [defectPhotos, setDefectPhotos] = useState<Record<string, PhotoRecord[]>>({})
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, PhotoRecord[]>>({})
  const [photoRequirements, setPhotoRequirements] = useState<PhotoRequirementsResponse | null>(null)
  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')
  const [odometerValue, setOdometerValue] = useState('')
  const [odometerUnit, setOdometerUnit] = useState('km')
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<StatusTone>('success')

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadInspection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showStatus = (tone: StatusTone, message: string) => {
    setStatusTone(tone)
    setStatusMessage(message)
  }

  const clearStatus = () => setStatusMessage('')

  const initChecklist = (type: InspectionType, existingItems?: ChecklistItemResponse[]) => {
    if (existingItems?.length) {
      setChecklist(
        existingItems.map((item) => ({
          id: item.id,
          title: item.title,
          result: item.result === 1 || item.result === true,
          comment: item.comment || '',
        })),
      )
      return
    }

    setChecklist(getChecklistTemplate(type).map((title) => ({ title, result: true, comment: '' })))
  }

  const loadInspection = async () => {
    try {
      setLoading(true)
      setError('')

      if (inspectionId === 'new') {
        setIsNewInspection(true)
        return
      }

      const result = await api.getInspection(inspectionId)
      if (result.error || !result.data) {
        setError(result.error || 'Осмотр не найден')
        return
      }

      setInspection(result.data)
      initChecklist(result.data.type, result.data.checklist_items)
      setAccidentOccurredAt(toDatetimeLocalValue(result.data.accident_occurred_at))
      setAccidentLocation(result.data.accident_location || '')
      setOdometerValue(result.data.odometer_value ? String(result.data.odometer_value) : '')
      setOdometerUnit(result.data.odometer_unit || 'km')

      const photosByTitle: Record<string, PhotoRecord[]> = {}
      result.data.defects.forEach((defect) => {
        photosByTitle[defect.title] = defect.photos || []
      })
      setDefectPhotos(photosByTitle)

      const standalonePhotos = (result.data.photos || []).reduce<Record<string, PhotoRecord[]>>((groups, photo) => {
        const photoType = photo.photo_type || 'additional'
        groups[photoType] = groups[photoType] || []
        groups[photoType].push(photo)
        return groups
      }, {})
      setInspectionPhotos(standalonePhotos)

      const requirementsResult = await api.getPhotoRequirements(result.data.type)
      setPhotoRequirements(requirementsResult.data || null)
    } catch {
      setError('Ошибка загрузки осмотра')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (vehicleId: string, type: InspectionType, accidentData?: { occurredAt?: string; location?: string }) => {
    clearStatus()

    try {
      const result = await api.createInspection({
        vehicle_id: vehicleId,
        type,
        checklist: [],
        accident_occurred_at: type === 'accident' && accidentData?.occurredAt ? new Date(accidentData.occurredAt).toISOString() : undefined,
        accident_location: type === 'accident' ? accidentData?.location?.trim() : undefined,
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

  const handleResultChange = (index: number, result: boolean) => {
    setChecklist((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, result } : item)))
  }

  const handleCommentChange = (index: number, comment: string) => {
    setChecklist((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, comment } : item)))
  }

  const handlePhotoUpload = async (defectTitle: string, file: File) => {
    const defect = inspection?.defects.find((item) => item.title === defectTitle)
    if (!defect) {
      showStatus('error', 'Сначала сохраните осмотр, затем можно добавить фото дефекта')
      return
    }

    clearStatus()
    setUploadingPhoto(defectTitle)

    try {
      const result = await api.uploadPhoto(defect.id, file)
      if (result.error || !result.data?.url) {
        showStatus('error', result.error || 'Не удалось загрузить фото')
        return
      }

      setDefectPhotos((prev) => ({
        ...prev,
        [defectTitle]: [...(prev[defectTitle] || []), { ...result.data, url: result.data?.url || '' }],
      }))
      showStatus('success', 'Фото добавлено')
    } catch {
      showStatus('error', 'Ошибка загрузки фото')
    } finally {
      setUploadingPhoto(null)
    }
  }

  const handleInspectionPhotoUpload = async (photoType: string, file: File) => {
    if (!inspection) return

    clearStatus()
    setUploadingPhoto(photoType)

    try {
      const result = await api.uploadInspectionPhoto(inspection.id, photoType, file)
      if (result.error || !result.data?.url) {
        showStatus('error', result.error || 'Не удалось загрузить фото осмотра')
        return
      }

      setInspectionPhotos((prev) => ({
        ...prev,
        [photoType]: [...(prev[photoType] || []), {
          ...result.data,
          id: result.data?.id,
          url: result.data?.url || '',
          photo_type: photoType,
          geo: result.data?.geo,
        }],
      }))
      showStatus('success', 'Фото осмотра добавлено')
    } catch {
      showStatus('error', 'Ошибка загрузки фото осмотра')
    } finally {
      setUploadingPhoto(null)
    }
  }

  const handlePhotoDelete = async (defectTitle: string, photoIndex: number) => {
    const photo = defectPhotos[defectTitle]?.[photoIndex]
    if (!photo?.id) return

    if (!confirm('Удалить это фото?')) return

    clearStatus()
    setDeletingPhoto(`${defectTitle}-${photoIndex}`)

    try {
      const result = await api.deletePhoto(photo.id)
      if (result.error) {
        showStatus('error', result.error)
        return
      }

      setDefectPhotos((prev) => ({
        ...prev,
        [defectTitle]: (prev[defectTitle] || []).filter((_, index) => index !== photoIndex),
      }))
      showStatus('success', 'Фото удалено')
    } catch {
      showStatus('error', 'Ошибка удаления фото')
    } finally {
      setDeletingPhoto(null)
    }
  }

  const handleInspectionPhotoDelete = async (photoType: string, photoIndex: number) => {
    const photo = inspectionPhotos[photoType]?.[photoIndex]
    if (!photo?.id) return

    if (!confirm('Удалить это фото?')) return

    clearStatus()
    setDeletingPhoto(`${photoType}-${photoIndex}`)

    try {
      const result = await api.deletePhoto(photo.id)
      if (result.error) {
        showStatus('error', result.error)
        return
      }

      setInspectionPhotos((prev) => ({
        ...prev,
        [photoType]: (prev[photoType] || []).filter((_, index) => index !== photoIndex),
      }))
      showStatus('success', 'Фото осмотра удалено')
    } catch {
      showStatus('error', 'Ошибка удаления фото осмотра')
    } finally {
      setDeletingPhoto(null)
    }
  }

  const getIncompleteWarnings = () => {
    const warnings: string[] = []
    if (!inspection) return warnings

    if (inspection.type === 'accident') {
      if (!accidentOccurredAt.trim()) warnings.push('Укажите время ДТП')
      if (!accidentLocation.trim()) warnings.push('Укажите место ДТП')
    }

    if ((inspection.type === 'quick' || inspection.type === 'scheduled') && !odometerValue.trim()) {
      warnings.push('Укажите пробег')
    }

    photoRequirements?.requirements.required.forEach((photoType) => {
      if ((inspectionPhotos[photoType] || []).length === 0) {
        warnings.push(`Добавьте обязательное фото: ${photoRequirements.labels[photoType] || photoType}`)
      }
    })

    checklist
      .filter((item) => !item.result)
      .forEach((item) => {
        const photos = defectPhotos[item.title] || []
        if (photos.length === 0) warnings.push(`Добавьте фото дефекта: ${item.title}`)
      })

    return warnings
  }

  const handleSave = async () => {
    if (!inspection) return

    clearStatus()

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
        accident_occurred_at: inspection.type === 'accident' && accidentOccurredAt ? new Date(accidentOccurredAt).toISOString() : undefined,
        accident_location: inspection.type === 'accident' ? accidentLocation : undefined,
        odometer_value: (inspection.type === 'quick' || inspection.type === 'scheduled') && odometerValue ? parseInt(odometerValue, 10) : undefined,
        odometer_unit: (inspection.type === 'quick' || inspection.type === 'scheduled') && odometerUnit ? odometerUnit : undefined,
      })

      if (result.error) {
        showStatus('error', `Ошибка сохранения: ${result.error}`)
        return
      }

      await loadInspection()
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
    setSaving(true)

    try {
      const result = await api.completeInspection(inspection.id)
      if (result.error) {
        showStatus('error', result.error)
        return
      }

      await loadInspection()
      showStatus('success', 'Осмотр завершён')
    } catch {
      showStatus('error', 'Ошибка завершения осмотра')
    } finally {
      setSaving(false)
    }
  }

  const handlePrintIncidentCard = () => {
    if (!inspection) return

    const defectsMarkup = inspection.defects.length
      ? inspection.defects
          .map(
            (defect, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${defect.title}</td>
                <td>${defect.comment || 'Без описания'}</td>
                <td>${formatDateTime(defect.created_at)}</td>
                <td>${defect.photos.length}</td>
              </tr>
            `,
          )
          .join('')
      : '<tr><td colspan="5">Дефекты не зафиксированы</td></tr>'

    const printWindow = window.open('', '_blank', 'width=1100,height=900')
    if (!printWindow) return

    printWindow.document.write(`
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <title>Карточка ДТП ${inspection.vehicle_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1, h2 { margin: 0 0 12px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
            .card { border: 1px solid #dbe2ea; border-radius: 12px; padding: 14px; background: #f8fafc; }
            .label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
            .value { font-size: 15px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { text-align: left; background: #eff6ff; }
            th, td { font-size: 13px; padding: 8px; border: 1px solid #dbe2ea; }
          </style>
        </head>
        <body>
          <h1>Карточка ДТП</h1>
          <p style="margin:0 0 20px;color:#475569;">${inspection.vehicle_number} · ${inspection.vehicle_name}</p>
          <div class="grid">
            <div class="card"><div class="label">Инспектор</div><div class="value">${inspection.inspector_name || 'Не указано'}</div></div>
            <div class="card"><div class="label">Тип осмотра</div><div class="value">${getTypeLabel(inspection.type)}</div></div>
            <div class="card"><div class="label">Время ДТП</div><div class="value">${formatDateTime(inspection.accident_occurred_at)}</div></div>
            <div class="card"><div class="label">Время осмотра</div><div class="value">${formatDateTime(inspection.created_at)}</div></div>
            <div class="card"><div class="label">Место ДТП</div><div class="value">${inspection.accident_location || 'Не указано'}</div></div>
            <div class="card"><div class="label">Количество дефектов</div><div class="value">${inspection.defects.length}</div></div>
          </div>
          <h2>Дефекты</h2>
          <table>
            <thead><tr><th>№</th><th>Дефект</th><th>Описание</th><th>Зафиксирован</th><th>Фото</th></tr></thead>
            <tbody>${defectsMarkup}</tbody>
          </table>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const groupedChecklist = useMemo(
    () => (inspection ? groupChecklist(inspection.type, checklist) : {}),
    [inspection, checklist],
  )
  const defectsCount = checklist.filter((item) => !item.result).length
  const warnings = getIncompleteWarnings()

  if (loading) {
    return (
      <Layout currentPage="inspections">
        <div className="flex min-h-[60vh] items-center justify-center p-6 text-slate-500">Загрузка...</div>
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
    return <NewInspectionForm onCreate={handleCreate} statusMessage={statusMessage} statusTone={statusTone} />
  }

  return (
    <Layout currentPage="inspections">
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/inspections" className="mb-1 block text-sm text-blue-600 hover:underline">
              Назад к осмотрам
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Осмотр техники</h1>
            <p className="mt-1 text-slate-500">
              {inspection?.vehicle_number} · {inspection?.vehicle_name}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`inline-block rounded px-2 py-1 text-xs ${getTypeStyle(inspection?.type)}`}>
              {getTypeLabel(inspection?.type)}
            </span>
            {inspection?.type === 'accident' ? (
              <button onClick={handlePrintIncidentCard} className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100">
                Печать карточки ДТП
              </button>
            ) : null}
          </div>
        </div>

        {statusMessage ? (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${statusTone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {statusMessage}
          </div>
        ) : null}

        {warnings.length > 0 && !inspection?.completed ? (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <strong className="font-medium">Неполные данные:</strong>
            <ul className="mt-1 list-inside list-disc">
              {warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Время осмотра</div>
            <div className="mt-1 font-semibold text-slate-900">{formatDateTime(inspection?.created_at)}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Инспектор</div>
            <div className="mt-1 font-semibold text-slate-900">{inspection?.inspector_name || 'Не указано'}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Дефекты</div>
            <div className="mt-1 text-2xl font-bold text-red-600">{defectsCount}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Фото дефектов</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{getPhotoCount(inspection?.defects || [])}</div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          {inspection?.type === 'accident' ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <h2 className="mb-3 text-base font-semibold text-red-800">Данные по ДТП</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Время ДТП</label>
                  <input
                    type="datetime-local"
                    value={accidentOccurredAt}
                    onChange={(event) => setAccidentOccurredAt(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Место ДТП</label>
                  <input
                    type="text"
                    value={accidentLocation}
                    onChange={(event) => setAccidentLocation(event.target.value)}
                    placeholder="Например: Южно-Сахалинск, ул. Ленина, 25"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Время осмотра: {formatDateTime(inspection.created_at)}</p>
            </div>
          ) : (inspection?.type === 'quick' || inspection?.type === 'scheduled') ? (
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Одометр</h2>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={odometerValue}
                  onChange={(event) => setOdometerValue(event.target.value)}
                  placeholder="Пробег"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <select value={odometerUnit} onChange={(event) => setOdometerUnit(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="km">км</option>
                  <option value="mi">мили</option>
                </select>
              </div>
            </div>
          ) : null}

          {photoRequirements ? (
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Обязательные фото осмотра</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {photoRequirements.requirements.required.map((photoType) => {
                  const photos = inspectionPhotos[photoType] || []
                  const label = photoRequirements.labels[photoType] || photoType

                  return (
                    <div key={photoType} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">{label}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${photos.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {photos.length ? 'Добавлено' : 'Требуется'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {photos.map((photo, photoIndex) => (
                          <div key={`${photo.url}-${photoIndex}`} className="group relative">
                            <button type="button" onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}>
                              <img src={buildApiUrl(getPhotoThumbUrl(photo))} alt={label} className="h-20 w-20 rounded border object-cover" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInspectionPhotoDelete(photoType, photoIndex)}
                              disabled={deletingPhoto === `${photoType}-${photoIndex}`}
                              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              {deletingPhoto === `${photoType}-${photoIndex}` ? '...' : 'x'}
                            </button>
                          </div>
                        ))}

                        <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-slate-300 transition-colors hover:border-blue-400 hover:bg-blue-50">
                          {uploadingPhoto === photoType ? (
                            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                          ) : (
                            <span className="text-2xl text-slate-400">+</span>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(event) => {
                              if (event.target.files?.[0]) {
                                void handleInspectionPhotoUpload(photoType, event.target.files[0])
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Чек-лист осмотра
            {defectsCount > 0 ? <span className="ml-2 text-sm text-red-600">({defectsCount} деф.)</span> : null}
          </h2>

          <div className="space-y-5">
            {Object.entries(groupedChecklist).map(([section, sectionItems]) => (
              <section key={section} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 font-semibold text-slate-900">{section}</h3>
                <div className="space-y-3">
                  {sectionItems.map((item) => {
                    const existingDefect = inspection?.defects.find((defect) => defect.title === item.title)
                    const photos = defectPhotos[item.title] || []

                    return (
                      <div key={item.title} className={`rounded-lg border p-4 ${!item.result ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{item.title}</span>
                            {!item.result ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">Дефект</span> : null}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleResultChange(item.index, true)}
                              className={`rounded px-3 py-1 text-sm ${item.result ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResultChange(item.index, false)}
                              className={`rounded px-3 py-1 text-sm ${!item.result ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600'}`}
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
                              onChange={(event) => handleCommentChange(item.index, event.target.value)}
                              className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
                              rows={2}
                            />

                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-600">Фотографии дефекта</label>
                              <div className="flex flex-wrap items-center gap-2">
                                {photos.map((photo, photoIndex) => (
                                  <div key={`${photo.url}-${photoIndex}`} className="group relative">
                                    <button type="button" onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}>
                                      <img src={buildApiUrl(getPhotoThumbUrl(photo))} alt="Дефект" className="h-20 w-20 rounded border object-cover" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePhotoDelete(item.title, photoIndex)}
                                      disabled={deletingPhoto === `${item.title}-${photoIndex}`}
                                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                      {deletingPhoto === `${item.title}-${photoIndex}` ? '...' : 'x'}
                                    </button>
                                  </div>
                                ))}

                                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-slate-300 transition-colors hover:border-blue-400 hover:bg-blue-50">
                                  {uploadingPhoto === item.title ? (
                                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                                  ) : (
                                    <span className="text-2xl text-slate-400">+</span>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(event) => {
                                      if (event.target.files?.[0]) {
                                        void handlePhotoUpload(item.title, event.target.files[0])
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
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {inspection?.defects.length ? (
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Все дефекты осмотра ({inspection.defects.length})</h2>
            <div className="space-y-4">
              {inspection.defects.map((defect) => (
                <div key={defect.id} className="rounded-lg border bg-slate-50 p-4">
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-900">{defect.title}</div>
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
                      ДТП: {formatDateTime(inspection.accident_occurred_at)} · {inspection.accident_location || 'Место не указано'}
                    </div>
                  ) : null}

                  {defect.photos.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {defect.photos.map((photo, index) => (
                        <button key={`${photo.url}-${index}`} type="button" onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}>
                          <img src={buildApiUrl(getPhotoThumbUrl(photo))} alt="Фото дефекта" className="h-24 w-24 rounded border object-cover hover:opacity-80" />
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
        ) : null}

        <div className="flex justify-end gap-3">
          <Link href="/inspections" className="rounded-lg border px-6 py-2 hover:bg-slate-50">
            Назад
          </Link>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить осмотр'}
          </button>
          {!inspection?.completed ? (
            <button
              onClick={handleComplete}
              disabled={saving || warnings.length > 0 || !photoRequirements}
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

function NewInspectionForm({
  onCreate,
  statusMessage,
  statusTone,
}: {
  onCreate: (vehicleId: string, type: InspectionType, accidentData?: { occurredAt?: string; location?: string }) => void
  statusMessage: string
  statusTone: StatusTone
}) {
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [selectedType, setSelectedType] = useState<InspectionType>('quick')
  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')
  const { usage, loading: usageLoading } = useCompanyUsage()
  const accidentEnabled = usage?.features.accidentModule.enabled !== false
  const accidentAvailable = accidentEnabled && !usageLoading
  const effectiveSelectedType = !accidentAvailable && selectedType === 'accident' ? 'quick' : selectedType
  const canCreate =
    Boolean(selectedVehicle) &&
    (effectiveSelectedType !== 'accident' || (accidentAvailable && accidentOccurredAt.trim() && accidentLocation.trim()))

  useEffect(() => {
    void api.getVehiclesList().then((response) => setVehicles(response.data || []))
  }, [])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedVehicle) return
    if (effectiveSelectedType === 'accident' && (!accidentAvailable || !accidentOccurredAt.trim() || !accidentLocation.trim())) return

    onCreate(selectedVehicle, effectiveSelectedType, {
      occurredAt: accidentOccurredAt,
      location: accidentLocation,
    })
  }

  return (
    <Layout currentPage="inspections">
      <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-xl font-bold text-slate-900">Новый осмотр</h1>

          {statusMessage ? (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${statusTone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {statusMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Техника</label>
              <select
                value={selectedVehicle}
                onChange={(event) => setSelectedVehicle(event.target.value)}
                className="w-full rounded-lg border px-4 py-2"
                required
              >
                <option value="">Выберите технику</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.number} · {vehicle.name} {vehicle.region ? `(${vehicle.region})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Тип осмотра</label>
              <div className="grid grid-cols-3 gap-2">
                {(['quick', 'scheduled', 'accident'] as InspectionType[]).map((type) => {
                  const typeDisabled = type === 'accident' && !accidentAvailable

                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={typeDisabled}
                      onClick={() => {
                        if (!typeDisabled) setSelectedType(type)
                      }}
                      className={`rounded-lg border px-4 py-3 text-center ${
                        effectiveSelectedType === type ? getTypeSelectedStyle(type) : 'border-slate-300'
                      } ${typeDisabled ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70' : ''}`}
                    >
                      {getTypeLabel(type)}
                    </button>
                  )
                })}
              </div>
              {!accidentEnabled ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Модуль ДТП отключён для текущего тарифа компании. Создание ДТП-осмотров недоступно.
                </p>
              ) : null}
            </div>

            {effectiveSelectedType === 'accident' ? (
              <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Время ДТП</label>
                  <input
                    type="datetime-local"
                    value={accidentOccurredAt}
                    onChange={(event) => setAccidentOccurredAt(event.target.value)}
                    className="w-full rounded-lg border px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Место ДТП</label>
                  <input
                    type="text"
                    value={accidentLocation}
                    onChange={(event) => setAccidentLocation(event.target.value)}
                    placeholder="Например: Южно-Сахалинск, ул. Ленина, 25"
                    className="w-full rounded-lg border px-4 py-2"
                    required
                  />
                </div>
              </div>
            ) : null}

            <button type="submit" disabled={!canCreate} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
              Начать осмотр
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/inspections" className="text-sm text-blue-600 hover:underline">
              Отмена
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}




