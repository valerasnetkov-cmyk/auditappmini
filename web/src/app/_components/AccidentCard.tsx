'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { AccidentStats } from '@/lib/types'
import { formatDate } from '@/lib/dateUtils'

export function AccidentCard({ stats }: { stats: AccidentStats }) {
  const monthItems = useMemo(() => fillMonthGaps(stats.byMonth || []), [stats.byMonth])
  const maxCount = useMemo(() => Math.max(1, ...monthItems.map((item) => item.count)), [monthItems])
  const yAxisTicks = useMemo(() => buildYAxisTicks(maxCount), [maxCount])

  return (
    <article className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-status-danger">Статистика ДТП</h2>
        <span className="badge badge-success">{stats.daysWithoutAccident ?? 0} дн. без ДТП</span>
      </div>
      <div className="alert-danger mb-4 rounded-card p-6 text-center">
        <div className="text-5xl font-bold text-status-danger">{stats.total || 0}</div>
        <div className="mt-1 text-sm text-foreground-secondary">Всего ДТП</div>
      </div>
      {monthItems.length ? (
        <div className="mb-4 rounded-card border border-line bg-surface px-4 pb-3 pt-4">
          <div className="flex h-36 gap-3">
            <div className="flex w-5 shrink-0 flex-col justify-between text-right text-xs leading-none text-foreground-muted">
              {yAxisTicks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="absolute inset-0 flex flex-col justify-between">
                {yAxisTicks.map((tick) => (
                  <span key={tick} className="border-t border-line" />
                ))}
              </div>
              <div className="relative z-10 grid h-full items-end gap-3" style={{ gridTemplateColumns: `repeat(${monthItems.length}, minmax(34px, 1fr))` }}>
                {monthItems.map((item) => (
                  <div key={item.month} className="flex h-full items-end justify-center">
                    <div
                      className="w-full max-w-11 rounded-t-sm bg-[#4976c4]"
                      style={{ height: item.count ? `${Math.max(8, (item.count / maxCount) * 100)}%` : 0 }}
                      title={`${formatMonth(item.month)}: ${item.count} ДТП`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ml-8 mt-2 grid gap-3 text-center text-xs text-foreground-secondary" style={{ gridTemplateColumns: `repeat(${monthItems.length}, minmax(34px, 1fr))` }}>
            {monthItems.map((item) => (
              <span key={item.month} className="truncate" title={formatMonth(item.month)}>
                {formatMonthShort(item.month)}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
            {monthItems.map((item) => (
              <span key={item.month}>{formatMonthShort(item.month)}: {item.count}</span>
            ))}
            </div>
        </div>
      ) : null}
      {stats.recent?.length ? (
        <div className="space-y-2">
          {stats.recent.slice(0, 3).map((accident) => (
            <div key={accident.id} className="flex items-center justify-between gap-3 rounded-card bg-muted-surface p-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-foreground">{accident.vehicle_number}</span>
                <span className="ml-2 text-foreground-muted">{accident.vehicle_name}</span>
              </div>
              <span className="shrink-0 text-foreground-muted">{formatDate(accident.created_at)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <Link href="/inspections?type=accident" className="mt-4 block text-center text-sm font-medium text-primary hover:text-primary-hover">
        Все ДТП
      </Link>
    </article>
  )
}

function fillMonthGaps(items: { month: string; count: number }[]) {
  if (!items.length) return []

  const counts = new Map(items.map((item) => [item.month, item.count]))
  const firstDate = parseMonth(items[0].month)
  const lastDate = parseMonth(items[items.length - 1].month)
  if (!firstDate || !lastDate) return items

  const result: { month: string; count: number }[] = []
  const cursor = new Date(firstDate)
  while (cursor <= lastDate) {
    const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    result.push({ month, count: counts.get(month) || 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return result
}

function parseMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildYAxisTicks(maxCount: number) {
  const top = Math.max(1, Math.ceil(maxCount))
  return Array.from({ length: top + 1 }, (_, index) => top - index)
}

function formatMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date)
}

function formatMonthShort(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(date)
}
