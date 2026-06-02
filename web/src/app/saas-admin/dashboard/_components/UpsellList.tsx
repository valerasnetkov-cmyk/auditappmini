'use client'

import type { SaasUpsellCandidate } from '@/lib/types'
import { formatCurrency } from '../_lib/resourceDashboard'
import { EmptyState } from './EmptyState'

export function UpsellList({ companies }: { companies: SaasUpsellCandidate[] }) {
  if (!companies.length) {
    return <EmptyState>Кандидатов на апсейл пока нет</EmptyState>
  }
  return (
    <div className="space-y-3">
      {companies.slice(0, 6).map((company) => (
        <div key={company.companyId} className="rounded-lg border bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-gray-950">{company.companyName}</div>
              <div className="mt-1 text-xs text-gray-500">{company.reason}</div>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
              +{formatCurrency(company.potentialMrr)}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Текущий тариф: {company.currentPlanCode || 'нет'} · Рекомендация: {company.recommendedPlanCode || 'уточнить'}
          </div>
        </div>
      ))}
    </div>
  )
}
