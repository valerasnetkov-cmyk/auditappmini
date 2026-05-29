'use client'

import type { CompanyServiceWarning, CompanyUsageResponse } from '@/lib/types'

type Props = {
  usage: CompanyUsageResponse | null
  compact?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  expiring: 'Скоро закончится',
  grace: 'Льготный период',
  expired: 'Истек',
  suspended: 'Приостановлен',
}

const TONE_CLASS: Record<string, string> = {
  danger: 'border-red-200 bg-red-50 text-red-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
}

const BADGE_CLASS: Record<string, string> = {
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-700',
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

function getTone(warnings: CompanyServiceWarning[]) {
  if (warnings.some((warning) => warning.severity === 'danger')) return 'danger'
  if (warnings.some((warning) => warning.severity === 'warning')) return 'warning'
  return 'info'
}

export default function SubscriptionStatusBanner({ usage, compact = false }: Props) {
  if (!usage?.subscription && !usage?.serviceWarnings?.length) return null

  const subscription = usage.subscription
  const warnings = usage.serviceWarnings || []
  const tone = getTone(warnings)
  const status = subscription?.status || 'active'
  const periodEnd = formatDate(subscription?.currentPeriodEnd)
  const graceUntil = formatDate(subscription?.graceUntil)
  const hasWarnings = warnings.length > 0

  return (
    <section className={`mb-4 rounded-2xl border px-5 py-4 shadow-sm ${TONE_CLASS[tone] || TONE_CLASS.info}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={compact ? 'text-sm font-semibold' : 'text-base font-semibold'}>
              Статус тарифа
            </h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_CLASS[tone] || BADGE_CLASS.info}`}>
              {STATUS_LABELS[status] || status}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-current/80">
            {usage.company.name}
            {usage.plan.code ? ` · ${usage.plan.code.toUpperCase()}` : ''}
            {periodEnd ? ` · оплачен до ${periodEnd}` : ''}
            {graceUntil ? ` · льготный период до ${graceUntil}` : ''}
          </p>
        </div>

        {subscription?.mrrRub ? (
          <div className="shrink-0 rounded-xl bg-white/60 px-4 py-2 text-sm font-semibold text-current shadow-sm ring-1 ring-black/5">
            {formatMoney(subscription.mrrRub)}
          </div>
        ) : null}
      </div>

      {hasWarnings ? (
        <div className={`mt-4 grid gap-2 ${compact ? '' : 'md:grid-cols-2'}`}>
          {warnings.map((warning) => (
            <div key={`${warning.type}-${warning.title}`} className="rounded-xl bg-white/60 px-4 py-3 ring-1 ring-black/5">
              <p className="text-sm font-semibold">{warning.title}</p>
              <p className="mt-1 text-sm leading-5 text-current/75">{warning.message}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
