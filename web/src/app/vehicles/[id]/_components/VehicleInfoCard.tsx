'use client'

import { formatDate } from '@/lib/dateUtils'
import type { VehicleDetail } from '@/lib/types'

type Props = {
  vehicle: VehicleDetail
}

export default function VehicleInfoCard({ vehicle }: Props) {
  const schedule = vehicle.inspection_schedule
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Карточка техники</h2>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <InfoItem label="Госномер" value={vehicle.number} />
        <InfoItem label="Название" value={vehicle.name} />
        <InfoItem label="Регион" value={vehicle.region || 'Не указан'} />
        <InfoItem
          label="Последний плановый осмотр"
          value={vehicle.last_scheduled_inspection ? formatDate(vehicle.last_scheduled_inspection) : 'Нет данных'}
        />
        {schedule ? (
          <>
            <InfoItem
              label="Быстрый осмотр"
              value={formatSchedule(schedule.quick)}
            />
            <InfoItem
              label="Плановый осмотр"
              value={formatSchedule(schedule.planned)}
            />
          </>
        ) : null}
      </div>
    </section>
  )
}

function formatSchedule(schedule: NonNullable<VehicleDetail['inspection_schedule']>['quick']) {
  if (schedule.status === 'never_inspected') {
    return `Не проводился · каждые ${schedule.interval_days} дн.`
  }
  const nextDue = schedule.next_due ? formatDate(schedule.next_due) : 'нет срока'
  if (schedule.status === 'inspection_overdue') {
    return `Просрочен · срок ${nextDue} · каждые ${schedule.interval_days} дн.`
  }
  if (schedule.status === 'inspection_due_soon') {
    return `Скоро · срок ${nextDue} · каждые ${schedule.interval_days} дн.`
  }
  return `Актуален · следующий ${nextDue} · каждые ${schedule.interval_days} дн.`
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-foreground-muted">{label}:</span>
      <span className="ml-2 font-medium text-foreground">{value}</span>
    </div>
  )
}
