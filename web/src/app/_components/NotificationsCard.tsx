'use client'

import Link from 'next/link'
import type { NotificationItem } from '@/lib/types'
import { Badge } from '@/components/ui'

export function NotificationsCard({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-status-warning">Напоминания об осмотрах</h2>
        <Badge tone={notifications.some((item) => item.is_overdue) ? 'danger' : 'warning'}>{notifications.length} шт.</Badge>
      </div>
      <div className="space-y-2">
        {notifications.slice(0, 3).map((notification) => (
          <div
            key={`${notification.vehicle_id}-${notification.inspection_type || 'planned'}`}
            className={`flex items-center justify-between gap-3 rounded-card p-3 ${
              notification.is_overdue ? 'alert-danger' : 'alert-warning'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{notification.is_overdue ? '!' : '*'}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{notification.vehicle_number}</p>
                <p className="text-xs text-foreground-secondary">
                  {notification.inspection_type === 'quick' ? 'Быстрый' : 'Плановый'} осмотр: {' '}
                  {notification.schedule_status === 'never_inspected'
                    ? 'ещё не проводился'
                    : notification.is_overdue
                      ? `просрочено на ${Math.abs(notification.days_until || 0)} дн.`
                      : `до срока ${notification.days_until} дн.`}
                </p>
              </div>
            </div>
            <Link href={`/inspections?vehicle=${notification.vehicle_id}`} className="text-xs font-medium text-primary hover:underline">
              Осмотр
            </Link>
          </div>
        ))}
      </div>
      {notifications.length > 3 ? (
        <Link href="/settings" className="mt-3 block text-center text-sm text-primary hover:underline">
          Показать все ({notifications.length})
        </Link>
      ) : null}
    </section>
  )
}
