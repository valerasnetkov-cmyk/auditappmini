'use client'

import Link from 'next/link'
import type { SaasAlert } from '@/lib/types'
import { statusTone } from '../_lib/companyDetail'

type Props = {
  alerts: SaasAlert[]
}

export default function AlertsList({ alerts }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
        <h2 className="text-base font-semibold text-gray-950">Уведомления</h2>
        <Link href="/saas-admin/alerts" className="text-sm font-medium text-blue-700">Открыть ленту</Link>
      </div>
      <div className="divide-y divide-gray-100">
        {alerts.slice(0, 8).map((alert) => (
          <div key={alert.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-gray-950">{alert.title}</div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(alert.status === 'new' ? alert.type : 'read')}`}>
                {alert.status}
              </span>
            </div>
            <div className="mt-1 text-sm leading-6 text-gray-500">{alert.message}</div>
          </div>
        ))}
        {!alerts.length ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">Уведомлений нет</div>
        ) : null}
      </div>
    </section>
  )
}
