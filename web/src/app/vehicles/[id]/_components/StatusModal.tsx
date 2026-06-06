'use client'

import type { VehicleStatus } from '@/lib/types'
import { statusOptions } from '../_lib/vehicleDetail'

type Props = {
  vehicleStatus: VehicleStatus
  newStatus: VehicleStatus
  statusReason: string
  updating: boolean
  onNewStatusChange: (status: VehicleStatus) => void
  onReasonChange: (reason: string) => void
  onClose: () => void
  onSave: () => void
}

const statusClass: Record<VehicleStatus, string> = {
  active: 'border-status-success bg-green-50 text-status-success',
  repair: 'border-status-warning bg-yellow-50 text-status-warning',
}

const statusLabel: Record<VehicleStatus, string> = {
  active: 'В работе',
  repair: 'Ремонт',
}

export default function StatusModal({
  vehicleStatus, newStatus, statusReason, updating,
  onNewStatusChange, onReasonChange, onClose, onSave,
}: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-md p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Изменить статус техники</h3>

        <div className="mb-4">
          <label className="label">Новый статус</label>
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((status) => {
              const selected = newStatus === status
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onNewStatusChange(status)}
                  className={`rounded-control border px-4 py-3 text-center ${selected ? statusClass[status] : 'border-line'}`}
                >
                  {statusLabel[status]}
                </button>
              )
            })}
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
          <button
            onClick={onSave}
            disabled={updating || !newStatus || newStatus === vehicleStatus}
            className="btn btn-primary disabled:opacity-50"
          >
            {updating ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
