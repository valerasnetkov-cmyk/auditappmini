'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import {
  ArrowPathIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

export type ActionStatus = 'idle' | 'loading' | 'success' | 'error'

export function StatusButton({
  status = 'idle',
  children,
  loadingLabel = 'Сохраняем…',
  successLabel = 'Сохранено',
  errorLabel = 'Повторить',
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  status?: ActionStatus
  loadingLabel?: string
  successLabel?: string
  errorLabel?: string
  children: ReactNode
}) {
  const Icon = status === 'loading' ? ArrowPathIcon : status === 'success' ? CheckIcon : status === 'error' ? ExclamationCircleIcon : null
  const label = status === 'loading' ? loadingLabel : status === 'success' ? successLabel : status === 'error' ? errorLabel : children

  return (
    <button
      {...props}
      disabled={disabled || status === 'loading'}
      className={`ui-status-button ui-status-button--${status} ${className}`}
      aria-busy={status === 'loading'}
    >
      {Icon ? <Icon aria-hidden="true" className="ui-status-button__icon" /> : null}
      <span>{label}</span>
    </button>
  )
}
