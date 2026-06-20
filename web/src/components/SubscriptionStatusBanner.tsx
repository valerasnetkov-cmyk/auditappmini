'use client'

import type { CompanyServiceWarning, CompanyUsageResponse } from '@/lib/types'
import { Badge, NoticeCard, type UiTone } from '@/components/ui'

type Props = {
  usage: CompanyUsageResponse | null
  compact?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  trial: 'Пилот',
  active: 'Активен',
  expiring: 'Скоро закончится',
  grace: 'Льготный период',
  expired: 'Истек',
  suspended: 'Приостановлен',
}

function formatDate(value?: string | null) {
  if (!value) return null
  const [date] = value.split('T')
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return value
  return `${day}.${month}.${year}`
}

function formatMoney(value?: number | null) {
  const amount = Math.round(Number(value || 0))
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽/мес.`
}

function getTone(warnings: CompanyServiceWarning[]): UiTone {
  if (warnings.some((warning) => warning.severity === 'danger')) return 'danger'
  if (warnings.some((warning) => warning.severity === 'warning')) return 'warning'
  return 'info'
}

export default function SubscriptionStatusBanner({ usage, compact = false }: Props) {
  if (!usage?.subscription && !usage?.billing && !usage?.serviceWarnings?.length) return null

  const subscription = usage.subscription
  const billing = usage.billing
  const warnings = usage.serviceWarnings || []
  const tone = getTone(warnings)
  const status = subscription?.status || billing?.status || 'active'
  const periodEnd = formatDate(subscription?.currentPeriodEnd || billing?.paidUntil || billing?.trialUntil)
  const graceUntil = formatDate(subscription?.graceUntil)
  const hasWarnings = warnings.length > 0
  const daysLeft = subscription?.daysUntilEnd ?? billing?.daysLeft ?? null

  return (
    <div className="mb-4">
      <NoticeCard
        title="Статус тарифа"
        tone={tone}
        compact={compact}
        action={<Badge tone={tone}>{STATUS_LABELS[status] || status}</Badge>}
      >
          <p>
            {usage.company.name}
            {usage.plan.code ? ` · ${usage.plan.code.toUpperCase()}` : ''}
            {periodEnd ? ` · ${status === 'trial' ? 'пилот до' : 'оплачен до'} ${periodEnd}` : ''}
            {daysLeft !== null && daysLeft !== undefined ? ` · осталось ${Math.max(daysLeft, 0)} дн.` : ''}
            {graceUntil ? ` · льготный период до ${graceUntil}` : ''}
          </p>

        {status === 'trial' ? (
          <p className="mt-2 font-semibold">
            30 дней бесплатно для новых компаний
          </p>
        ) : subscription?.mrrRub ? (
          <p className="mt-2 font-semibold">
            {formatMoney(subscription.mrrRub)}
          </p>
        ) : null}

      {hasWarnings ? (
        <div className={`mt-4 grid gap-2 ${compact ? '' : 'md:grid-cols-2'}`}>
          {warnings.map((warning) => (
            <div key={`${warning.type}-${warning.title}`} className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="text-sm font-semibold">{warning.title}</p>
              <p className="mt-1 text-sm leading-5 text-foreground-secondary">{warning.message}</p>
            </div>
          ))}
        </div>
      ) : null}
      </NoticeCard>
    </div>
  )
}
