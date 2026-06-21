'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { buildApiUrl } from '@/lib/api/client'
import type { VehicleDefectHistoryItem } from '@/lib/types'
import { formatDateTime, getPhotoFullUrl, getPhotoThumbUrl } from '../_lib/vehicleDetail'
import type { DefectHistoryEntry } from '../_lib/vehicleDetail'

type Props = {
  defects: VehicleDefectHistoryItem[]
  defectHistories: Record<string, DefectHistoryEntry[]>
  defectHistoriesVisible: Record<string, boolean>
  actionsDisabled: boolean
  onCloseDefect: (defectId: string) => void
  onReopenDefect: (defectId: string) => void
  onToggleHistory: (defectId: string) => void
}

export default function DefectsSection({
  defects, defectHistories, defectHistoriesVisible, actionsDisabled,
  onCloseDefect, onReopenDefect, onToggleHistory,
}: Props) {
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
              actionsDisabled={actionsDisabled}
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

type DefectCardProps = {
  defect: VehicleDefectHistoryItem
  history: DefectHistoryEntry[]
  historyVisible: boolean
  actionsDisabled: boolean
  onCloseDefect: (defectId: string) => void
  onReopenDefect: (defectId: string) => void
  onToggleHistory: (defectId: string) => void
}

function DefectCard({
  defect, history, historyVisible, actionsDisabled,
  onCloseDefect, onReopenDefect, onToggleHistory,
}: DefectCardProps) {
  const isClosed = defect.status === 'closed'
  const statusLabel = {
    open: 'Открыт',
    in_progress: 'В работе',
    resolved: 'Устранён',
    reopened: 'Открыт повторно',
    closed: 'Закрыт',
  }[defect.status || 'open'] || defect.status

  return (
    <div
      className="rounded-card border border-line bg-muted-surface p-4"
      data-testid={`defect-card-${defect.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            data-testid={`defect-title-${defect.id}`}
            className="font-medium text-foreground"
          >
            {defect.title}
          </div>
          <span
            data-testid={`defect-status-${defect.id}`}
            className={isClosed ? 'badge badge-success' : defect.status === 'reopened' ? 'badge badge-danger' : 'badge badge-warning'}
          >
            {statusLabel}
          </span>
          <span className={defect.severity === 'critical' ? 'badge badge-danger' : defect.severity === 'high' ? 'badge badge-warning' : 'badge badge-info'}>
            {defect.severity === 'critical' ? 'Критический' : defect.severity === 'high' ? 'Высокий' : defect.severity === 'low' ? 'Низкий' : 'Средний'}
          </span>
        </div>
        <span
          data-testid={`defect-type-${defect.id}`}
          className={defect.inspection_type === 'accident' ? 'badge badge-danger' : 'badge badge-info'}
        >
          {defect.inspection_type === 'accident' ? 'ДТП' : 'Осмотр'}
        </span>
      </div>

      <div
        data-testid={`defect-comment-${defect.id}`}
        className="mt-2 text-sm text-foreground-secondary"
      >
        {defect.comment || 'Описание отсутствует'}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground-muted">
        <div>Дата: {formatDateTime(defect.created_at)}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/defects/${defect.id}`} className="text-primary hover:underline">Открыть дефект</Link>
          {!isClosed ? (
            <button
              className="btn btn-danger btn-sm disabled:opacity-50"
              disabled={actionsDisabled}
              onClick={() => onCloseDefect(defect.id)}
            >
              Закрыть дефект
            </button>
          ) : (
            <button
              data-testid={`defect-reopen-${defect.id}`}
              className="btn btn-success btn-sm disabled:opacity-50"
              disabled={actionsDisabled}
              onClick={() => onReopenDefect(defect.id)}
            >
              Вернуть в работу
            </button>
          )}
        </div>
      </div>

      {defect.photos.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {defect.photos.map((photo) => (
            <a
              key={photo.url}
              href={buildApiUrl(getPhotoFullUrl(photo))}
              target="_blank"
              rel="noreferrer"
              className="block rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              title="Открыть фото дефекта"
            >
              <img
                src={buildApiUrl(getPhotoThumbUrl(photo))}
                alt="Фото дефекта"
                className="h-20 w-full rounded-control object-cover transition-opacity hover:opacity-90"
              />
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <button
          className="text-sm text-primary hover:underline"
          onClick={() => onToggleHistory(defect.id)}
        >
          История
        </button>
        {historyVisible ? (
          <div
            data-testid={`defect-history-block-${defect.id}`}
            className="mt-2 text-xs text-foreground-secondary"
          >
            {history.length === 0 ? 'История пустая' : history.map((item) => (
              <div key={item.id}>
                {item.changed_at} - {item.status}
                {item.comment ? `: ${item.comment}` : ''}{' '}
                {item.changed_by_name ? `(${item.changed_by_name})` : item.changed_by ? `(${item.changed_by})` : ''}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
