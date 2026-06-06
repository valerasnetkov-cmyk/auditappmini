'use client'

import type { SaasHealthItem } from '@/lib/types'
import { formatNumber, severityClass } from '../_lib/resourceDashboard'

export function HealthItemCard({ item }: { item: SaasHealthItem }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">{item.title}</h3>
          <p className="mt-2 text-xs leading-5 text-gray-500">{item.description}</p>
          {item.actionLabel ? (
            <a className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-900" href={item.actionHref || '/saas-admin'}>
              {item.actionLabel}
            </a>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(item.severity)}`}>
          {formatNumber(item.count)}
        </span>
      </div>
    </div>
  )
}
