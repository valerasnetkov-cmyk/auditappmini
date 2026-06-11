'use client'

import { EmptyState as SharedEmptyState } from '@/components/ui'

export function EmptyState({ children }: { children: string }) {
  return <SharedEmptyState title={children} description="Дополнительных действий сейчас не требуется." />
}
