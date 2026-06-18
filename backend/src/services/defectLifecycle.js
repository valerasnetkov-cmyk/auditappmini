export const DEFECT_STATUSES = ['open', 'in_progress', 'resolved', 'reopened', 'closed']
export const DEFECT_SEVERITIES = ['low', 'medium', 'high', 'critical']

const transitions = {
  open: new Set(['in_progress', 'resolved', 'closed']),
  in_progress: new Set(['resolved', 'closed']),
  resolved: new Set(['closed', 'reopened']),
  reopened: new Set(['in_progress', 'resolved']),
  closed: new Set(['reopened']),
}

export function validateDefectTransition(fromStatus, toStatus, comment) {
  if (!DEFECT_STATUSES.includes(toStatus)) {
    return {
      error: 'DEFECT_STATUS_INVALID',
      message: 'Неизвестный статус дефекта',
    }
  }
  if (fromStatus === toStatus) return null
  if (!transitions[fromStatus]?.has(toStatus)) {
    return {
      error: 'DEFECT_STATUS_INVALID_TRANSITION',
      message: `Переход ${fromStatus} → ${toStatus} недоступен`,
    }
  }
  if (!String(comment || '').trim()) {
    return {
      error: 'DEFECT_STATUS_COMMENT_REQUIRED',
      message: 'Укажите комментарий к изменению статуса',
    }
  }
  return null
}
