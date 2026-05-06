export type StatusTone = 'success' | 'warning' | 'danger' | 'info'

export const statusColorMap = {
  active: 'success',
  in_work: 'success',
  completed: 'success',
  ok: 'success',

  repair: 'warning',
  planned: 'warning',
  warning: 'warning',
  scheduled: 'warning',

  defect: 'danger',
  accident: 'danger',
  overdue: 'danger',
  error: 'danger',

  quick: 'info',
  draft: 'info',
  info: 'info',
} as const satisfies Record<string, StatusTone>

export const badgeClassName: Record<StatusTone, string> = {
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
  info: 'badge badge-info',
}

export const alertClassName: Record<StatusTone, string> = {
  success: 'alert-success',
  warning: 'alert-warning',
  danger: 'alert-danger',
  info: 'alert-info',
}

export function getStatusTone(status?: string | null): StatusTone {
  if (!status) return 'info'
  return statusColorMap[status as keyof typeof statusColorMap] || 'info'
}
