'use client'

import type { ServiceNotificationRecipient } from '@/lib/types'
import { recipientRoleLabel } from '../_lib/settings'

export function ServiceNotificationRecipientsPanel({
  recipients,
  loading,
  saving,
  disabled,
  disabledMessage,
  onToggle,
}: {
  recipients: ServiceNotificationRecipient[]
  loading: boolean
  saving: boolean
  disabled: boolean
  disabledMessage: string
  onToggle: (id: string, enabled: boolean) => void
}) {
  return (
    <div className="card mb-4 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Сервисные уведомления</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Владелец получает уведомления всегда. Менеджеров можно подключить к предупреждениям по тарифу, лимитам и сервисным событиям.
        </p>
      </div>

      {disabledMessage ? (
        <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">{disabledMessage}</div>
      ) : null}

      {loading ? (
        <div className="h-20 animate-pulse rounded-card bg-soft-surface" />
      ) : (
        <div className="space-y-2">
          {recipients.map((recipient) => (
            <label
              key={recipient.id}
              className="flex items-center justify-between gap-4 rounded-card border border-line bg-muted-surface px-4 py-3"
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">{recipient.name}</span>
                <span className="block text-xs text-foreground-muted">
                  {recipient.email} · {recipientRoleLabel(recipient.role)}
                </span>
              </span>
              <input
                type="checkbox"
                checked={recipient.serviceNotificationsEnabled}
                disabled={recipient.locked || saving || disabled}
                onChange={(event) => onToggle(recipient.id, event.target.checked)}
                className="h-5 w-5 rounded border-line text-blue-600 disabled:opacity-50"
              />
            </label>
          ))}
          {!recipients.length ? (
            <p className="rounded-card border border-line bg-muted-surface px-4 py-3 text-sm text-foreground-muted">
              Активных владельцев и менеджеров пока нет.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
