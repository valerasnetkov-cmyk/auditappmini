'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { formatDate } from '@/lib/dateUtils'
import type { VehicleDefectHistoryItem } from '@/lib/types'
import { buildApiUrl } from '@/lib/api/client'
import { useToast } from '@/app/contexts/ToastContext'
import OdometerHistory from '@/components/OdometerHistory'
import type { InspectionRecord, UpdateVehiclePayload, VehicleDetail, VehicleHistoryEntry, VehicleStatus } from '@/lib/types'

type VehicleInspection = InspectionRecord

function getInspectionTypeLabel(type: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type
}

function getInspectionTypeStyle(type: string) {
  if (type === 'quick') return 'bg-blue-100 text-blue-800'
  if (type === 'scheduled') return 'bg-purple-100 text-purple-800'
  return 'bg-red-100 text-red-800'
}

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>()
  const vehicleId = params.id

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [inspections, setInspections] = useState<VehicleInspection[]>([])
  const [history, setHistory] = useState<VehicleHistoryEntry[]>([])
  const [defects, setDefects] = useState<VehicleDefectHistoryItem[]>([])
  const [defectHistories, setDefectHistories] = useState<Record<string, any[]>>({})
  const [defectHistoriesVisible, setDefectHistoriesVisible] = useState<Record<string, boolean>>({})
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState<VehicleStatus>('')
  const [statusReason, setStatusReason] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [vehicleRes, inspectionsRes, historyRes, defectsRes] = await Promise.all([
        api.getVehicle(vehicleId),
        api.getVehicleInspections(vehicleId, { limit: 50 }),
        api.getVehicleHistory(vehicleId),
        api.getVehicleDefects(vehicleId, { limit: 100 }),
      ])

      if (vehicleRes.error) {
        setError(vehicleRes.error)
        return
      }

      setVehicle(vehicleRes.data || null)
      setInspections(inspectionsRes.data || [])
      setHistory(historyRes.data || [])
      setDefects(defectsRes?.data || [])
    } catch {
      setError('Не удалось загрузить данные по технике')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async () => {
    if (!newStatus || !vehicle) return

    setUpdating(true)
    try {
      const payload: UpdateVehiclePayload = {
        number: vehicle.number,
        name: vehicle.name,
        status: newStatus,
        qr_code: vehicle.qr_code || undefined,
        region: vehicle.region || undefined,
        reason: statusReason.trim() || undefined,
      }

      const result = await api.updateVehicle(vehicleId, payload)
      if (result.error) {
        setError(result.error)
        return
      }

      setVehicle(result.data || vehicle)
      setShowStatusModal(false)
      setStatusReason('')

      const historyRes = await api.getVehicleHistory(vehicleId)
      setHistory(historyRes.data || [])
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !vehicle) {
    return (
      <Layout currentPage="vehicles">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="text-center">
            <p className="mb-4 text-red-600">{error || 'Техника не найдена'}</p>
            <Link href="/vehicles" className="text-blue-600 hover:underline">
              Назад к списку техники
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const totalInspections = inspections.length
  const accidentCount = inspections.filter((inspection) => inspection.type === 'accident').length
  const totalDefects = inspections.reduce((sum, inspection) => sum + (inspection.defects_count || 0), 0)

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Не указано'
    return new Date(value).toLocaleString('ru-RU')
  }

  const closeDefect = async (defectId: string) => {
    try {
      await api.closeDefect(defectId)
      await reloadDefects()
      showToast('Дефект закрыт')
    } catch {
      // ignore
    }
  }

  const reloadDefects = async () => {
    try {
      const res = await api.getVehicleDefects(vehicleId, { limit: 100 })
      setDefects(res.data || [])
    } catch {
      // ignore
    }
  }

  const toggleDefectHistory = async (defectId: string) => {
    const isVisible = defectHistoriesVisible[defectId] ?? false
    if (isVisible) {
      setDefectHistoriesVisible({ ...defectHistoriesVisible, [defectId]: false })
      return
    }
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const resp = await fetch(`/api/defects/${defectId}/history`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      })
      const data = await resp.json()
      setDefectHistories({ ...defectHistories, [defectId]: data || [] })
      setDefectHistoriesVisible({ ...defectHistoriesVisible, [defectId]: true })
    } catch {
      setDefectHistoriesVisible({ ...defectHistoriesVisible, [defectId]: false })
    }
  }

  return (
    <Layout currentPage="vehicles">
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/vehicles" className="mb-2 inline-block text-sm text-blue-600 hover:underline">
              Назад к списку техники
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{vehicle.number}</h1>
            <p className="mt-1 text-slate-500">{vehicle.name}</p>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/inspections/new?vehicle=${vehicle.id}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Провести осмотр
            </Link>
            <button
              onClick={() => {
                setNewStatus(vehicle.status)
                setShowStatusModal(true)
              }}
              className={`rounded-lg border px-4 py-2 ${
                vehicle.status === 'active'
                  ? 'border-green-300 bg-green-100 text-green-800 hover:bg-green-200'
                  : 'border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200'
              }`}
            >
              {vehicle.status === 'active' ? 'В работе' : 'Ремонт'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-slate-800">{totalInspections}</div>
            <div className="text-sm text-slate-500">Всего осмотров</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{vehicle.status === 'active' ? 'В работе' : 'Ремонт'}</div>
            <div className="text-sm text-slate-500">Текущий статус</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-red-600">{accidentCount}</div>
            <div className="text-sm text-slate-500">Осмотров типа ДТП</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-orange-600">{totalDefects}</div>
            <div className="text-sm text-slate-500">Всего дефектов</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Карточка техники</h2>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <span className="text-slate-500">Госномер:</span>
              <span className="ml-2 font-medium text-slate-800">{vehicle.number}</span>
            </div>
            <div>
              <span className="text-slate-500">Название:</span>
              <span className="ml-2 font-medium text-slate-800">{vehicle.name}</span>
            </div>
            <div>
              <span className="text-slate-500">Регион:</span>
              <span className="ml-2 font-medium text-slate-800">{vehicle.region || 'Не указан'}</span>
            </div>
            <div>
              <span className="text-slate-500">QR-код:</span>
              <span className="ml-2 font-medium text-slate-800">{vehicle.qr_code || 'Не указан'}</span>
            </div>
            <div>
              <span className="text-slate-500">Последний плановый осмотр:</span>
              <span className="ml-2 font-medium text-slate-800">
                {vehicle.last_scheduled_inspection ? formatDate(vehicle.last_scheduled_inspection) : 'Нет данных'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">История осмотров</h2>
          </div>

          {inspections.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Осмотров пока нет</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Дата</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Тип</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Инспектор</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Дефекты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inspections.map((inspection) => (
                  <tr key={inspection.id} className={inspection.type === 'accident' ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="whitespace-nowrap px-6 py-4">{formatDate(inspection.created_at)}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`rounded px-2 py-1 text-xs ${getInspectionTypeStyle(inspection.type)}`}>
                        {getInspectionTypeLabel(inspection.type)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">{inspection.inspector_name}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {inspection.defects_count > 0 ? (
                        <span className="text-red-600">{inspection.defects_count}</span>
                      ) : (
                        <span className="text-green-600">Нет</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-6">
            <OdometerHistory inspections={inspections} />
          </div>
        </div>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Дефекты на технике</h2>
            <span className="text-sm text-slate-500">Всего: {defects.length}</span>
          </div>
          {defects.length === 0 ? (
            <div className="text-sm text-slate-500">Дефекты зафиксированы отсутствуют</div>
          ) : (
            <div className="space-y-3">
              {defects.map((d) => (
                <div key={d.id} className="rounded-xl border p-4 flex flex-col gap-2" data-testid={`defect-card-${d.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div data-testid={`defect-title-${d.id}`} className="font-medium text-slate-900">{d.title}</div>
                      <span data-testid={`defect-status-${d.id}`} className={`text-xs px-2 py-1 rounded ${d.status === 'closed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {d.status ?? 'open'}
                      </span>
                    </div>
                    <span data-testid={`defect-type-${d.id}`} className={`text-xs px-2 py-1 rounded ${d.inspection_type === 'accident' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                      {d.inspection_type === 'accident' ? 'ДТП' : 'Осмотр'}
                    </span>
                  </div>
                  <div data-testid={`defect-comment-${d.id}`} className="text-sm text-slate-600">{d.comment || 'Описание отсутствует'}</div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div>Дата: {formatDateTime(d.created_at)}</div>
                    <div className="flex items-center gap-2">
                      <Link href={`/defects/${d.id}`} className="text-blue-600 hover:underline">Открыть дефект</Link>
                      <button className="rounded px-2 py-1 bg-red-100 text-red-800 hover:bg-red-200" onClick={() => closeDefect(d.id)}>Закрыть дефект</button>
                      {d.status === 'closed' ? (
                        <button data-testid={`defect-reopen-${d.id}`} className="rounded px-2 py-1 ml-2 bg-green-100 text-green-800 hover:bg-green-200" onClick={async () => {
                          await api.reopenDefect(d.id)
                          await reloadDefects()
                          showToast('Дефект повторно открыт')
                        }}>
                          Вернуть в работу
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {d.photos && d.photos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {d.photos.map((p) => (
                        <img key={p.url} src={buildApiUrl(p.url)} alt="Фото дефекта" className="h-20 w-full object-cover rounded" />
                      ))}
                    </div>
                  ) : null}
                  <div>
                    <button className="text-sm text-blue-600" onClick={() => toggleDefectHistory(d.id)}>
                      История
                    </button>
                    {defectHistoriesVisible[d.id] ? (
                      <div data-testid={`defect-history-block-${d.id}`} className="mt-2 text-xs text-slate-600">
                        {(defectHistories[d.id] ?? []).length === 0 ? 'История пустая' : (defectHistories[d.id] as any[]).map((h) => (
                          <div key={h.id}>{h.changed_at} - {h.status} {h.changed_by_name ? `(${h.changed_by_name})` : (h.changed_by ? `(${h.changed_by})` : '')}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {history.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">История изменения статуса</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {history.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        entry.old_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {entry.old_status === 'active' ? 'В работе' : 'Ремонт'}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        entry.new_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {entry.new_status === 'active' ? 'В работе' : 'Ремонт'}
                    </span>
                    {entry.reason ? <span className="italic text-slate-500">«{entry.reason}»</span> : null}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDate(entry.created_at)}
                    {entry.changed_by_name ? ` • ${entry.changed_by_name}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {showStatusModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Изменить статус техники</h3>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Новый статус</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewStatus('active')}
                  className={`rounded-lg border px-4 py-3 text-center ${
                    newStatus === 'active' ? 'border-green-500 bg-green-100 text-green-800' : 'border-slate-300'
                  }`}
                >
                  В работе
                </button>
                <button
                  type="button"
                  onClick={() => setNewStatus('repair')}
                  className={`rounded-lg border px-4 py-3 text-center ${
                    newStatus === 'repair' ? 'border-orange-500 bg-orange-100 text-orange-800' : 'border-slate-300'
                  }`}
                >
                  Ремонт
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Причина, если нужна</label>
              <textarea
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                placeholder="Например: обнаружены неисправности..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowStatusModal(false)
                  setStatusReason('')
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={handleStatusChange}
                disabled={updating || !newStatus || newStatus === vehicle.status}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  )
}
