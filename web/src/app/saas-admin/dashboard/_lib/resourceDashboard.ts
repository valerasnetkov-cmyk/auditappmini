export function formatNumber(value?: number | null): string {
  return Number(value || 0).toLocaleString('ru-RU')
}

export function formatCurrency(value?: number | null): string {
  return `${formatNumber(value)} ₽`
}

export function formatPercent(value?: number | null): string {
  if (value === null || value === undefined) return 'без лимита'
  return `${formatNumber(value)}%`
}

export function formatLimit(current?: number | null, limit?: number | null): string {
  return `${formatNumber(current)} / ${limit === null || limit === undefined ? '∞' : formatNumber(limit)}`
}

export function formatDate(value?: string | null): string {
  if (!value) return 'нет активности'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'нет активности'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatBytes(value?: number | null): string {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10} МБ`
  return `${Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10} ГБ`
}

export function severityClass(severity?: string): string {
  if (severity === 'high' || severity === 'blocked' || severity === 'churn') {
    return 'bg-red-50 text-red-700 ring-red-100'
  }
  if (severity === 'medium' || severity === 'upsell' || severity === 'watch') {
    return 'bg-amber-50 text-amber-700 ring-amber-100'
  }
  if (severity === 'inactive') {
    return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
}

export function riskLabel(value?: string): string {
  const labels: Record<string, string> = {
    ok: 'норма',
    watch: 'наблюдать',
    upsell: 'апсейл',
    blocked: 'лимит',
    churn: 'отток',
    attention: 'внимание',
    inactive: 'неактивна',
    high: 'высокий',
    medium: 'средний',
  }
  return labels[value || 'ok'] || value || 'норма'
}

export function moduleLabel(enabled?: boolean | null): string {
  return enabled ? 'вкл' : 'выкл'
}
