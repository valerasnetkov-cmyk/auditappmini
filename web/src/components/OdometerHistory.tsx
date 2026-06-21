'use client'

import { useMemo } from 'react'
import type { InspectionRecord } from '@/lib/types'

type OdometerHistoryProps = {
  inspections: InspectionRecord[]
}

type OdometerPoint = {
  id: string
  date: string
  label: string
  value: number
  delta: number | null
  unit: string
  type: InspectionRecord['type']
}

const numberFormatter = new Intl.NumberFormat('ru-RU')

export default function OdometerHistory({ inspections }: OdometerHistoryProps) {
  const points = useMemo(() => {
    return inspections
      .map((inspection) => ({ inspection, value: Number(inspection.odometer_value) }))
      .filter(({ value }) => Number.isFinite(value))
      .sort((a, b) => (
        new Date(a.inspection.completed_at || a.inspection.created_at).getTime()
        - new Date(b.inspection.completed_at || b.inspection.created_at).getTime()
      ))
      .map(({ inspection, value }, index, ordered): OdometerPoint => {
        const date = inspection.completed_at || inspection.created_at
        const previousValue = index > 0 ? ordered[index - 1].value : null
        return {
          id: inspection.id,
          date,
          label: formatDate(date),
          value,
          delta: previousValue === null ? null : value - previousValue,
          unit: inspection.odometer_unit || 'km',
          type: inspection.type,
        }
      })
  }, [inspections])

  const latest = points[points.length - 1]
  const previous = points[points.length - 2]
  const minValue = points.length ? Math.min(...points.map((point) => point.value)) : 0
  const maxValue = points.length ? Math.max(...points.map((point) => point.value)) : 0
  const delta = latest && previous ? latest.value - previous.value : null
  const totalDelta = points.length > 1 ? maxValue - minValue : null

  return (
    <article className="card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Показания одометра</h2>
          <p className="mt-1 text-sm text-foreground-muted">Динамика пробега по завершённым осмотрам техники.</p>
        </div>
        {latest ? (
          <div className="rounded-card bg-muted-surface px-4 py-3 text-sm">
            <div className="text-foreground-muted">Последнее показание</div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              {numberFormatter.format(latest.value)} {formatUnit(latest.unit)}
            </div>
          </div>
        ) : null}
      </div>

      {points.length === 0 ? (
        <div className="rounded-card border border-dashed border-line p-6 text-sm text-foreground-muted">
          Данных одометра пока нет. Они появятся после сохранения показаний пробега в осмотре.
        </div>
      ) : (
        <>
          <OdometerChart points={points} minValue={minValue} maxValue={maxValue} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Точек истории" value={String(points.length)} />
            <Metric
              label="Изменение с прошлого осмотра"
              value={delta === null ? 'недоступно' : `${delta >= 0 ? '+' : ''}${numberFormatter.format(delta)} ${formatUnit(latest.unit)}`}
            />
            <Metric
              label="Диапазон истории"
              value={totalDelta === null ? 'недоступно' : `${numberFormatter.format(totalDelta)} ${formatUnit(latest.unit)}`}
            />
          </div>
          <div className="mt-4 overflow-hidden rounded-card border border-line">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted-surface px-4 py-2 text-xs font-semibold text-foreground-muted">
              <span>Осмотр</span>
              <span>Одометр</span>
              <span>С прошлого</span>
            </div>
            {points.slice(-5).reverse().map((point) => (
              <div key={point.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-line px-4 py-2 text-sm">
                <span className="text-foreground-secondary">{point.label}</span>
                <span className="font-medium text-foreground">{numberFormatter.format(point.value)} {formatUnit(point.unit)}</span>
                <span className={point.delta !== null && point.delta < 0 ? 'font-semibold text-status-danger' : 'font-semibold text-status-success'}>
                  {formatDelta(point.delta, point.unit)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  )
}

function OdometerChart({ points, minValue, maxValue }: { points: OdometerPoint[]; minValue: number; maxValue: number }) {
  const chartWidth = 640
  const chartHeight = 210
  const padding = { top: 20, right: 18, bottom: 42, left: 68 }
  const plotWidth = chartWidth - padding.left - padding.right
  const plotHeight = chartHeight - padding.top - padding.bottom
  const valueRange = Math.max(1, maxValue - minValue)
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0

  const coordinates = points.map((point, index) => {
    const x = padding.left + (points.length > 1 ? index * xStep : plotWidth / 2)
    const y = padding.top + plotHeight - ((point.value - minValue) / valueRange) * plotHeight
    return { ...point, x, y }
  })

  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const ticks = buildTicks(minValue, maxValue)

  return (
    <div className="overflow-x-auto">
      <svg className="min-w-[540px] overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="График показаний одометра">
        <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="8" fill="transparent" />
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - ((tick - minValue) / valueRange) * plotHeight
          return (
            <g key={tick}>
              <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-foreground-muted)">
                {compactNumber(tick)}
              </text>
            </g>
          )
        })}
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {coordinates.map((point) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="3">
              <title>{`${point.label}: ${numberFormatter.format(point.value)} ${formatUnit(point.unit)}, с прошлого: ${formatDelta(point.delta, point.unit)}`}</title>
            </circle>
            {point.delta !== null ? (
              <text x={point.x} y={Math.max(12, point.y - 12)} textAnchor="middle" fontSize="10" fill="var(--color-foreground-muted)">
                {formatDelta(point.delta, point.unit)}
              </text>
            ) : null}
            <text x={point.x} y={chartHeight - 18} textAnchor="middle" fontSize="11" fill="var(--color-foreground-secondary)">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-muted-surface px-4 py-3">
      <div className="text-xs text-foreground-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function buildTicks(minValue: number, maxValue: number) {
  if (minValue === maxValue) return [minValue]
  const middle = minValue + (maxValue - minValue) / 2
  return [maxValue, middle, minValue]
}

function compactNumber(value: number) {
  return numberFormatter.format(Math.round(value))
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  })
}

function formatUnit(unit: string) {
  return unit === 'mi' ? 'миль' : 'км'
}

function formatDelta(value: number | null, unit: string) {
  if (value === null) return 'первый'
  return `${value >= 0 ? '+' : ''}${numberFormatter.format(value)} ${formatUnit(unit)}`
}
