import type { ReactNode } from 'react'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import type { UiTone } from './Badge'

const icons = {
  neutral: InformationCircleIcon,
  info: InformationCircleIcon,
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  danger: ExclamationCircleIcon,
}

export function NoticeCard({
  title,
  children,
  tone = 'info',
  action,
  compact = false,
}: {
  title: string
  children?: ReactNode
  tone?: UiTone
  action?: ReactNode
  compact?: boolean
}) {
  const Icon = icons[tone]
  return (
    <section className={`ui-notice ui-notice--${tone}${compact ? ' ui-notice--compact' : ''}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" className="ui-notice__icon" />
      <div className="ui-notice__content">
        <h2 className="ui-notice__title">{title}</h2>
        {children ? <div className="ui-notice__description">{children}</div> : null}
      </div>
      {action ? <div className="ui-notice__action">{action}</div> : null}
    </section>
  )
}
