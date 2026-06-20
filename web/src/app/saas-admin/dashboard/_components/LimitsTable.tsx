'use client'

import type { SaasLimitUsageCompany } from '@/lib/types'
import {
  formatLimit,
  formatPercent,
  moduleLabel,
  riskLabel,
  severityClass,
} from '../_lib/resourceDashboard'
import { EmptyState } from './EmptyState'

export function LimitsTable({ companies }: { companies: SaasLimitUsageCompany[] }) {
  if (!companies.length) {
    return <div className="p-4"><EmptyState>Нет данных по лимитам</EmptyState></div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Компания</th>
            <th className="px-4 py-3">Тариф</th>
            <th className="px-4 py-3">Техника</th>
            <th className="px-4 py-3">Пользователи</th>
            <th className="px-4 py-3">Модули</th>
            <th className="px-4 py-3">Риск</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {companies.map((company) => (
            <tr key={company.companyId}>
              <td className="px-4 py-3 font-medium text-gray-950">{company.companyName}</td>
              <td className="px-4 py-3">{company.planCode || 'не назначен'}</td>
              <td className="px-4 py-3">
                <div>{formatLimit(company.vehiclesUsed, company.vehiclesLimit)}</div>
                <div className="text-xs text-gray-500">{formatPercent(company.vehiclesUsagePercent)}</div>
              </td>
              <td className="px-4 py-3">
                <div>{formatLimit(company.usersUsed, company.usersLimit)}</div>
                <div className="text-xs text-gray-500">{formatPercent(company.usersUsagePercent)}</div>
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                OCR {moduleLabel(company.ocrEnabled)} · ДТП {moduleLabel(company.accidentModuleEnabled)} · PDF {moduleLabel(company.pdfReportEnabled)} · API {moduleLabel(company.apiAccessEnabled)}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.riskLevel)}`}>
                  {riskLabel(company.riskLevel)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
