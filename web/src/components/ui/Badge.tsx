import type { ReactNode } from 'react'

export type UiTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: UiTone }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>
}
