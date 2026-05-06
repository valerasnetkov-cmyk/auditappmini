'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import OdometerHistory from '@/components/OdometerHistory'
import api, { buildApiUrl } from '@/lib/api/client'
import { getAuthToken, requireAuthToken } from '@/lib/auth'
import { formatDate } from '@/lib/dateUtils'
import type {
  InspectionRecord,
  UpdateVehiclePayload,
  VehicleDefectHistoryItem,
  VehicleDetail,
  VehicleHistoryEntry,
  VehicleStatus,
} from '@/lib/types'

type DefectHistoryEntry = {
  id: string
  status: string
  changed_at: string
  changed_by?: string | null
  changed_by_name?: string | null
}

function getInspectionTypeLabel(type: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

function getInspectionTypeStyle(type: string) {
  if (type === 'quick') return 'badge badge-info'
  if (type === 'scheduled') return 'badge badge-warning'
  return 'badge badge-danger'
}

function getVehicleStatusLabel(status?: string) {
  if (status === 'active') return 'В работе'
  if (status === 'repair') return 'Ремонт'
  return status || 'Не указано'
}

function getVehicleStatusBadgeClass(status?: string) {
  if (status === 'repair') return 'badge badge-warning'
  return 'badge badge-success'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Не указано'

  return date.toLocaleString('ru-RU')
}

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>()
  const vehicleId = params.id

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [history, setHistory] = useState<VehicleHistoryEntry[]>([])
  const [defects, setDefects] = useState<VehicleDefectHistoryItem[]>([])
  const [defectHistories, setDefectHistories] = useState<Record<string, DefectHistoryEntry[]>>({})
  const [defectHistoriesVisible, setDefectHistoriesVisible] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState<VehicleStatus>('')
  const [statusReason, setStatusReason] = useState('')
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState('')

  const showLocalToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }

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
      setDefects(defectsRes.data || [])
    } catch {
      setError('Не удалось загрузить данные по технике')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
  }, [])

  const reloadDefects = async () => {
    const result = await api.getVehicleDefects(vehicleId, { limit: 100 })
    setDefects(result.data || [])
  }

  const handleStatusChange = async () => {
    if (!newStatus || !vehicle) return

    setUpdating(true)
    try {
      const payload: UpdateVehiclePayload = {
        number: vehicle.number,
        name: vehicle.name,
        status: newStatus,
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
      showLocalToast('Статус техники обновлен')

      const historyRes = await api.getVehicleHistory(vehicleId)
      setHistory(historyRes.data || [])
    } finally {
      setUpdating(false)
    }
  }

  const closeDefect = async (defectId: string) => {
    const result = await api.closeDefect(defectId)
    if (result.error) {
      setError(result.error)
      return
    }

    await reloadDefects()
    showLocalToast('Дефект закрыт')
  }

  const reopenDefect = async (defectId: string) => {
    const result = await api.reopenDefect(defectId)
    if (result.error) {
      setError(result.error)
      return
    }

    await reloadDefects()
    showLocalToast('Дефект повторно открыт')
  }

  const toggleDefectHistory = async (defectId: string) => {
    const isVisible = defectHistoriesVisible[defectId] ?? false
    if (isVisible) {
      setDefectHistoriesVisible((current) => ({ ...current, [defectId]: false }))
      return
    }

    try {
      const token = getAuthToken()
      const response = await fetch(buildApiUrl(`/api/defects/${defectId}/history`), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const data = await response.json()
      setDefectHistories((current) => ({ ...current, [defectId]: data || [] }))
      setDefectHistoriesVisible((current) => ({ ...current, [defectId]: true }))
    } catch {
      setDefectHistoriesVisible((current) => ({ ...current, [defectId]: false }))
    }
  }

  if (loading) {
    return (
      <Layout currentPage="vehicles">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (error || !vehicle) {
    return (
      <Layout currentPage="vehicles">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="card max-w-lg p-8 text-center">
            <p className="mb-4 text-status-danger">{error || 'Техника не найдена'}</p>
            <Link href="/vehicles" className="text-primary hover:underline">
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

  return (
    <Layout currentPage="vehicles">
      <div className="p-6">
        {toast ? <div className="toast toast-success">{toast}</div> : null}

        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/vehicles" className="mb-2 inline-block text-sm text-primary hover:underline">
              Назад к списку техники
            </Link>
            <h1 className="page-title text-2xl">{vehicle.number}</h1>
            <p className="mt-1 text-foreground-muted">{vehicle.name}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/inspections/new?vehicle=${vehicle.id}`} className="btn btn-primary">
              Провести осмотр
            </Link>
            <button
              onClick={() => {
                setNewStatus(vehicle.status)
                setShowStatusModal(true)
              }}
              className={getVehicleStatusBadgeClass(vehicle.status)}
            >
              {getVehicleStatusLabel(vehicle.status)}
            </button>
          </div>
        </header>

        {error ? <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">{error}</div> : null}

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Всего осмотров" value={totalInspections} tone="info" />
          <StatCard label="Текущий статус" value={getVehicleStatusLabel(vehicle.status)} tone={vehicle.status === 'repair' ? 'warning' : 'success'} />
          <StatCard label="Осмотров типа ДТП" value={accidentCount} tone="danger" />
          <StatCard label="Всего дефектов" value={totalDefects} tone="warning" />
        </section>

        <VehicleInfoCard vehicle={vehicle} />
        <InspectionsHistory inspections={inspections} />
        <DefectsSection
          defects={defects}
          defectHistories={defectHistories}
          defectHistoriesVisible={defectHistoriesVisible}
          onCloseDefect={closeDefect}
          onReopenDefect={reopenDefect}
          onToggleHistory={toggleDefectHistory}
        />
        <StatusHistory history={history} />
      </div>

      {showStatusModal ? (
        <StatusModal
          vehicleStatus={vehicle.status}
          newStatus={newStatus}
          statusReason={statusReason}
          updating={updating}
          onNewStatusChange={setNewStatus}
          onReasonChange={setStatusReason}
          onClose={() => {
            setShowStatusModal(false)
            setStatusReason('')
          }}
          onSave={handleStatusChange}
        />
      ) : null}
    </Layout>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  const toneClassName = {
    success: 'text-status-success',
    warning: 'text-status-warning',
    danger: 'text-status-danger',
    info: 'text-status-info',
  }[tone]

  return (
    <div className="card p-4 text-center">
      <div className={`text-2xl font-bold ${toneClassName}`}>{value}</div>
      <div className="text-sm text-foreground-muted">{label}</div>
    </div>
  )
}

function VehicleInfoCard({ vehicle }: { vehicle: VehicleDetail }) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Карточка техники</h2>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <InfoItem label="Госномер" value={vehicle.number} />
        <InfoItem label="Название" value={vehicle.name} />
        <InfoItem label="Регион" value={vehicle.region || 'Не указан'} />
        <InfoItem label="Последний плановый осмотр" value={vehicle.last_scheduled_inspection ? formatDate(vehicle.last_scheduled_inspection) : 'Нет данных'} />
      </div>
    </section>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-foreground-muted">{label}:</span>
      <span className="ml-2 font-medium text-foreground">{value}</span>
    </div>
  )
}

function InspectionsHistory({ inspections }: { inspections: InspectionRecord[] }) {
  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">История осмотров</h2>
      </div>

      {inspections.length === 0 ? (
        <div className="p-12 text-center text-foreground-muted">Осмотров пока нет</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted">Дата</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted">Тип</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted">Инспектор</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted">Дефекты</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inspections.map((inspection) => (
                <tr key={inspection.id} className={inspection.type === 'accident' ? 'alert-danger' : 'hover:bg-surface-hover'}>
                  <td className="whitespace-nowrap px-6 py-4">{formatDate(inspection.created_at)}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={getInspectionTypeStyle(inspection.type)}>{getInspectionTypeLabel(inspection.type)}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground-secondary">{inspection.inspector_name}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {inspection.defects_count > 0 ? (
                      <span className="text-status-danger">{inspection.defects_count}</span>
                    ) : (
                      <span className="text-status-success">Нет</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <OdometerHistory inspections={inspections} />
      </div>
    </section>
  )
}

function DefectsSection({
  defects,
  defectHistories,
  defectHistoriesVisible,
  onCloseDefect,
  onReopenDefect,
  onToggleHistory,
}: {
  defects: VehicleDefectHistoryItem[]
  defectHistories: Record<string, DefectHistoryEntry[]>
  defectHistoriesVisible: Record<string, boolean>
  onCloseDefect: (defectId: string) => void
  onReopenDefect: (defectId: string) => void
  onToggleHistory: (defectId: string) => void
}) {
  return (
    <section className="card mt-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Дефекты на технике</h2>
        <span className="text-sm text-foreground-muted">Всего: {defects.length}</span>
      </div>
      {defects.length === 0 ? (
        <div className="text-sm text-foreground-muted">Дефекты отсутствуют</div>
      ) : (
        <div className="space-y-3">
          {defects.map((defect) => (
            <DefectCard
              key={defect.id}
              defect={defect}
              history={defectHistories[defect.id] || []}
              historyVisible={Boolean(defectHistoriesVisible[defect.id])}
              onCloseDefect={onCloseDefect}
              onReopenDefect={onReopenDefect}
              onToggleHistory={onToggleHistory}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function DefectCard({
  defect,
  history,
  historyVisible,
  onCloseDefect,
  onReopenDefect,
  onToggleHistory,
}: {
  defect: VehicleDefectHistoryItem
  history: DefectHistoryEntry[]
  historyVisible: boolean
  onCloseDefect: (defectId: string) => void
  onReopenDefect: (defectId: string) => void
  onToggleHistory: (defectId: string) => void
}) {
  const isClosed = defect.status === 'closed'

  return (
    <div className="rounded-card border border-line bg-muted-surface p-4" data-testid={`defect-card-${defect.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div data-testid={`defect-title-${defect.id}`} className="font-medium text-foreground">{defect.title}</div>
          <span data-testid={`defect-status-${defect.id}`} className={isClosed ? 'badge badge-success' : 'badge badge-warning'}>
            {isClosed ? 'Закрыт' : 'Открыт'}
          </span>
        </div>
        <span data-testid={`defect-type-${defect.id}`} className={defect.inspection_type === 'accident' ? 'badge badge-danger' : 'badge badge-info'}>
          {defect.inspection_type === 'accident' ? 'ДТП' : 'Осмотр'}
        </span>
      </div>

      <div data-testid={`defect-comment-${defect.id}`} className="mt-2 text-sm text-foreground-secondary">
        {defect.comment || 'Описание отсутствует'}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground-muted">
        <div>Дата: {formatDateTime(defect.created_at)}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/defects/${defect.id}`} className="text-primary hover:underline">Открыть дефект</Link>
          {!isClosed ? (
            <button className="btn btn-danger btn-sm" onClick={() => onCloseDefect(defect.id)}>Закрыть дефект</button>
          ) : (
            <button data-testid={`defect-reopen-${defect.id}`} className="btn btn-success btn-sm" onClick={() => onReopenDefect(defect.id)}>
              Вернуть в работу
            </button>
          )}
        </div>
      </div>

      {defect.photos.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {defect.photos.map((photo) => (
            <img key={photo.url} src={buildApiUrl(photo.url)} alt="Фото дефекта" className="h-20 w-full rounded-control object-cover" />
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <button className="text-sm text-primary hover:underline" onClick={() => onToggleHistory(defect.id)}>
          История
        </button>
        {historyVisible ? (
          <div data-testid={`defect-history-block-${defect.id}`} className="mt-2 text-xs text-foreground-secondary">
            {history.length === 0 ? 'История пустая' : history.map((item) => (
              <div key={item.id}>
                {item.changed_at} - {item.status} {item.changed_by_name ? `(${item.changed_by_name})` : item.changed_by ? `(${item.changed_by})` : ''}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatusHistory({ history }: { history: VehicleHistoryEntry[] }) {
  if (!history.length) return null

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">История изменения статуса</h2>
      </div>
      <div className="divide-y divide-line">
        {history.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className={getVehicleStatusBadgeClass(entry.old_status)}>{getVehicleStatusLabel(entry.old_status)}</span>
              <span className="text-foreground-muted">→</span>
              <span className={getVehicleStatusBadgeClass(entry.new_status)}>{getVehicleStatusLabel(entry.new_status)}</span>
              {entry.reason ? <span className="italic text-foreground-muted">"{entry.reason}"</span> : null}
            </div>
            <div className="text-xs text-foreground-muted">
              {formatDate(entry.created_at)}
              {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ''}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function StatusModal({
  vehicleStatus,
  newStatus,
  statusReason,
  updating,
  onNewStatusChange,
  onReasonChange,
  onClose,
  onSave,
}: {
  vehicleStatus: VehicleStatus
  newStatus: VehicleStatus
  statusReason: string
  updating: boolean
  onNewStatusChange: (status: VehicleStatus) => void
  onReasonChange: (reason: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-md p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Изменить статус техники</h3>

        <div className="mb-4">
          <label className="label">Новый статус</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNewStatusChange('active')}
              className={`rounded-control border px-4 py-3 text-center ${newStatus === 'active' ? 'border-status-success bg-green-50 text-status-success' : 'border-line'}`}
            >
              В работе
            </button>
            <button
              type="button"
              onClick={() => onNewStatusChange('repair')}
              className={`rounded-control border px-4 py-3 text-center ${newStatus === 'repair' ? 'border-status-warning bg-yellow-50 text-status-warning' : 'border-line'}`}
            >
              Ремонт
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Причина, если нужна</label>
          <textarea
            value={statusReason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Например: обнаружены неисправности..."
            className="textarea resize-none"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">
            Отмена
          </button>
          <button onClick={onSave} disabled={updating || !newStatus || newStatus === vehicleStatus} className="btn btn-primary disabled:opacity-50">
            {updating ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
