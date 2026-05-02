import React from 'react'
import AppNavigator from './src/navigation/AppNavigator'
import ToastProvider from './src/contexts/ToastContext'
import React, { useEffect } from 'react'

export default function App() {
  // Optional: expose LAN base URL for mobile testing in dev
  useEffect(() => {
    // In development, you can override API base URL to test on LAN
    try {
      // @ts-ignore
      if (global.__DEV_API_BASE__) return
      // Example: (global as any).__DEV_API_BASE__ = 'http://192.168.1.100:3001/api'
    } catch {
      // nothing
    }
  }, [])
  return (
    <ToastProvider>
      <AppNavigator />
    </ToastProvider>
  )
}
