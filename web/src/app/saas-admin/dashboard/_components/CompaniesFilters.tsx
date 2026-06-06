'use client'

export function CompaniesFilters({
  companySearch,
  planFilter,
  statusFilter,
  planOptions,
  onSearchChange,
  onPlanChange,
  onStatusChange,
}: {
  companySearch: string
  planFilter: string
  statusFilter: string
  planOptions: string[]
  onSearchChange: (value: string) => void
  onPlanChange: (value: string) => void
  onStatusChange: (value: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
      <input
        value={companySearch}
        onChange={(event) => onSearchChange(event.target.value)}
        className="rounded-lg border px-3 py-2 text-sm"
        placeholder="Поиск по компании..."
      />
      <select value={planFilter} onChange={(event) => onPlanChange(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
        <option value="all">Все тарифы</option>
        {planOptions.map((planCode) => (
          <option key={planCode} value={planCode}>{planCode === 'unassigned' ? 'Без тарифа' : planCode}</option>
        ))}
      </select>
      <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
        <option value="all">Все статусы</option>
        <option value="active">Активные</option>
        <option value="inactive">Неактивные</option>
        <option value="no-owner">Без владельца</option>
        <option value="no-limits">Без тарифа/лимитов</option>
        <option value="near-limit">Лимит 80%+</option>
        <option value="churn">Churn-risk</option>
        <option value="upsell">Upsell</option>
      </select>
    </div>
  )
}
