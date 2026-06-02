'use client'

import Link from 'next/link'
import type { NotificationItem } from '@/lib/types'

export function NotificationsCard({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-status-warning">Напоминания о плановых осмотрах</h2>
        <span className="text-sm text-foreground-muted">{notifications.length} шт.</span>
      </div>
      <div className="space-y-2">
        {notifications.slice(0, 3).map((notification) => (
          <div
            key={notification.vehicle_id}
            className={`flex items-center justify-between gap-3 rounded-card p-3 ${
              notification.is_overdue ? 'alert-danger' : 'alert-warning'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{notification.is_overdue ? '!' : '*'}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{notification.vehicle_number}</p>
                <p className="text-xs text-foreground-secondary">
                  {notification.is_overdue
                    ? `Просрочено на ${Math.abs(notification.days_until)} дн.`
                    : `До срока ${notification.days_until} дн.`}
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
