let globalTimezoneOffset = 3

export function setTimezoneOffset(hours: number) {
  globalTimezoneOffset = hours
}

export function getTimezoneOffset(): number {
  return globalTimezoneOffset
}

export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const localDate = new Date(date.getTime() + globalTimezoneOffset * 60 * 60 * 1000)
  return localDate.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function formatDateTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const localDate = new Date(date.getTime() + globalTimezoneOffset * 60 * 60 * 1000)
  return localDate.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const localDate = new Date(date.getTime() + globalTimezoneOffset * 60 * 60 * 1000)
  return localDate.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
