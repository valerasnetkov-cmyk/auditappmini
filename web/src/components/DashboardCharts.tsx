'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { Chart, ChartConfiguration } from 'chart.js'
import { useTheme } from '@/lib/theme'
import type { CountByRegion, CountByStatus, CountByType, DailyCount, SaasCompanyStats } from '@/lib/types'

type ChartPalette = {
  blue: string
  green: string
  orange: string
  red: string
  purple: string
  cyan: string
  track: string
  text: string
  mutedText: string
  border: string
}

const fallbackPalette: ChartPalette = {
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#f43f5e',
  purple: '#a855f7',
  cyan: '#06b6d4',
  track: '#e2e8f0',
  text: '#0f172a',
  mutedText: '#64748b',
  border: '#e2e8f0',
}

function readCssVar(style: CSSStyleDeclaration, name: string, fallback: string) {
  return style.getPropertyValue(name).trim() || fallback
}

function useChartPalette() {
  useTheme()
  if (typeof document === 'undefined') return fallbackPalette

  const style = getComputedStyle(document.documentElement)
  return {
    blue: readCssVar(style, '--chart-blue', fallbackPalette.blue),
    green: readCssVar(style, '--chart-green', fallbackPalette.green),
    orange: readCssVar(style, '--chart-orange', fallbackPalette.orange),
    red: readCssVar(style, '--chart-red', fallbackPalette.red),
    purple: readCssVar(style, '--chart-purple', fallbackPalette.purple),
    cyan: readCssVar(style, '--chart-cyan', fallbackPalette.cyan),
    track: readCssVar(style, '--chart-track', fallbackPalette.track),
    text: readCssVar(style, '--color-text-primary', fallbackPalette.text),
    mutedText: readCssVar(style, '--color-text-muted', fallbackPalette.mutedText),
    border: readCssVar(style, '--color-border-default', fallbackPalette.border),
  }
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${value}T00:00:00`))
}

function ChartCanvas({
  configuration,
  ariaLabel,
}: {
  configuration: ChartConfiguration
  ariaLabel: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    let cancelled = false

    async function renderChart() {
      const canvas = canvasRef.current
      if (!canvas) return

      const { default: ChartJS } = await import('chart.js/auto')
      if (cancelled) return

      chartRef.current?.destroy()
      chartRef.current = new ChartJS(canvas, configuration)
    }

    void renderChart()

    return () => {
      cancelled = true
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [configuration])

  return (
    <div className="relative h-72 w-full">
      <canvas ref={canvasRef} aria-label={ariaLabel} role="img" />
    </div>
  )
}

export function DailyInspectionsChart({ items }: { items: DailyCount[] }) {
  const palette = useChartPalette()
  const configuration = useMemo<ChartConfiguration<'line'>>(
    () => ({
      type: 'line',
      data: {
        labels: items.map((item) => formatShortDate(item.date)),
        datasets: [
          {
            label: 'Осмотры',
            data: items.map((item) => item.count),
            borderColor: palette.blue,
            backgroundColor: `${palette.blue}33`,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            ticks: {
              color: palette.mutedText,
            },
            grid: {
              color: palette.border,
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: palette.mutedText,
              precision: 0,
            },
            grid: {
              color: palette.border,
            },
          },
        },
      },
    }),
    [items, palette],
  )

  return <ChartCanvas configuration={configuration} ariaLabel="График осмотров по дням" />
}

export function VehicleStatusChart({ items }: { items: CountByStatus[] }) {
  const palette = useChartPalette()
  const configuration = useMemo<ChartConfiguration<'doughnut'>>(
    () => ({
      type: 'doughnut',
      data: {
        labels: items.map((item) => (item.status === 'active' ? 'В работе' : item.status === 'repair' ? 'Ремонт' : item.status)),
        datasets: [
          {
            data: items.map((item) => item.count),
            backgroundColor: items.map((item) => (item.status === 'repair' ? palette.orange : palette.green)),
            borderColor: palette.track,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: palette.text,
              usePointStyle: true,
              boxWidth: 10,
            },
          },
        },
      },
    }),
    [items, palette],
  )

  return <ChartCanvas configuration={configuration} ariaLabel="Диаграмма техники по статусу" />
}

export function InspectionTypeChart({ items }: { items: CountByType[] }) {
  const palette = useChartPalette()
  const configuration = useMemo<ChartConfiguration<'bar'>>(
    () => {
      const colorsByType: Record<string, string> = {
        quick: palette.blue,
        scheduled: palette.purple,
        accident: palette.red,
      }

      return {
        type: 'bar',
        data: {
          labels: items.map((item) => (item.type === 'quick' ? 'Быстрый' : item.type === 'scheduled' ? 'Плановый' : item.type === 'accident' ? 'ДТП' : item.type)),
          datasets: [
            {
              label: 'Осмотры',
              data: items.map((item) => item.count),
              backgroundColor: items.map((item) => colorsByType[item.type] || palette.cyan),
              borderRadius: 10,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            x: {
              ticks: {
                color: palette.mutedText,
              },
              grid: {
                display: false,
              },
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: palette.mutedText,
                precision: 0,
              },
              grid: {
                color: palette.border,
              },
            },
          },
        },
      }
    },
    [items, palette],
  )

  return <ChartCanvas configuration={configuration} ariaLabel="График осмотров по типу" />
}

export function RegionBarChart({
  items,
  tone,
  ariaLabel,
}: {
  items: CountByRegion[]
  tone: 'info' | 'success' | 'danger'
  ariaLabel: string
}) {
  const palette = useChartPalette()
  const configuration = useMemo<ChartConfiguration<'bar'>>(
    () => {
      const chartColor = tone === 'danger' ? palette.red : tone === 'success' ? palette.green : palette.blue
      const visibleItems = items.slice(0, 5)

      return {
        type: 'bar',
        data: {
          labels: visibleItems.map((item) => item.region || 'Не указано'),
          datasets: [
            {
              label: 'Количество',
              data: visibleItems.map((item) => item.count),
              backgroundColor: chartColor,
              borderRadius: 10,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                color: palette.mutedText,
                precision: 0,
              },
              grid: {
                color: palette.border,
              },
            },
            y: {
              ticks: {
                color: palette.text,
              },
              grid: {
                display: false,
              },
            },
          },
        },
      }
    },
    [items, palette, tone],
  )

  return <ChartCanvas configuration={configuration} ariaLabel={ariaLabel} />
}

export function SaasCompanyActivityChart({ companies }: { companies: SaasCompanyStats[] }) {
  const palette = useChartPalette()
  const configuration = useMemo<ChartConfiguration<'bar'>>(
    () => {
      const visibleCompanies = [...companies]
        .sort((a, b) => (b.inspections + b.defects) - (a.inspections + a.defects))
        .slice(0, 8)

      return {
        type: 'bar',
        data: {
          labels: visibleCompanies.map((company) => company.name),
          datasets: [
            {
              label: 'Осмотры',
              data: visibleCompanies.map((company) => company.inspections),
              backgroundColor: palette.blue,
              borderRadius: 8,
            },
            {
              label: 'Дефекты',
              data: visibleCompanies.map((company) => company.defects),
              backgroundColor: palette.red,
              borderRadius: 8,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: palette.text,
                usePointStyle: true,
                boxWidth: 10,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                color: palette.mutedText,
                precision: 0,
              },
              grid: {
                color: palette.border,
              },
            },
            y: {
              ticks: {
                color: palette.text,
              },
              grid: {
                display: false,
              },
            },
          },
        },
      }
    },
    [companies, palette],
  )

  return <ChartCanvas configuration={configuration} ariaLabel="График активности компаний по осмотрам и дефектам" />
}
