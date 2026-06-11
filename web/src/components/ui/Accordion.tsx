import type { ReactNode } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

export function Accordion({
  title,
  children,
  defaultOpen = false,
  className = '',
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details className={`ui-accordion ${className}`} open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <ChevronDownIcon aria-hidden="true" />
      </summary>
      <div className="ui-accordion__content">{children}</div>
    </details>
  )
}
