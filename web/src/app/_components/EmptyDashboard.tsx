'use client'

export function EmptyDashboard({
  canSeed,
  seeding,
  disabled,
  restrictionMessage,
  onSeed,
}: {
  canSeed: boolean
  seeding: boolean
  disabled: boolean
  restrictionMessage: string
  onSeed: () => void
}) {
  return (
    <section className="mb-6 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center shadow-card">
      <h2 className="text-lg font-semibold text-foreground">Данных пока нет</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-foreground-secondary">
        {canSeed
          ? 'Можно заполнить систему демо-данными или начать с добавления реальной техники.'
          : 'Попросите менеджера добавить технику или подготовить демо-данные для первого запуска.'}
      </p>
      {restrictionMessage ? (
        <p className="mx-auto mt-4 max-w-2xl rounded-card bg-red-50 px-4 py-3 text-sm text-status-danger">
          {restrictionMessage}
        </p>
      ) : null}
      {canSeed ? (
        <button onClick={onSeed} disabled={seeding || disabled} className="btn btn-success mt-4 disabled:opacity-50">
          {seeding ? 'Создание...' : 'Создать демо-данные'}
        </button>
      ) : null}
    </section>
  )
}
