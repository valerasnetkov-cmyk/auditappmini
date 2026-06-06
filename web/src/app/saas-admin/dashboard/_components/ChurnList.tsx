'use client'

import type { SaasChurnRiskCompany } from '@/lib/types'
import { formatDate, riskLabel, severityClass } from '../_lib/resourceDashboard'
import { EmptyState } from './EmptyState'

export function ChurnList({ companies }: { companies: SaasChurnRiskCompany[] }) {
  if (!companies.length) {
    return <EmptyState>Компаний с риском оттока не найдено</EmptyState>
  }
  return (
    <div className="space-y-3">
      {companies.slice(0, 6).map((company) => (
        <div key={company.companyId} className="rounded-lg border bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-gray-950">{company.companyName}</div>
              <div className="mt-1 text-xs text-gray-500">{company.reasons.join(', ')}</div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.riskLevel)}`}>
              {riskLabel(company.riskLevel)}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">Последняя активность: {formatDate(company.lastActivityAt)}</div>
        </div>
      ))}
    </div>
  )
}
