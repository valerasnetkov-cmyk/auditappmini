'use client'

import { formatDate } from '@/lib/dateUtils'
import type { VehicleDetail } from '@/lib/types'

type Props = {
  vehicle: VehicleDetail
}

export default function VehicleInfoCard({ vehicle }: Props) {
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
