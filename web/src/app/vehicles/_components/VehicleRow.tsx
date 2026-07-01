'use client'

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { buildApiUrl } from '@/lib/api/client'
import type { VehicleRecord } from '@/lib/types'
import { getStatusBadgeClass, getStatusLabel } from '../_lib/vehicles'

const scheduleLabels = {
  inspection_actual: 'Актуален',
  inspection_due_soon: 'Скоро',
  inspection_overdue: 'Просрочен',
  never_inspected: 'Не осматривался',
}

const scheduleClasses = {
  inspection_actual: 'badge badge-success',
  inspection_due_soon: 'badge badge-warning',
  inspection_overdue: 'badge badge-danger',
  never_inspected: 'badge badge-secondary',
}

export function VehicleRow({
  vehicle,
  hiddenColumns,
  selected,
  actionsDisabled,
  onEdit,
  onArchive,
  onToggleSelected,
}: {
  vehicle: VehicleRecord
  hiddenColumns: string[]
  selected: boolean
  actionsDisabled: boolean
  onEdit: (vehicle: VehicleRecord) => void
  onArchive: (id: string) => void
  onToggleSelected: (id: string) => void
}) {
  const isArchived = vehicle.status === 'archived'
  const primaryPhotoUrl = vehicle.primary_photo_thumb_url || vehicle.primary_photo_webp_url || vehicle.primary_photo_url

  return (
    <tr className="hover:bg-surface-hover">
      <td className="whitespace-nowrap px-6 py-4">
        <input
          type="checkbox"
          checked={selected}
          disabled={isArchived || actionsDisabled}
          onChange={() => onToggleSelected(vehicle.id)}
          aria-label={`Выбрать технику ${vehicle.number}`}
          className="h-4 w-4 rounded border-line disabled:opacity-40"
        />
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/vehicles/${vehicle.id}`}
          className="flex h-[42px] w-14 items-center justify-center overflow-hidden rounded border border-line bg-muted-surface text-foreground-muted"
          aria-label={`Открыть карточку техники ${vehicle.number}`}
        >
          {primaryPhotoUrl ? (
            <img
              src={buildApiUrl(primaryPhotoUrl)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-[10px] font-semibold uppercase leading-none" aria-hidden="true">Фото</span>
          )}
        </Link>
      </td>
      {!hiddenColumns.includes('number') ? (
        <td className="whitespace-nowrap px-6 py-4 font-medium">
          <Link href={`/vehicles/${vehicle.id}`} className="text-primary hover:underline">
            {vehicle.number}
          </Link>
        </td>
      ) : null}
      {!hiddenColumns.includes('name') ? <td className="px-6 py-4 text-foreground">{vehicle.name}</td> : null}
      {!hiddenColumns.includes('region') ? <td className="px-6 py-4 text-foreground-secondary">{vehicle.region || '-'}</td> : null}
      {!hiddenColumns.includes('status') ? (
        <td className="whitespace-nowrap px-6 py-4">
          <span className={getStatusBadgeClass(vehicle.status)}>{getStatusLabel(vehicle.status)}</span>
        </td>
      ) : null}
      {!hiddenColumns.includes('defectsCount') ? (
        <td className="px-6 py-4">
          {(vehicle.defectsCount || 0) > 0 ? (
            <span className="font-medium text-status-danger">{vehicle.defectsCount}</span>
          ) : (
            <span className="font-medium text-status-success">Нет</span>
          )}
        </td>
      ) : null}
      {!hiddenColumns.includes('inspectionSchedule') ? (
        <td className="px-6 py-4">
          {vehicle.inspection_schedule ? (
            <span className={scheduleClasses[vehicle.inspection_schedule.status]}>
              {formatScheduleLabel(vehicle.inspection_schedule)}
            </span>
          ) : (
            <span className="text-foreground-muted">Нет данных</span>
          )}
        </td>
      ) : null}
      <td className="px-6 py-4 text-center">
        {!isArchived ? (
          <span className="mr-3 text-xs text-foreground-muted" title="Осмотр проводится только в мобильном приложении">
            Осмотр: mobile
          </span>
        ) : null}
        <button onClick={() => onEdit(vehicle)} disabled={actionsDisabled} className="mr-3 text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">
          Изменить
        </button>
        {!isArchived ? (
          <button onClick={() => onArchive(vehicle.id)} disabled={actionsDisabled} className="text-status-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50">
            В архив
          </button>
        ) : null}
      </td>
    </tr>
  )
}

function formatScheduleLabel(schedule: NonNullable<VehicleRecord['inspection_schedule']>) {
  const days = schedule.planned.days_until ?? schedule.quick.days_until
  const baseLabel = scheduleLabels[schedule.status]
  if (days === null || days === undefined) return baseLabel
  if (days < 0) return `${baseLabel}: ${Math.abs(days)} дн.`
  if (days === 0) return `${baseLabel}: сегодня`
  return `${baseLabel}: ${days} дн.`
}
