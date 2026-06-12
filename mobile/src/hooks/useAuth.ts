import { useCallback, useEffect, useState } from 'react'
import { api, isAuthSessionError, setAuthSessionHandler } from '../api'
import type { User } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionMessage, setSessionMessage] = useState('')

  const checkAuth = useCallback(async () => {
    try {
      const u = await api.getMe()
      setUser(u)
      setSessionMessage('')
    } catch (e: unknown) {
      const err = e as { message?: string }
      console.log('Auth check failed:', err.message)
      setUser(null)
      setSessionMessage(isAuthSessionError(e) ? (err.message ?? '') : '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setAuthSessionHandler((error) => {
      setSessionMessage(error.message)
      setUser(null)
      setLoading(false)
    })
    queueMicrotask(() => { void checkAuth() })
    return () => setAuthSessionHandler(null)
  }, [checkAuth])

  const reset = () => {
    setUser(null)
    setSessionMessage('')
  }

  return { user, setUser, loading, sessionMessage, setSessionMessage, checkAuth, reset }
}
