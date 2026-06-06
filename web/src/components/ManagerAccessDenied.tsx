'use client'

import Link from 'next/link'

type ManagerAccessDeniedProps = {
  title?: string
  description?: string
}

export default function ManagerAccessDenied({
  title = 'Доступ ограничен',
  description = 'Эта страница доступна только менеджеру.',
}: ManagerAccessDeniedProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
      <h1 className="text-xl font-semibold text-amber-900">{title}</h1>
      <p className="mt-2 text-sm text-amber-800">{description}</p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-amber-900 shadow-sm ring-1 ring-amber-200 hover:bg-amber-100"
      >
        Вернуться на дашборд
      </Link>
    </div>
  )
}
