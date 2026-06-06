'use client'

import { MetricCard } from './MetricCard'
import { formatBytes, formatNumber } from '../_lib/resourceDashboard'

export function StorageMetrics({
  storage,
  ocr,
}: {
  storage: { totalStorageBytes?: number | null; estimatedSavedBytes?: number | null; avgOriginalSizeBytes?: number | null; avgWebpSizeBytes?: number | null }
  ocr: { odometerSuccess?: number | null; companiesWithOcrDisabled?: number | null }
}) {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <MetricCard label="Хранилище" value={formatBytes(storage.totalStorageBytes)} hint={`Сэкономлено: ${formatBytes(storage.estimatedSavedBytes)}`} />
      <MetricCard label="Средний оригинал" value={formatBytes(storage.avgOriginalSizeBytes)} hint={`WebP: ${formatBytes(storage.avgWebpSizeBytes)}`} />
      <MetricCard label="OCR" value={formatNumber(ocr.odometerSuccess)} hint={`Компаний без OCR: ${formatNumber(ocr.companiesWithOcrDisabled)}`} />
    </div>
  )
}
