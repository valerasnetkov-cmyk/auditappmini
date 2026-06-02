import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { api } from '../api'

export function useLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = useCallback(async (onSuccess: () => void) => {
    if (!email || !password) {
      setError('Заполните email и пароль')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.login(email, password)
      setError('')
      onSuccess()
    } catch (e: unknown) {
      const err = e as { message?: string }
      setError(err.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }, [email, password])

  const setInitialError = useCallback((message: string) => setError(message), [])

  return { email, setEmail, password, setPassword, loading, error, handleLogin, setError: setInitialError }
}
