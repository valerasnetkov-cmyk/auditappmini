import type { ReactNode } from 'react'

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="ui-tooltip">
      <span className="ui-tooltip__trigger" tabIndex={0} aria-describedby={`tooltip-${content.replace(/\W+/g, '-').toLowerCase()}`}>
        {children}
      </span>
      <span id={`tooltip-${content.replace(/\W+/g, '-').toLowerCase()}`} className="ui-tooltip__content" role="tooltip">
        {content}
      </span>
    </span>
  )
}
