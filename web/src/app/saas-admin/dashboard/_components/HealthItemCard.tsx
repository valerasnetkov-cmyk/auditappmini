'use client'

import type { SaasHealthItem } from '@/lib/types'
import { Badge, NoticeCard, type UiTone } from '@/components/ui'
import { formatNumber } from '../_lib/resourceDashboard'

function healthTone(severity: string): UiTone {
  if (severity === 'danger' || severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warning'
  return 'info'
}

export function HealthItemCard({ item }: { item: SaasHealthItem }) {
  return (
    <NoticeCard
      title={item.title}
      tone={healthTone(item.severity)}
      action={<Badge tone={healthTone(item.severity)}>{formatNumber(item.count)}</Badge>}
    >
      <p>{item.description}</p>
      {item.actionLabel ? (
        <a className="mt-2 inline-flex font-semibold text-primary hover:text-primary-hover" href={item.actionHref || '/saas-admin'}>
          {item.actionLabel}
        </a>
      ) : null}
    </NoticeCard>
  )
}
