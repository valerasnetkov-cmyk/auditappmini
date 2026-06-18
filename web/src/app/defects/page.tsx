'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { Badge, NoticeCard, Skeleton, StatusButton, type UiTone } from '@/components/ui'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import type { DefectRecord, InspectionType, VehicleListItem } from '@/lib/types'

type VisibleRowsFilter = 'all' | 'withPhotos' | 'withoutPhotos' | 'withDescription' | 'withoutDescription'

function getTypeLabel(type?: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

function getTypeBadgeTone(type?: string): UiTone {
  if (type === 'accident') return 'danger'
  if (type === 'scheduled') return 'warning'
  if (type === 'quick') return 'info'
  return 'neutral'
}

function getStatusBadgeTone(status?: string): UiTone {
  if (status === 'closed') return 'success'
  if (status === 'resolved') return 'info'
  if (status === 'reopened') return 'danger'
  return 'warning'
}

function getStatusLabel(status?: string) {
  if (status === 'closed') return 'Закрыт'
  if (status === 'in_progress') return 'В работе'
  if (status === 'resolved') return 'Устранён'
  if (status === 'reopened') return 'Открыт повторно'
  return 'Открыт'
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

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Не указано'

  return date.toLocaleString('ru-RU')
}

function getVisibleRowsLabel(value: VisibleRowsFilter) {
  const labels: Record<VisibleRowsFilter, string> = {
    all: 'Все записи',
    withPhotos: 'Только с фото',
    withoutPhotos: 'Без фото',
    withDescription: 'С описанием',
    withoutDescription: 'Без описания',
  }

  return labels[value]
}

export default function DefectsPage() {
  const searchParams = useSearchParams()
  const [defects, setDefects] = useState<DefectRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState(searchParams.get('vehicle') || '')
  const [regionFilter, setRegionFilter] = useState('')
  const [visibleRows, setVisibleRows] = useState<VisibleRowsFilter>('all')
  const [typeFilter, setTypeFilter] = useState<InspectionType | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleFilter])

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [defectsRes, vehiclesRes] = await Promise.all([
        api.getDefects({ page: 1, limit: 100, vehicle: vehicleFilter || undefined }),
        api.getVehiclesList(),
      ])

      if (defectsRes.error || vehiclesRes.error) {
        setError(defectsRes.error || vehiclesRes.error || 'Не удалось загрузить дефекты')
      }

      setDefects(defectsRes.data || [])
      setVehicles(vehiclesRes.data || [])
    } catch {
      setError('Не удалось загрузить дефекты')
    } finally {
      setLoading(false)
    }
  }

  const uniqueRegions = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.region).filter((region): region is string => Boolean(region)))).sort(),
    [vehicles],
  )
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === vehicleFilter) || null,
    [vehicles, vehicleFilter],
  )

  const filtered = useMemo(() => {
    let items = [...defects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (regionFilter) {
      items = items.filter((defect) => defect.vehicle_region === regionFilter)
    }

    if (typeFilter) {
      items = items.filter((defect) => defect.inspection_type === typeFilter)
    }
    if (statusFilter) items = items.filter((defect) => defect.status === statusFilter)
    if (severityFilter) items = items.filter((defect) => defect.severity === severityFilter)

    switch (visibleRows) {
      case 'withPhotos':
        items = items.filter((defect) => (defect.photos?.length || 0) > 0)
        break
      case 'withoutPhotos':
        items = items.filter((defect) => (defect.photos?.length || 0) === 0)
        break
      case 'withDescription':
        items = items.filter((defect) => Boolean(defect.comment))
        break
      case 'withoutDescription':
        items = items.filter((defect) => !defect.comment)
        break
      default:
        break
    }

    return items
  }, [defects, regionFilter, visibleRows, typeFilter, statusFilter, severityFilter])

  const openDefects = defects.filter((defect) => defect.status !== 'closed').length
  const accidentDefects = defects.filter((defect) => defect.inspection_type === 'accident').length
  const criticalDefects = defects.filter((defect) => defect.severity === 'critical' && defect.status !== 'closed').length

  return (
    <Layout currentPage="defects">
      <div className="p-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title text-2xl">Дефекты</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Единый журнал выявленных дефектов с быстрым переходом в карточку дефекта, осмотр и технику.
            </p>
          </div>
          <StatusButton onClick={() => void loadData()} status={loading ? 'loading' : 'idle'} loadingLabel="Обновляем…" className="btn btn-primary">
            Обновить
          </StatusButton>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Всего дефектов" value={defects.length} tone="info" />
          <StatCard label="Открытые" value={openDefects} tone="warning" />
          <StatCard label="Критические" value={criticalDefects} tone="danger" />
          <StatCard label="После ДТП" value={accidentDefects} tone="danger" />
        </section>

        <section className="card mb-6 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="label">Техника</span>
              <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} className="select">
                <option value="">Вся техника</option>
                {vehicleFilter && !selectedVehicle ? <option value={vehicleFilter}>Выбранная техника</option> : null}
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.number} · {vehicle.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Статус дефекта</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="select">
                <option value="">Все статусы</option>
                <option value="open">Открыт</option>
                <option value="in_progress">В работе</option>
                <option value="resolved">Устранён</option>
                <option value="reopened">Открыт повторно</option>
                <option value="closed">Закрыт</option>
              </select>
            </label>

            <label className="block">
              <span className="label">Критичность</span>
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="select">
                <option value="">Любая критичность</option>
                <option value="low">Низкая</option>
                <option value="medium">Средняя</option>
                <option value="high">Высокая</option>
                <option value="critical">Критическая</option>
              </select>
            </label>

            <label className="block">
              <span className="label">Регион</span>
              <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="select">
                <option value="">Все регионы</option>
                {uniqueRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Наличие данных</span>
              <select value={visibleRows} onChange={(event) => setVisibleRows(event.target.value as VisibleRowsFilter)} className="select">
                {(['all', 'withPhotos', 'withoutPhotos', 'withDescription', 'withoutDescription'] as VisibleRowsFilter[]).map((value) => (
                  <option key={value} value={value}>
                    {getVisibleRowsLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Тип осмотра</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as InspectionType | '')} className="select">
                <option value="">Все типы осмотра</option>
                <option value="quick">Быстрый</option>
                <option value="scheduled">Плановый</option>
                <option value="accident">ДТП</option>
              </select>
            </label>
          </div>
          {vehicleFilter ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-card bg-surface-soft px-4 py-3 text-sm text-foreground-secondary">
              <span>
                Показаны дефекты техники:{' '}
                <span className="font-medium text-foreground">
                  {selectedVehicle ? `${selectedVehicle.number} · ${selectedVehicle.name}` : 'выбранная техника'}
                </span>
              </span>
              <button type="button" onClick={() => setVehicleFilter('')} className="text-primary hover:underline">
                Показать все дефекты
              </button>
            </div>
          ) : null}
        </section>

        {error ? <div className="mb-4"><NoticeCard title="Не удалось загрузить дефекты" tone="danger" compact>{error}</NoticeCard></div> : null}

        {loading ? (
          <div className="table-card space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <section className="table-card">
            <div className="border-b border-line px-4 py-3 text-sm text-foreground-muted">
              Показано {filtered.length} из {defects.length}
            </div>
            <div className="table-scroll">
              <table className="min-w-full divide-y divide-line">
                <thead className="table-header">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Госномер</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Регион</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Техника</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Дефект</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Выявлен</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Осмотр</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Критичность</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Фото</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-foreground-muted">
                        Дефекты не найдены
                      </td>
                    </tr>
                  ) : (
                    filtered.map((defect) => (
                      <tr key={defect.id} className="hover:bg-surface-hover">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{defect.vehicle_number || 'Не указан'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-foreground-secondary">{defect.vehicle_region || '-'}</td>
                        <td className="px-4 py-3 text-foreground-secondary">{defect.vehicle_name || 'Не указана'}</td>
                        <td className="min-w-[260px] px-4 py-3">
                          <div className="font-medium text-foreground">{defect.title}</div>
                          {defect.comment ? <div className="mt-1 line-clamp-2 text-sm text-foreground-muted">{defect.comment}</div> : null}
                          {defect.accident_location ? (
                            <div className="mt-2 text-xs text-status-danger">ДТП: {defect.accident_location}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-foreground-secondary">{formatDateTime(defect.created_at)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={getTypeBadgeTone(defect.inspection_type)}>{getTypeLabel(defect.inspection_type)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={getStatusBadgeTone(defect.status)}>{getStatusLabel(defect.status)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={getSeverityTone(defect.severity)}>{getSeverityLabel(defect.severity)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-foreground-secondary">{defect.photos?.length ?? 0}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex flex-wrap gap-3 text-sm">
                            <Link href={`/defects/${defect.id}`} className="text-primary hover:underline">
                              Подробнее
                            </Link>
                            {defect.inspection_id ? (
                              <Link href={`/inspections/${defect.inspection_id}`} className="text-primary hover:underline">
                                Осмотр
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Layout>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  const toneClassName = {
    success: 'text-status-success',
    warning: 'text-status-warning',
    danger: 'text-status-danger',
    info: 'text-status-info',
  }[tone]

  return (
    <div className="card p-4">
      <div className={`text-2xl font-bold ${toneClassName}`}>{value}</div>
      <div className="mt-1 text-sm text-foreground-muted">{label}</div>
    </div>
  )
}
