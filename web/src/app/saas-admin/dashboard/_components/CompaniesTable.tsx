'use client'

import Link from 'next/link'
import type { SaasCompanyStats } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  formatLimit,
  formatNumber,
  formatPercent,
  moduleLabel,
  riskLabel,
  severityClass,
} from '../_lib/resourceDashboard'

export function CompaniesTable({
  companies,
  totalCount,
}: {
  companies: SaasCompanyStats[]
  totalCount: number
}) {
  if (!totalCount) {
    return <div className="p-4"><EmptyState>Компании еще не созданы</EmptyState></div>
  }
  if (!companies.length) {
    return <div className="p-4"><EmptyState>Компании не найдены по выбранным фильтрам</EmptyState></div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Компания</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Тариф / MRR</th>
            <th className="px-4 py-3">Владельцы</th>
            <th className="px-4 py-3">Техника</th>
            <th className="px-4 py-3">Осмотры 30д</th>
            <th className="px-4 py-3">Дефекты</th>
            <th className="px-4 py-3">ДТП</th>
            <th className="px-4 py-3">Модули</th>
            <th className="px-4 py-3">Последняя активность</th>
            <th className="px-4 py-3">Действие</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {companies.map((company) => (
            <tr key={company.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-950">{company.name}</div>
                <div className="text-xs text-gray-500">{company.slug || company.id}</div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.healthStatus)}`}>
                    {riskLabel(company.healthStatus)}
                  </span>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass(company.riskStatus)}`}>
                      {riskLabel(company.riskStatus)}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-950">{company.limits?.planCode || 'не назначен'}</div>
                <div className="text-xs text-gray-500">{formatCurrency(company.billing?.monthlyRevenueRub)}</div>
              </td>
              <td className="px-4 py-3">{formatNumber(company.owners)} / {formatNumber(company.users)}</td>
              <td className="px-4 py-3">
                <div>{formatLimit(company.usage?.vehicles, company.vehiclesLimit)}</div>
                <div className="text-xs text-gray-500">{formatPercent(company.vehiclesUsagePercent)}</div>
              </td>
              <td className="px-4 py-3">{formatNumber(company.inspections30d)}</td>
              <td className="px-4 py-3">{formatNumber(company.usage?.defects)}</td>
              <td className="px-4 py-3">{formatNumber(company.usage?.accidents)}</td>
              <td className="px-4 py-3 text-xs text-gray-600">
                OCR {moduleLabel(Boolean(company.limits?.ocrEnabled))}<br />
                Аналитика {moduleLabel(Boolean(company.limits?.analyticsEnabled))}<br />
                PDF {moduleLabel(Boolean(company.limits?.pdfReportEnabled))}<br />
                ДТП {moduleLabel(Boolean(company.limits?.accidentModuleEnabled))}
              </td>
              <td className="px-4 py-3">{formatDate(company.lastActivityAt)}</td>
              <td className="px-4 py-3">
                <Link className="text-sm font-medium text-blue-700 hover:text-blue-900" href={`/saas-admin/companies/${company.id}`}>
                  Настроить
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}
