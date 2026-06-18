'use client'

import { useState } from 'react'
import type { InspectionApproval, InspectionApprovalStatus } from '@/lib/types'
import { Badge, NoticeCard, StatusButton } from '@/components/ui'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Не отправлен',
  submitted: 'На согласовании',
  approved: 'Согласован',
  rejected: 'Отклонён',
  revision_required: 'Нужна повторная фиксация',
}

function statusTone(status: InspectionApprovalStatus) {
  if (status === 'approved') return 'success' as const
  if (status === 'rejected') return 'danger' as const
  if (status === 'revision_required' || status === 'submitted') return 'warning' as const
  return 'neutral' as const
}

export default function InspectionApprovalCard({
  approval,
  canReview,
  loading,
  disabled,
  onSubmit,
  onReview,
}: {
  approval: InspectionApproval
  canReview: boolean
  loading: boolean
  disabled: boolean
  onSubmit: (comment: string) => Promise<void>
  onReview: (
    status: 'approved' | 'rejected' | 'revision_required',
    comment: string,
  ) => Promise<void>
}) {
  const [comment, setComment] = useState('')
  const canSubmit = ['draft', 'rejected', 'revision_required'].includes(approval.status)

  return (
    <section className="card mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Согласование осмотра</h2>
          <p className="mt-1 text-sm text-slate-500">
            Техническое завершение и управленческое решение учитываются отдельно.
          </p>
        </div>
        <Badge tone={statusTone(approval.status)}>
          {STATUS_LABELS[approval.status] || approval.status}
        </Badge>
      </div>

      {approval.status === 'revision_required' ? (
        <div className="mt-4">
          <NoticeCard title="Требуется новый осмотр" tone="warning" compact>
            Завершённый доказательный акт не редактируется. Зафиксируйте исправленные материалы новым осмотром.
          </NoticeCard>
        </div>
      ) : null}

      {approval.comment ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-medium">Последний комментарий:</span> {approval.comment}
        </div>
      ) : null}

      {(canSubmit || (canReview && approval.status === 'submitted')) ? (
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="approval-comment">
            Комментарий
          </label>
          <textarea
            id="approval-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={disabled || loading}
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder={canReview ? 'Причина решения' : 'Комментарий руководителю'}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {canSubmit ? (
              <StatusButton
                status={loading ? 'loading' : 'idle'}
                disabled={disabled || loading}
                onClick={() => void onSubmit(comment)}
                loadingLabel="Отправляем…"
              >
                Отправить на согласование
              </StatusButton>
            ) : null}
            {canReview && approval.status === 'submitted' ? (
              <>
                <button
                  className="btn btn-primary"
                  disabled={disabled || loading}
                  onClick={() => void onReview('approved', comment)}
                >
                  Согласовать
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={disabled || loading || !comment.trim()}
                  onClick={() => void onReview('revision_required', comment)}
                >
                  Вернуть
                </button>
                <button
                  className="btn btn-danger"
                  disabled={disabled || loading || !comment.trim()}
                  onClick={() => void onReview('rejected', comment)}
                >
                  Отклонить
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {approval.history.length > 0 ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">История решений</h3>
          <ol className="mt-3 space-y-3">
            {approval.history.map((entry) => (
              <li key={entry.id} className="text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(entry.to_status)}>
                    {STATUS_LABELS[entry.to_status] || entry.to_status}
                  </Badge>
                  <span>{entry.created_by_name || entry.created_by}</span>
                  <time>{new Date(entry.created_at).toLocaleString('ru-RU')}</time>
                </div>
                {entry.comment ? <p className="mt-1 pl-1">{entry.comment}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
