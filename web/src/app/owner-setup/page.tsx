'use client'

import { FormEvent, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import { hasAuthSession } from '@/lib/auth'

export default function OwnerSetupPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (hasAuthSession()) {
      window.location.href = '/dashboard'
      return
    }

    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') || '')
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('Ссылка активации недействительна или неполная.')
      return
    }

    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов.')
      return
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.')
      return
    }

    setLoading(true)
    try {
      const result = await api.completeOwnerSetup(token, password)
      if (result.data?.token) {
        window.location.href = '/users'
        return
      }

      setError(result.error || 'Не удалось активировать доступ.')
    } catch {
      setError('Ошибка соединения с сервером.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="text-center text-2xl font-bold text-slate-900">Активация доступа</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Создайте пароль владельца компании. После активации вы сможете управлять менеджерами и инспекторами своей компании.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Повторите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              autoComplete="new-password"
              required
            />
          </div>

          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Активация...' : 'Активировать доступ'}
          </button>
        </form>
      </div>
    </div>
  )
}
