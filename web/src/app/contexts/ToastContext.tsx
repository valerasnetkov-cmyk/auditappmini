"use client";
import React, { createContext, useContext, useState } from 'react'

type ToastContextValue = {
  showToast: (text: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(null), 1800)
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: '#334155',
            color: 'white',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 9999,
          }}
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
