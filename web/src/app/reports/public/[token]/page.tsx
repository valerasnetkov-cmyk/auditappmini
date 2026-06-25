'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import api, { buildApiUrl } from '@/lib/api/client'
import type { PublicInspectionReport } from '@/lib/types'
import { Badge, NoticeCard } from '@/components/ui'

function formatDate(value?: string | null) {
  if (!value) return 'не указано'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU')
}

function formatSize(value?: number | null) {
  if (!value) return 'не указано'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`
  return `${(value / 1024 / 1024).toFixed(1)} МБ`
}

export default function PublicReportPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [report, setReport] = useState<PublicInspectionReport | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      setLoading(true)
      setError('')
      const result = await api.getPublicInspectionReport(token)
      if (cancelled) return

      if (result.error || !result.data) {
        setError(result.error || 'Публичная ссылка недоступна')
        setReport(null)
      } else {
        setReport(result.data)
      }
      setLoading(false)
    }

    void loadReport()
    return () => {
      cancelled = true
    }
  }, [token])

  const pdfUrl = report?.pdf_url ? buildApiUrl(report.pdf_url) : ''
  const isValid = report?.status === 'ready' && report?.integrity_status === 'valid'

  return (
    <main className="min-h-screen bg-app p-4 sm:p-8">
      <section className="mx-auto max-w-3xl">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase text-foreground-muted">AuditAvto</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Проверка отчёта осмотра</h1>
          <p className="mt-2 text-sm text-foreground-secondary">
            Публичная страница подтверждает, что PDF-отчёт был сформирован системой и файл не был изменён после проверки.
          </p>
        </header>

        <section className="card p-5 sm:p-6">
          {loading ? <p className="text-sm text-foreground-secondary">Загрузка отчёта...</p> : null}

          {!loading && error ? (
            <NoticeCard title="Отчёт недоступен" tone="danger">
              {error}
            </NoticeCard>
          ) : null}

          {!loading && report ? (
            <div className="space-y-5">
              <NoticeCard
                title={isValid ? 'Целостность подтверждена' : 'Целостность не подтверждена'}
                tone={isValid ? 'success' : 'danger'}
                action={<Badge tone={isValid ? 'success' : 'danger'}>{report.integrity_status || report.status}</Badge>}
              >
                {isValid
                  ? `Проверено${report.verified_at ? ` ${formatDate(report.verified_at)}` : ''}.`
                  : 'PDF отсутствует, повреждён или был изменён после формирования.'}
              </NoticeCard>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-foreground-muted">Компания</dt>
                  <dd className="mt-1 font-semibold text-foreground">{report.company.name || 'не указано'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-foreground-muted">Техника</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {report.vehicle.number || 'без номера'}{report.vehicle.name ? ` · ${report.vehicle.name}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-foreground-muted">Тип осмотра</dt>
                  <dd className="mt-1 text-foreground">{report.inspection.type}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-foreground-muted">Завершён</dt>
                  <dd className="mt-1 text-foreground">{formatDate(report.inspection.completed_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-foreground-muted">Отчёт сформирован</dt>
                  <dd className="mt-1 text-foreground">{formatDate(report.generated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-foreground-muted">Размер PDF</dt>
                  <dd className="mt-1 text-foreground">{formatSize(report.file_size)}</dd>
                </div>
              </dl>

              <div>
                <p className="text-xs font-medium uppercase text-foreground-muted">SHA-256</p>
                <p className="mt-1 break-all font-mono text-xs text-foreground-secondary">{report.sha256 || 'не указано'}</p>
              </div>

              {pdfUrl ? (
                <a
                  className={`btn ${isValid ? 'btn-primary' : 'btn-secondary pointer-events-none opacity-60'}`}
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть PDF
                </a>
              ) : (
                <NoticeCard title="PDF закрыт" tone="info">
                  PDF доступен только авторизованным пользователям или по разрешённой публичной ссылке.
                </NoticeCard>
              )}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  )
}
