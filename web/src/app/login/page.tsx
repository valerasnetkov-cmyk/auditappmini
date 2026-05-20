'use client'

import { FormEvent, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import { getAuthToken } from '@/lib/auth'

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return '/'
  }

  return value
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nextPath, setNextPath] = useState('/')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const safeNextPath = getSafeNextPath(params.get('next'))
    const reason = params.get('reason')

    setNextPath(safeNextPath)

    if (reason === 'inactive') {
      setError('Ваша учетная запись отключена. Обратитесь к администратору.')
      return
    }

    if (reason === 'expired') {
      setError('Сессия истекла или была отозвана. Войдите снова.')
      return
    }

    if (getAuthToken()) {
      window.location.href = safeNextPath
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await api.login(email, password)

      if (result.data?.token) {
        window.location.href = nextPath
        return
      }

      if (result.data?.mfaRequired) {
        setError('Для этого пользователя требуется подтверждение MFA.')
        return
      }

      setError(result.error || 'Не удалось войти')
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="text-center text-2xl font-bold">Аудит техники</h1>
        <p className="mt-2 text-center text-gray-600">Войдите в систему, чтобы продолжить</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
