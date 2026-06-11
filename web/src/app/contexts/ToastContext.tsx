"use client";
import React, { createContext, useContext, useState } from 'react'
import { Toast, type UiTone } from '@/components/ui'

type ToastContextValue = {
  showToast: (text: string, tone?: UiTone) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<{ text: string; tone: UiTone } | null>(null)

  const showToast = (text: string, tone: UiTone = 'success') => {
    setMessage({ text, tone })
    window.setTimeout(() => setMessage(null), 4000)
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? <Toast text={message.text} tone={message.tone} onClose={() => setMessage(null)} /> : null}
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
