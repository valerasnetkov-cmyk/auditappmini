import React from 'react'

type TimelineItem = {
  id: string
  changed_at: string
  status?: string
  old_status?: string
  new_status?: string
  changed_by_name?: string | null
  changed_by?: string | null
}

function getStatusLabel(status?: string) {
  if (status === 'open') return 'Открыт'
  if (status === 'closed') return 'Закрыт'
  return status || 'Изменение'
}

export default function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items || items.length === 0) {
    return <div className="text-sm text-foreground-muted">История пока пустая</div>
  }

  return (
    <div data-testid="defect-timeline" className="space-y-3">
      {items.map((item) => {
        const date = new Date(item.changed_at).toLocaleString('ru-RU')
        const label = item.old_status && item.new_status
          ? `${getStatusLabel(item.old_status)} -> ${getStatusLabel(item.new_status)}`
          : getStatusLabel(item.status)

        return (
          <div key={item.id} data-testid={`defect-timeline-${item.id}`} className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 rounded-full bg-primary" aria-label="timeline-point" />
            <div>
              <div className="text-sm text-foreground-muted">{date}</div>
              <div className="text-sm text-foreground-secondary">
                {label}
                {item.changed_by_name ? ` · ${item.changed_by_name}` : ''}
                {!item.changed_by_name && item.changed_by ? ` · ${item.changed_by}` : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
