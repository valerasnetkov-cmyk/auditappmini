'use client'

import Link from 'next/link'
import { getTypeLabel, getTypeStyle } from '../_lib/checklist'
import type { InspectionDetail } from '@/lib/types'
import type { InspectionReport } from '@/lib/types'

export default function InspectionHeader({
  inspection,
  report,
  reportLoading,
  onGenerateReport,
  onDownloadReport,
}: {
  inspection: InspectionDetail
  report: InspectionReport | null
  reportLoading: boolean
  onGenerateReport: () => void
  onDownloadReport: () => void
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href="/inspections" className="mb-1 block text-sm text-blue-600 hover:underline">
          Назад к осмотрам
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Осмотр техники</h1>
        <p className="mt-1 text-slate-500">
          {inspection.vehicle_number} · {inspection.vehicle_name}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span className={`inline-block rounded px-2 py-1 text-xs ${getTypeStyle(inspection.type)}`}>
          {getTypeLabel(inspection.type)}
        </span>
        {inspection.completed ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={onGenerateReport}
              disabled={reportLoading}
              className="btn btn-secondary"
            >
              {reportLoading ? 'Формирование…' : report ? 'Сформировать заново' : 'Сформировать отчёт'}
            </button>
            {report?.status === 'ready' && report.integrity_status === 'valid' ? (
              <button
                onClick={onDownloadReport}
                disabled={reportLoading}
                className="btn btn-primary"
              >
                Скачать PDF
              </button>
            ) : null}
            {report?.generated_at ? (
              <span className="w-full text-right text-xs text-slate-500">
                Сформирован {new Date(report.generated_at).toLocaleString('ru-RU')}
              </span>
            ) : null}
            {report && report.integrity_status !== 'valid' ? (
              <span className="w-full text-right text-xs text-red-600">
                Целостность отчёта не подтверждена
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
