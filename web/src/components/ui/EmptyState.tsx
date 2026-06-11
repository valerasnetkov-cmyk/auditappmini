import type { ReactNode } from 'react'
import { InboxIcon } from '@heroicons/react/24/outline'

export function EmptyState({
  title,
  description,
  action,
  notice,
}: {
  title: string
  description: string
  action?: ReactNode
  notice?: ReactNode
}) {
  return (
    <section className="ui-empty">
      <InboxIcon aria-hidden="true" className="ui-empty__icon" />
      <h2>{title}</h2>
      <p>{description}</p>
      {notice ? <div className="ui-empty__notice">{notice}</div> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </section>
  )
}
