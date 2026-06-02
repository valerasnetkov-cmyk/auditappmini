'use client'

import type { SaasAuditLog } from '@/lib/types'
import { formatDateTime } from '../_lib/companyDetail'

type Props = {
  logs: SaasAuditLog[]
}

export default function AuditLogs({ logs }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-4">
        <h2 className="text-base font-semibold text-gray-950">Журнал действий</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Действие</th>
              <th className="px-4 py-3">Объект</th>
              <th className="px-4 py-3">Кто</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-gray-950">{log.action}</td>
                <td className="px-4 py-3">{log.entityType || 'resource'} {log.entityId ? `· ${log.entityId}` : ''}</td>
                <td className="px-4 py-3">{log.actorName || log.actorEmail || log.actorRole || 'system'}</td>
              </tr>
            ))}
            {!logs.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>Журнал пока пуст</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
