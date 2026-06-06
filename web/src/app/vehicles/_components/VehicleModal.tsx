'use client'

import type { ReactNode } from 'react'

export function VehicleModal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground" type="button">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
