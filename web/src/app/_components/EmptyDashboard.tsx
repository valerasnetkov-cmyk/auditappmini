'use client'

import { EmptyState, NoticeCard, StatusButton } from '@/components/ui'

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
    <div className="mb-6">
      <EmptyState
        title="Данных пока нет"
        description={canSeed
          ? 'Можно заполнить систему демо-данными или начать с добавления реальной техники.'
          : 'Попросите менеджера добавить технику или подготовить демо-данные для первого запуска.'}
        notice={restrictionMessage ? <NoticeCard title="Действие недоступно" tone="warning" compact>{restrictionMessage}</NoticeCard> : null}
        action={canSeed ? (
          <StatusButton onClick={onSeed} disabled={disabled} status={seeding ? 'loading' : 'idle'} loadingLabel="Создаём данные…">
            Создать демо-данные
          </StatusButton>
        ) : null}
      />
    </div>
  )
}
