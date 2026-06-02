'use client'

import type { SaasAdminStats } from '@/lib/types'
import { formatNumber } from '../_lib/resourceDashboard'
import { EmptyState } from './EmptyState'

export function ActivationFunnel({ stats }: { stats: SaasAdminStats }) {
  const funnel = stats.activation?.funnel
  if (!funnel) return <EmptyState>Нет данных для воронки активации</EmptyState>

  const steps: Array<[string, number | undefined]> = [
    ['Компании созданы', funnel.companiesCreated],
    ['Владелец назначен', funnel.ownerAssigned],
    ['Владелец входил', funnel.ownerLoggedIn],
    ['Техника добавлена', funnel.vehicleAdded],
    ['Первый осмотр', funnel.firstInspectionCreated],
    ['5+ осмотров', funnel.fiveInspectionsReached],
    ['Активны 30 дней', funnel.active30d],
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {steps.map(([label, value], index) => (
        <div key={label} className="rounded-lg border bg-white p-4">
          <div className="text-xs font-semibold uppercase text-blue-600">Шаг {index + 1}</div>
          <div className="mt-3 text-2xl font-semibold text-gray-950">{formatNumber(Number(value))}</div>
          <div className="mt-2 text-xs leading-5 text-gray-500">{label}</div>
        </div>
      ))}
    </div>
  )
}
