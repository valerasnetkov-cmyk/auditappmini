'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import type { UiTone } from './Badge'

export function Toast({
  text,
  tone = 'info',
  onClose,
}: {
  text: string
  tone?: UiTone
  onClose?: () => void
}) {
  return (
    <div className={`ui-toast ui-toast--${tone}`} role={tone === 'danger' ? 'alert' : 'status'} aria-live={tone === 'danger' ? 'assertive' : 'polite'}>
      <span>{text}</span>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Закрыть уведомление">
          <XMarkIcon aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
