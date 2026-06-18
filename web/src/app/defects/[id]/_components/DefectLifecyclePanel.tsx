'use client'

import { useMemo, useState } from 'react'
import { StatusButton } from '@/components/ui'
import type { DefectRecord } from '@/lib/types'

const transitions: Record<string, { value: string; label: string }[]> = {
  open: [
    { value: 'in_progress', label: 'Взять в работу' },
    { value: 'resolved', label: 'Отметить устранённым' },
    { value: 'closed', label: 'Закрыть' },
  ],
  in_progress: [
    { value: 'resolved', label: 'Отметить устранённым' },
    { value: 'closed', label: 'Закрыть' },
  ],
  resolved: [
    { value: 'closed', label: 'Закрыть' },
    { value: 'reopened', label: 'Открыть повторно' },
  ],
  reopened: [
    { value: 'in_progress', label: 'Взять в работу' },
    { value: 'resolved', label: 'Отметить устранённым' },
  ],
  closed: [{ value: 'reopened', label: 'Открыть повторно' }],
}

export function DefectLifecyclePanel({
  defect,
  disabled,
  saving,
  onTransition,
}: {
  defect: DefectRecord
  disabled: boolean
  saving: boolean
  onTransition: (status: string, comment: string) => Promise<void>
}) {
  const options = useMemo(() => transitions[defect.status || 'open'] || [], [defect.status])
  const [status, setStatus] = useState(options[0]?.value || '')
  const [comment, setComment] = useState('')

  if (!options.length) return null

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">Управление дефектом</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Исходные данные осмотра не меняются. Здесь фиксируется только управленческий статус.
      </p>
      <div className="space-y-4">
        <label className="block">
          <span className="label">Новый статус</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="select">
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Комментарий руководителя</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="textarea min-h-24"
            placeholder="Что сделано или почему меняется статус"
          />
        </label>
        <StatusButton
          type="button"
          status={saving ? 'loading' : 'idle'}
          loadingLabel="Сохраняем..."
          disabled={disabled || !status || !comment.trim()}
          onClick={() => void onTransition(status, comment.trim()).then(() => setComment(''))}
          className="btn btn-primary disabled:opacity-50"
        >
          Сохранить статус
        </StatusButton>
      </div>
    </section>
  )
}
