'use client'

import type { ReactNode } from 'react'
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner'
import { Badge, ProgressBar, Skeleton, StatusButton, Tooltip, type UiTone } from '@/components/ui'
import type { CompanyFeatureAccess, CompanyResourceUsage, CompanyUsageResponse } from '@/lib/types'
import {
  formatBillingStatus,
  formatDate,
  formatMoney,
  formatPlanCode,
  formatUsageValue,
  getFeatureClassName,
  getFeatureLabel,
  getUsageHint,
} from '../_lib/settings'

function usageTone(usage: CompanyResourceUsage): UiTone {
  if (usage.exceeded) return 'danger'
  if (usage.percent !== null && usage.percent >= 90) return 'warning'
  return 'success'
}

function ResourceUsageCard({ title, usage, unit }: { title: string; usage: CompanyResourceUsage; unit: string }) {
  const percent = usage.unlimited ? 100 : Number(usage.percent || 0)
  const tone = usageTone(usage)
  return (
    <div className="rounded-card border border-line bg-muted-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{title}</p>
          <p className="mt-2 text-xl font-bold text-foreground">{formatUsageValue(usage)}</p>
        </div>
        <Badge tone={tone}>
          {usage.unlimited ? '∞' : `${usage.percent || 0}%`}
        </Badge>
      </div>
      <div className="mt-3"><ProgressBar value={percent} tone={tone} label={title} detail={usage.unlimited ? 'Без лимита' : `${percent}%`} /></div>
      <p className="mt-2 text-xs text-foreground-muted">{getUsageHint(usage, unit)}</p>
    </div>
  )
}

function FeatureStatusCard({ title, feature }: { title: ReactNode; feature: CompanyFeatureAccess }) {
  return (
    <div className={`rounded-card border px-3 py-2 text-sm font-semibold ${getFeatureClassName(feature)}`}>
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <Badge tone={feature.enabled ? 'success' : 'danger'}>{getFeatureLabel(feature)}</Badge>
      </div>
    </div>
  )
}

export function CompanyUsagePanel({
  usage,
  loading,
  onRefresh,
}: {
  usage: CompanyUsageResponse | null
  loading: boolean
  onRefresh: () => void
}) {
  if (loading && !usage) {
    return (
      <div className="card mb-4 p-4">
        <Skeleton className="h-5 w-48" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    )
  }

  if (!usage) return null

  return (
    <div className="card mb-4 p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Тариф и доступные модули</h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            Компания: <span className="font-semibold text-foreground">{usage.company.name}</span>
            <span className="mx-2 text-foreground-muted">·</span>
            Тариф: <span className="font-semibold text-foreground">{usage.plan.name || formatPlanCode(usage.plan.code)}</span>
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {formatMoney(usage.plan.monthlyPriceRub)}
            {usage.billing ? ` · ${formatBillingStatus(usage.billing.status)} · до ${formatDate(usage.billing.paidUntil || usage.billing.trialUntil)}` : ''}
          </p>
        </div>
        <StatusButton
          type="button"
          onClick={onRefresh}
          status={loading ? 'loading' : 'idle'}
          loadingLabel="Обновляем…"
        >
          Обновить
        </StatusButton>
      </div>

      <SubscriptionStatusBanner usage={usage} compact />

      <div className="grid gap-3 sm:grid-cols-2">
        <ResourceUsageCard title="Техника" usage={usage.usage.vehicles} unit="ед." />
        <ResourceUsageCard title="Пользователи" usage={usage.usage.users} unit="чел." />
        {usage.usage.inspectionsMonth ? <ResourceUsageCard title="Осмотры за месяц" usage={usage.usage.inspectionsMonth} unit="осм." /> : null}
        {usage.usage.storageGb ? <ResourceUsageCard title="Фото-хранилище" usage={usage.usage.storageGb} unit="ГБ" /> : null}
        {usage.usage.ocrMonth ? <ResourceUsageCard title="OCR за месяц" usage={usage.usage.ocrMonth} unit="запр." /> : null}
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        <FeatureStatusCard
          title={<Tooltip content="Распознавание государственного номера и показаний одометра по фотографии">OCR номера и одометра</Tooltip>}
          feature={usage.features.ocr}
        />
        <FeatureStatusCard title="ДТП-осмотры" feature={usage.features.accidentModule} />
        <FeatureStatusCard title="Аналитика" feature={usage.features.analytics} />
        {usage.features.pdfReport ? <FeatureStatusCard title="PDF-отчёты" feature={usage.features.pdfReport} /> : null}
        {usage.features.export ? <FeatureStatusCard title="Экспорт отчётов" feature={usage.features.export} /> : null}
        {usage.features.apiAccess ? <FeatureStatusCard title="API-доступ" feature={usage.features.apiAccess} /> : null}
        {usage.features.brandedReports ? <FeatureStatusCard title="Брендированные отчёты" feature={usage.features.brandedReports} /> : null}
        {usage.features.regionalStorage ? <FeatureStatusCard title="Региональное хранение" feature={usage.features.regionalStorage} /> : null}
      </div>

      <p className="mt-3 text-xs text-foreground-muted">
        История осмотров и фото сохраняется даже при окончании оплаты. Если лимит почти исчерпан,
        его можно увеличить без смены всей системы.
      </p>
    </div>
  )
}
