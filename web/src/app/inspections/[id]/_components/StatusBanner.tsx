'use client'

import type { StatusTone } from '../_lib/checklist'

export default function StatusBanner({
  message,
  tone,
}: {
  message: string
  tone: StatusTone
}) {
  if (!message) return null

  const styles =
    tone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'

  return (
    <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${styles}`}>{message}</div>
  )
}
