import React, { createContext, useContext, useState } from 'react'
import Toast from '../components/Toast'

type ToastType = 'success' | 'error'
type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type })
    global.setTimeout?.( () => setToast(null), 2500 )
  }

  const hideToast = () => setToast(null)

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'success'} onPress={hideToast} />
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

export default ToastContext
