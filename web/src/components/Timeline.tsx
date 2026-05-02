import React from 'react'

type TimelineItem = {
  id: string
  changed_at: string
  status?: string
  old_status?: string
  new_status?: string
  changed_by_name?: string
  changed_by?: string
  [key: string]: any
}

export default function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items || items.length === 0) {
    return <div className="text-sm text-slate-500">История пустая</div>
  }
  return (
    <div data-testid="defect-timeline" className="space-y-3">
      {items.map((it) => {
        const date = new Date(it.changed_at).toLocaleString('ru-RU')
        const label = it.old_status && it.new_status ? `${it.old_status} → ${it.new_status}` : it.status ?? ''
        return (
          <div key={it.id} data-testid={`defect-timeline-${it.id}`} className="flex items-start gap-3">
            <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" aria-label="timeline-point" />
            <div>
              <div className="text-sm text-slate-600">{date}</div>
              <div className="text-sm text-slate-700">
                {label} {it.changed_by_name ? `• ${it.changed_by_name}` : ''}{it.changed_by ? ` (${it.changed_by})` : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
