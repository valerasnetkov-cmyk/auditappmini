'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import Timeline from '@/components/Timeline'
import { Badge, NoticeCard, Skeleton, type UiTone } from '@/components/ui'
import { useToast } from '@/app/contexts/ToastContext'
import api, { buildApiUrl } from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { getCompanyOperationRestriction } from '@/lib/companyAccess'
import { useCompanyUsage } from '@/lib/useCompanyUsage'
import type { DefectRecord, InspectionDetail, VehicleDefectHistoryItem } from '@/lib/types'
import type { DefectHistoryEntry } from '@/lib/types'
import { DefectLifecyclePanel } from './_components/DefectLifecyclePanel'

function getPhotoPreviewUrl(photo: { url: string; webp_url?: string | null }) {
  return photo.webp_url || photo.url
}

function getPhotoThumbUrl(photo: { url: string; webp_url?: string | null; thumb_url?: string | null }) {
  return photo.thumb_url || photo.webp_url || photo.url
}

function getInspectionTypeLabel(type?: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

function getStatusLabel(status?: string) {
  if (status === 'closed') return 'Закрыт'
  if (status === 'open') return 'Открыт'
  if (status === 'in_progress') return 'В работе'
  if (status === 'resolved') return 'Устранён'
  if (status === 'reopened') return 'Открыт повторно'
  return status || 'Открыт'
}

function getStatusTone(status?: string): UiTone {
  if (status === 'closed') return 'success'
  if (status === 'resolved') return 'info'
  if (status === 'reopened') return 'danger'
  return 'warning'
}

function getSeverityLabel(severity?: string) {
  if (severity === 'low') return 'Низкая'
  if (severity === 'high') return 'Высокая'
  if (severity === 'critical') return 'Критическая'
  return 'Средняя'
}

function getSeverityTone(severity?: string): UiTone {
  if (severity === 'critical') return 'danger'
  if (severity === 'high') return 'warning'
  if (severity === 'low') return 'neutral'
  return 'info'
}

function getInspectionTypeTone(type?: string): UiTone {
  if (type === 'accident') return 'danger'
  if (type === 'scheduled') return 'warning'
  if (type === 'quick') return 'info'
  return 'neutral'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'
  return new Date(value).toLocaleString('ru-RU')
}

function EmptyText({ children }: { children: string }) {
  return <p className="text-sm text-foreground-muted">{children}</p>
}

export default function DefectDetailPage() {
  const params = useParams<{ id: string }>()
  const defectId = params.id
  const { showToast } = useToast()
  const { usage: companyUsage, loading: companyUsageLoading } = useCompanyUsage()
  const writeRestriction = getCompanyOperationRestriction(companyUsage, 'write')
  const writeRestrictionMessage = companyUsageLoading
    ? 'Проверяем статус тарифа компании. Изменения станут доступны после проверки.'
    : writeRestriction
      ? `${writeRestriction.title}: ${writeRestriction.message}`
      : ''

  const [defect, setDefect] = useState<DefectRecord | null>(null)
  const [vehicleDefects, setVehicleDefects] = useState<VehicleDefectHistoryItem[]>([])
  const [inspectionDetails, setInspectionDetails] = useState<InspectionDetail | null>(null)
  const [history, setHistory] = useState<DefectHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadDefect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDefect = async () => {
    try {
      setLoading(true)
      setError('')

      const defectResult = await api.getDefect(defectId)
      if (defectResult.error || !defectResult.data) {
        setError(defectResult.error || 'Дефект не найден')
        return
      }

      const currentDefect = defectResult.data
      setDefect(currentDefect)

      const [historyResult, inspectionResult, vehicleDefectsResult] = await Promise.all([
        api.getDefectHistory(defectId),
        currentDefect.inspection_id ? api.getInspectionDetail(currentDefect.inspection_id) : Promise.resolve({ data: null }),
        currentDefect.vehicle_id ? api.getVehicleDefects(currentDefect.vehicle_id, { limit: 50 }) : Promise.resolve({ data: [] }),
      ])

      setHistory((historyResult.data || []) as DefectHistoryEntry[])
      setInspectionDetails(inspectionResult.data || null)
      setVehicleDefects(vehicleDefectsResult.data || [])
    } catch {
      setError('Не удалось загрузить карточку дефекта')
    } finally {
      setLoading(false)
    }
  }

  const transitionDefect = async (status: string, comment: string) => {
    if (!defect?.id) return
    if (companyUsageLoading) {
      showToast('Проверяем статус тарифа компании. Повторите действие через несколько секунд.')
      return
    }
    if (writeRestriction) {
      showToast(`${writeRestriction.title}: ${writeRestriction.message}`)
      return
    }

    try {
      setActionLoading(true)
      const result = await api.setDefectStatus(defect.id, status, comment)
      if (result.error) {
        setError(result.error)
        return
      }

      await loadDefect()
      showToast('Статус дефекта обновлён')
    } finally {
      setActionLoading(false)
    }
  }

  const relatedVehicleDefects = useMemo(
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
        <div className="mx-auto min-h-[60vh] w-full max-w-6xl space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !defect) {
    return (
      <Layout currentPage="defects">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="card max-w-lg p-8 text-center">
            <p className="mb-4 text-status-danger">{error || 'Дефект не найден'}</p>
            <Link href="/defects" className="text-primary hover:underline">
              Назад к дефектам
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const isAccidentInspection = defect.inspection_type === 'accident'
  const photos = defect.photos || []

  return (
    <Layout currentPage="defects">
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/defects" className="text-sm text-primary hover:underline">
              Назад к дефектам
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="page-title text-2xl">{defect.title}</h1>
              <Badge tone={getStatusTone(defect.status)}>{getStatusLabel(defect.status)}</Badge>
              <Badge tone={getSeverityTone(defect.severity)}>{getSeverityLabel(defect.severity)}</Badge>
            </div>
            <p className="mt-1 text-foreground-muted">
              {defect.vehicle_number} · {defect.vehicle_name}
            </p>
          </div>

        </div>

        <SubscriptionStatusBanner usage={companyUsage} compact />

        {writeRestrictionMessage ? (
          <div className="mb-4">
            <NoticeCard title="Изменение статуса временно недоступно" tone="warning" compact>{writeRestrictionMessage}</NoticeCard>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
          <div className="space-y-6">
            {isAccidentInspection ? (
              <section className="alert-danger rounded-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-status-danger">Данные ДТП</h2>
                <div className="grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-foreground-muted">Время ДТП</div>
                    <div className="font-medium text-foreground">{formatDateTime(defect.accident_occurred_at)}</div>
                  </div>
                  <div>
                    <div className="text-foreground-muted">Место ДТП</div>
                    <div className="font-medium text-foreground">{defect.accident_location || 'Не указано'}</div>
                  </div>
                  <div>
                    <div className="text-foreground-muted">Время осмотра</div>
                    <div className="font-medium text-foreground">{formatDateTime(defect.inspection_time || defect.inspection_date)}</div>
                  </div>
                  <div>
                    <div className="text-foreground-muted">Инспектор</div>
                    <div className="font-medium text-foreground">{defect.inspector_name || 'Не указано'}</div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Карточка дефекта</h2>
              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <div className="text-foreground-muted">Госномер</div>
                  <div className="font-medium text-foreground">{defect.vehicle_number || 'Не указано'}</div>
                </div>
                <div>
                  <div className="text-foreground-muted">Регион</div>
                  <div className="font-medium text-foreground">{defect.vehicle_region || 'Не указано'}</div>
                </div>
                <div>
                  <div className="text-foreground-muted">Тип осмотра</div>
                  <div className="mt-1">
                    <Badge tone={getInspectionTypeTone(defect.inspection_type)}>{getInspectionTypeLabel(defect.inspection_type)}</Badge>
                  </div>
                </div>
                <div>
                  <div className="text-foreground-muted">Выявлен</div>
                  <div className="font-medium text-foreground">{formatDateTime(defect.created_at)}</div>
                </div>
                <div>
                  <div className="text-foreground-muted">Осмотр проведен</div>
                  <div className="font-medium text-foreground">{formatDateTime(defect.inspection_time || defect.inspection_date)}</div>
                </div>
                <div>
                  <div className="text-foreground-muted">Инспектор</div>
                  <div className="font-medium text-foreground">{defect.inspector_name || 'Не указано'}</div>
                </div>
                <div>
                  <div className="text-foreground-muted">Критичность</div>
                  <div className="mt-1"><Badge tone={getSeverityTone(defect.severity)}>{getSeverityLabel(defect.severity)}</Badge></div>
                </div>
                <div>
                  <div className="text-foreground-muted">Последний комментарий руководителя</div>
                  <div className="font-medium text-foreground">{defect.manager_comment || 'Не указан'}</div>
                </div>
              </div>

              <div className="mt-5 rounded-card bg-muted-surface p-4">
                <div className="text-sm font-medium text-foreground">Описание</div>
                <p className="mt-2 text-sm text-foreground-secondary">{defect.comment || 'Описание не указано'}</p>
              </div>
            </section>

            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Фотографии дефекта</h2>
                <span className="text-sm text-foreground-muted">{photos.length} шт.</span>
              </div>

              {photos.length === 0 ? (
                <EmptyText>Фото пока не добавлены</EmptyText>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {photos.map((photo, index) => (
                    <button
                      key={`${photo.url}-${index}`}
                      onClick={() => window.open(buildApiUrl(getPhotoPreviewUrl(photo)), '_blank')}
                      className="rounded-card border border-line bg-muted-surface p-3 text-left transition hover:border-primary hover:bg-surface-hover"
                      type="button"
                    >
                      <img
                        src={buildApiUrl(getPhotoThumbUrl(photo))}
                        alt={`Фото дефекта ${index + 1}`}
                        className="h-56 w-full rounded-control object-cover"
                      />
                      <div className="mt-3 text-sm text-foreground-secondary">
                        <div>Фото #{index + 1}</div>
                        <div className="mt-1">Геометка: {photo.geo || 'Не указана'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {isAccidentInspection ? 'Все дефекты этого ДТП' : 'Все дефекты этого осмотра'}
                </h2>
                <span className="text-sm text-foreground-muted">{inspectionDetails?.defects.length || 0} записей</span>
              </div>

              {inspectionDetails?.defects.length ? (
                <div className="space-y-3">
                  {inspectionDetails.defects.map((item) => {
                    const isCurrent = item.id === defect.id
                    return (
                      <div
                        key={item.id}
                        className={`rounded-card border p-4 ${
                          isCurrent ? 'border-primary bg-accent-soft' : 'border-line bg-muted-surface'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{item.title}</div>
                            <div className="mt-1 text-sm text-foreground-secondary">{item.comment || 'Без описания'}</div>
                          </div>
                          <div className="text-right text-xs text-foreground-muted">
                            <div>{formatDateTime(item.created_at)}</div>
                            <div className="mt-1">Фото: {item.photos.length}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                          {isCurrent ? (
                            <span className="text-foreground-muted">Текущая карточка</span>
                          ) : (
                            <Link href={`/defects/${item.id}`} className="text-primary hover:underline">
                              Открыть дефект
                            </Link>
                          )}
                          <span className="text-foreground-muted">Осмотр: {formatDateTime(item.inspection_time || item.inspection_date)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyText>Для этого осмотра пока нет других дефектов</EmptyText>
              )}
            </section>

            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">История дефектов по этой технике</h2>
                <span className="text-sm text-foreground-muted">{vehicleDefects.length} записей</span>
              </div>

              {vehicleDefects.length === 0 ? (
                <EmptyText>По этой технике пока нет зафиксированных дефектов</EmptyText>
              ) : (
                <div className="space-y-3">
                  {vehicleDefects.map((item) => {
                    const isCurrent = item.id === defect.id
                    return (
                      <div
                        key={item.id}
                        className={`rounded-card border p-4 ${
                          isCurrent ? 'border-primary bg-accent-soft' : 'border-line bg-muted-surface'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{item.title}</div>
                            <div className="mt-1 text-sm text-foreground-secondary">{item.comment || 'Без описания'}</div>
                          </div>
                          <div className="text-right text-xs text-foreground-muted">
                            <div>{getInspectionTypeLabel(item.inspection_type)}</div>
                            <div className="mt-1">{formatDateTime(item.created_at)}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                          <div>
                            <div className="text-foreground-muted">Осмотр</div>
                            <div className="font-medium text-foreground">{formatDateTime(item.inspection_time || item.inspection_date)}</div>
                          </div>
                          <div>
                            <div className="text-foreground-muted">Время ДТП</div>
                            <div className="font-medium text-foreground">{formatDateTime(item.accident_occurred_at)}</div>
                          </div>
                          <div>
                            <div className="text-foreground-muted">Место ДТП</div>
                            <div className="font-medium text-foreground">{item.accident_location || 'Не указано'}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                          <Link href={`/inspections/${item.inspection_id}`} className="text-primary hover:underline">
                            Открыть осмотр
                          </Link>
                          {isCurrent ? (
                            <span className="text-foreground-muted">Текущая карточка</span>
                          ) : (
                            <Link href={`/defects/${item.id}`} className="text-primary hover:underline">
                              Открыть дефект
                            </Link>
                          )}
                          <span className="text-foreground-muted">Фото: {item.photos.length}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <DefectLifecyclePanel
              key={defect.status}
              defect={defect}
              disabled={Boolean(writeRestrictionMessage)}
              saving={actionLoading}
              onTransition={transitionDefect}
            />
            <section className="card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Связанные записи</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-foreground-muted">Осмотр</div>
                  {defect.inspection_id ? (
                    <Link href={`/inspections/${defect.inspection_id}`} className="font-medium text-primary hover:underline">
                      Открыть осмотр
                    </Link>
                  ) : (
                    <div className="font-medium text-foreground">Не указан</div>
                  )}
                </div>
                <div>
                  <div className="text-foreground-muted">Техника</div>
                  {defect.vehicle_id ? (
                    <Link href={`/vehicles/${defect.vehicle_id}`} className="font-medium text-primary hover:underline">
                      {defect.vehicle_number} · {defect.vehicle_name}
                    </Link>
                  ) : (
                    <div className="font-medium text-foreground">{defect.vehicle_name || 'Не указано'}</div>
                  )}
                </div>
                <div>
                  <div className="text-foreground-muted">Других дефектов по технике</div>
                  <div className="font-medium text-foreground">{relatedVehicleDefects.length}</div>
                </div>
                <div>
                  <div className="text-foreground-muted">Других дефектов в этом осмотре</div>
                  <div className="font-medium text-foreground">{siblingInspectionDefects.length}</div>
                </div>
              </div>
            </section>

            <section className="card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Хронология</h2>
              <div className="space-y-4 text-sm">
                {isAccidentInspection ? (
                  <>
                    <div>
                      <div className="text-foreground-muted">Время ДТП</div>
                      <div className="font-medium text-foreground">{formatDateTime(defect.accident_occurred_at)}</div>
                    </div>
                    <div>
                      <div className="text-foreground-muted">Место ДТП</div>
                      <div className="font-medium text-foreground">{defect.accident_location || 'Не указано'}</div>
                    </div>
                  </>
                ) : null}
                <div>
                  <div className="text-foreground-muted">Время осмотра</div>
                  <div className="font-medium text-foreground">{formatDateTime(defect.inspection_time || defect.inspection_date)}</div>
                </div>
                <div>
                  <div className="text-foreground-muted">Время фиксации дефекта</div>
                  <div className="font-medium text-foreground">{formatDateTime(defect.created_at)}</div>
                </div>
              </div>
            </section>

            <section className="card p-6" data-testid="defect-timeline-section">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">История статуса</h2>
                <span className="text-sm text-foreground-muted">{history.length} записей</span>
              </div>
              <Timeline items={history} />
            </section>
          </div>
        </div>
      </div>
    </Layout>
  )
}

