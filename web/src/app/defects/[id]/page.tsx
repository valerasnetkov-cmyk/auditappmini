'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import Timeline from '@/components/Timeline'
import { useToast } from '@/app/contexts/ToastContext'
import api, { buildApiUrl } from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import type { DefectRecord, InspectionDetail, VehicleDefectHistoryItem } from '@/lib/types'

function getInspectionTypeLabel(type?: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'
  return new Date(value).toLocaleString('ru-RU')
}

export default function DefectDetailPage() {
  const params = useParams<{ id: string }>()
  const defectId = params.id

  const [defect, setDefect] = useState<DefectRecord | null>(null)
  const [vehicleDefects, setVehicleDefects] = useState<VehicleDefectHistoryItem[]>([])
  const [inspectionDetails, setInspectionDetails] = useState<InspectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [defectHistories, setDefectHistories] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadDefect()
  }, [])

  const loadDefect = async () => {
    try {
      setLoading(true)
      setError('')

      const defectResult = await api.getDefect(defectId)
      if (defectResult.error) {
        setError(defectResult.error)
        return
      }

      const currentDefect = defectResult.data || null
      setDefect(currentDefect)

      // Load defect history for timeline if available
      if (defectId) {
        try {
          const histRes = await (api as any).getDefectHistory(defectId)
          if (!histRes?.error) {
            setDefectHistories((prev) => ({ ...prev, [defectId]: histRes.data || [] }))
          }
        } catch {
          // ignore history load errors
        }
      }

      if (currentDefect?.inspection_id) {
        const inspectionResult = await api.getInspectionDetail(currentDefect.inspection_id)
        if (!inspectionResult.error) {
          setInspectionDetails(inspectionResult.data || null)
        }
      }

      if (currentDefect?.vehicle_id) {
        const vehicleDefectsResult = await api.getVehicleDefects(currentDefect.vehicle_id, { limit: 30 })
        if (!vehicleDefectsResult.error) {
          setVehicleDefects(vehicleDefectsResult.data || [])
        }
      }
    } catch {
      setError('Не удалось загрузить карточку дефекта')
    } finally {
      setLoading(false)
    }
  }

  // Close defect via UI action
  const closeDefectUI = async () => {
    if (!defect?.id) return
    try {
      await api.closeDefect(defect.id)
      await loadDefect()
      showToast('Дефект закрыт')
    } catch {
      // no-op
    }
  }
  // Reopen defect via UI action
  const reopenDefectUI = async () => {
    if (!defect?.id) return
    try {
      await api.reopenDefect(defect.id)
      await loadDefect()
      showToast('Дефект повторно открыт')
    } catch {
      // no-op
    }
  }

  const relatedDefects = useMemo(
    () => vehicleDefects.filter((item) => item.id !== defectId),
    [vehicleDefects, defectId],
  )

  const siblingInspectionDefects = useMemo(
    () => (inspectionDetails?.defects || []).filter((item) => item.id !== defectId),
    [inspectionDetails, defectId],
  )

  if (loading) {
    return (
      <Layout currentPage="defects">
        <div className="p-6 text-slate-500">Загрузка...</div>
      </Layout>
    )
  }

  if (error || !defect) {
    return (
      <Layout currentPage="defects">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="text-center">
            <p className="mb-4 text-red-600">{error || 'Дефект не найден'}</p>
            <Link href="/defects" className="text-blue-600 hover:underline">
              Назад к списку дефектов
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const isAccidentInspection = defect.inspection_type === 'accident'

  const currentTimeline = defectHistories[defectId] ?? []
 return (
    <Layout currentPage="defects">
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/defects" className="text-sm text-blue-600 hover:underline">
              Назад к дефектам
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{defect.title}</h1>
            <p className="mt-1 text-slate-500">
              {defect.vehicle_number} · {defect.vehicle_name}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            {defect?.status !== 'closed' ? (
              <button onClick={closeDefectUI} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">Закрыть дефект</button>
            ) : (
              <button onClick={reopenDefectUI} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">Вернуть в работу</button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Карточка дефекта</h2>
              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <div className="text-slate-500">Госномер</div>
                  <div className="font-medium text-slate-800">{defect.vehicle_number || 'Не указано'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Регион</div>
                  <div className="font-medium text-slate-800">{defect.vehicle_region || 'Не указано'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Тип осмотра</div>
                  <div className="font-medium text-slate-800">{getInspectionTypeLabel(defect.inspection_type)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Инспектор</div>
                  <div className="font-medium text-slate-800">{defect.inspector_name || 'Не указано'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Выявлен</div>
                  <div className="font-medium text-slate-800">{formatDateTime(defect.created_at)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Осмотр проведён</div>
                  <div className="font-medium text-slate-800">{formatDateTime(defect.inspection_time || defect.inspection_date)}</div>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-700">Описание дефекта</div>
                <p className="mt-2 text-sm text-slate-600">{defect.comment || 'Описание не указано'}</p>
              </div>
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm" data-testid="defect-timeline-section">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Хронология дефекта</h2>
                <span className="text-sm text-slate-500">{currentTimeline.length} записей</span>
              </div>
              <Timeline items={currentTimeline} />
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Фотографии</h2>
                <span className="text-sm text-slate-500">{defect.photos.length} шт.</span>
              </div>

              {defect.photos.length === 0 ? (
                <p className="text-sm text-slate-500">Фотографии пока не добавлены.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {defect.photos.map((photo, index) => (
                    <div key={`${photo.url}-${index}`} className="rounded-xl border border-slate-200 p-3">
                      <img
                        src={buildApiUrl(photo.url)}
                        alt={`Фото дефекта ${index + 1}`}
                        className="h-56 w-full rounded-lg object-cover"
                      />
                      <div className="mt-3 text-sm text-slate-600">
                        <div>Фото #{index + 1}</div>
                        <div className="mt-1">Геометка: {photo.geo || 'Не указана'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  {isAccidentInspection ? 'Все дефекты этого ДТП' : 'Все дефекты этого осмотра'}
                </h2>
                <span className="text-sm text-slate-500">{inspectionDetails?.defects.length || 0} записей</span>
              </div>

              {inspectionDetails?.defects.length ? (
                <div className="space-y-3">
                  {inspectionDetails.defects.map((item) => {
                    const isCurrent = item.id === defect.id
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 ${
                          isCurrent ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{item.title}</div>
                            <div className="mt-1 text-sm text-slate-600">{item.comment || 'Без описания'}</div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <div>{formatDateTime(item.created_at)}</div>
                            <div className="mt-1">Фото: {item.photos.length}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                          {!isCurrent ? (
                            <Link href={`/defects/${item.id}`} className="text-blue-600 hover:underline">
                              Открыть дефект
                            </Link>
                          ) : (
                            <span className="text-slate-500">Текущая карточка</span>
                          )}
                          <span className="text-slate-500">Осмотр: {formatDateTime(item.inspection_time || item.inspection_date)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Для этого осмотра пока нет других дефектов.</p>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">История дефектов по этой технике</h2>
                <span className="text-sm text-slate-500">{vehicleDefects.length} записей</span>
              </div>

              {vehicleDefects.length === 0 ? (
                <p className="text-sm text-slate-500">По этой машине пока нет других зафиксированных дефектов.</p>
              ) : (
                <div className="space-y-3">
                  {vehicleDefects.map((item) => {
                    const isCurrent = item.id === defect.id
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 ${
                          isCurrent ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{item.title}</div>
                            <div className="mt-1 text-sm text-slate-600">{item.comment || 'Без описания'}</div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <div>{getInspectionTypeLabel(item.inspection_type)}</div>
                            <div className="mt-1">{formatDateTime(item.created_at)}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                          <div>
                            <div className="text-slate-500">Осмотр</div>
                            <div className="font-medium text-slate-800">{formatDateTime(item.inspection_time || item.inspection_date)}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">ДТП</div>
                            <div className="font-medium text-slate-800">{formatDateTime(item.accident_occurred_at)}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Место ДТП</div>
                            <div className="font-medium text-slate-800">{item.accident_location || 'Не указано'}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                          <Link href={`/inspections/${item.inspection_id}`} className="text-blue-600 hover:underline">
                            Открыть осмотр
                          </Link>
                          {!isCurrent ? (
                            <Link href={`/defects/${item.id}`} className="text-blue-600 hover:underline">
                              Открыть дефект
                            </Link>
                          ) : (
                            <span className="text-slate-500">Текущая карточка</span>
                          )}
                          <span className="text-slate-500">Фото: {item.photos.length}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Связанные записи</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-slate-500">Осмотр</div>
                  <Link href={`/inspections/${defect.inspection_id}`} className="font-medium text-blue-600 hover:underline">
                    Открыть осмотр
                  </Link>
                </div>
                <div>
                  <div className="text-slate-500">Техника</div>
                  {defect.vehicle_id ? (
                    <Link href={`/vehicles/${defect.vehicle_id}`} className="font-medium text-blue-600 hover:underline">
                      {defect.vehicle_number} · {defect.vehicle_name}
                    </Link>
                  ) : (
                    <div className="font-medium text-slate-800">{defect.vehicle_name || 'Не указано'}</div>
                  )}
                </div>
                <div>
                  <div className="text-slate-500">Других дефектов по машине</div>
                  <div className="font-medium text-slate-800">{relatedDefects.length}</div>
                </div>
                <div>
                  <div className="text-slate-500">Других дефектов в этом осмотре</div>
                  <div className="font-medium text-slate-800">{siblingInspectionDefects.length}</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Хронология</h2>
              <div className="space-y-4 text-sm">
                {isAccidentInspection ? (
                  <>
                    <div>
                      <div className="text-slate-500">Время ДТП</div>
                      <div className="font-medium text-slate-800">{formatDateTime(defect.accident_occurred_at)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Место ДТП</div>
                      <div className="font-medium text-slate-800">{defect.accident_location || 'Не указано'}</div>
                    </div>
                  </>
                ) : null}
                <div>
                  <div className="text-slate-500">Время осмотра</div>
                  <div className="font-medium text-slate-800">{formatDateTime(defect.inspection_time || defect.inspection_date)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Время фиксации дефекта</div>
                  <div className="font-medium text-slate-800">{formatDateTime(defect.created_at)}</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  )
}
