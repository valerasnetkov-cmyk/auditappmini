'use client'

import OdometerHistory from '@/components/OdometerHistory'
import { formatDate } from '@/lib/dateUtils'
import type { InspectionRecord } from '@/lib/types'
import { getInspectionTypeLabel, getInspectionTypeStyle } from '../_lib/vehicleDetail'

type Props = {
  inspections: InspectionRecord[]
}

export default function InspectionsHistory({ inspections }: Props) {
  return (
    <section className="table-card mt-6">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">История осмотров</h2>
      </div>

      {inspections.length === 0 ? (
        <div className="p-12 text-center text-foreground-muted">Осмотров пока нет</div>
      ) : (
        <div className="table-scroll">
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
                <tr
                  key={inspection.id}
                  className={inspection.type === 'accident' ? 'alert-danger' : 'hover:bg-surface-hover'}
                >
                  <td className="whitespace-nowrap px-6 py-4">{formatDate(inspection.created_at)}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={getInspectionTypeStyle(inspection.type)}>
                      {getInspectionTypeLabel(inspection.type)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground-secondary">
                    {inspection.inspector_name}
                  </td>
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
