'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { InspectionDetail, InspectionReport } from '@/lib/types'
import { NoticeCard } from '@/components/ui'

export default function InspectionReportPage() {
  const params = useParams<{ id: string }>()
  const [inspection, setInspection] = useState<InspectionDetail | null>(null)
  const [report, setReport] = useState<InspectionReport | null>(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    void Promise.all([
      api.getInspection(params.id),
      api.getInspectionReport(params.id),
    ]).then(([inspectionResult, reportResult]) => {
      if (inspectionResult.error || reportResult.error) {
        setError(inspectionResult.error || reportResult.error || 'Отчёт недоступен')
        return
      }
      setInspection(inspectionResult.data || null)
      setReport(reportResult.data || null)
    })
  }, [params.id])

  const download = async () => {
    setDownloading(true)
    const result = await api.downloadInspectionReport(params.id)
    setDownloading(false)
    if (result.error || !result.data) {
      setError(result.error || 'Не удалось скачать отчёт')
      return
    }
    const url = URL.createObjectURL(result.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `inspection-${params.id}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout currentPage="inspections">
      <main className="p-6">
        <Link href={`/inspections/${params.id}`} className="text-sm text-blue-600 hover:underline">
          Назад к осмотру
        </Link>
        <section className="report-shell mx-auto mt-4 max-w-3xl rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">Проверка отчёта</h1>
          {error ? (
            <div className="mt-4"><NoticeCard title="Отчёт недоступен" tone="danger">{error}</NoticeCard></div>
          ) : null}
          {inspection && report ? (
            <div className="mt-6 space-y-4">
              <NoticeCard
                title={report.integrity_status === 'valid' ? 'Целостность подтверждена' : 'Целостность нарушена'}
                tone={report.integrity_status === 'valid' ? 'success' : 'danger'}
              >
                {report.integrity_status === 'valid'
                  ? `Файл проверен${report.verified_at ? ` ${new Date(report.verified_at).toLocaleString('ru-RU')}` : ''}.`
                  : 'Сохранённый SHA-256 не совпадает с файлом или PDF отсутствует. Сформируйте отчёт заново.'}
              </NoticeCard>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-sm text-slate-500">Техника</dt><dd className="font-semibold">{inspection.vehicle_number} · {inspection.vehicle_name}</dd></div>
                <div><dt className="text-sm text-slate-500">Тип</dt><dd className="font-semibold">{inspection.type}</dd></div>
                <div><dt className="text-sm text-slate-500">Отчёт</dt><dd className="font-mono text-sm">{report.id}</dd></div>
                <div><dt className="text-sm text-slate-500">Сформирован</dt><dd>{report.generated_at ? new Date(report.generated_at).toLocaleString('ru-RU') : 'не указано'}</dd></div>
                <div><dt className="text-sm text-slate-500">Размер</dt><dd>{report.file_size ? `${report.file_size} байт` : 'не указано'}</dd></div>
              </dl>
              <div>
                <p className="text-sm text-slate-500">SHA-256</p>
                <p className="break-all font-mono text-xs">{report.sha256}</p>
              </div>
              <button
                className="btn btn-primary"
                disabled={downloading || report.integrity_status !== 'valid'}
                onClick={() => void download()}
              >
                {downloading ? 'Скачивание…' : 'Скачать PDF'}
              </button>
            </div>
          ) : !error ? <p className="mt-6 text-slate-500">Загрузка…</p> : null}
        </section>
      </main>
    </Layout>
  )
}
