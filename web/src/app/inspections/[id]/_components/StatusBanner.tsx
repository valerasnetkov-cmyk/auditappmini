'use client'

import type { StatusTone } from '../_lib/checklist'
import { NoticeCard } from '@/components/ui'

export default function StatusBanner({
  message,
  tone,
}: {
  message: string
  tone: StatusTone
}) {
  if (!message) return null

  return <div className="mb-4"><NoticeCard title={tone === 'success' ? 'Готово' : 'Не удалось выполнить действие'} tone={tone === 'success' ? 'success' : 'danger'} compact>{message}</NoticeCard></div>
}
