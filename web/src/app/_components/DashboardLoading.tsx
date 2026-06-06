'use client'

export function DashboardLoading() {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
      <p className="mt-3 text-foreground-muted">Загрузка данных...</p>
    </div>
  )
}
