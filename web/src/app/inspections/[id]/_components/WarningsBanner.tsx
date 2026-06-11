'use client'

import { NoticeCard } from '@/components/ui'

export default function WarningsBanner({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null

  return (
    <div className="mb-4">
      <NoticeCard title="Не хватает данных для завершения" tone="warning">
        <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </NoticeCard>
    </div>
  )
}
