'use client'

import { useState } from 'react'
import api from '@/lib/api/client'

export function DemoLoginButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const result = await api.loginDemo()
      if (result.data?.token) {
        window.location.href = '/dashboard'
        return
      }
      setError(result.error === 'demo_unavailable'
        ? 'Публичное демо сейчас недоступно.'
        : (result.error || 'Не удалось открыть демо'))
    } catch {
      setError('Не удалось соединиться с сервером')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={handleLogin} disabled={loading} className="btn btn-primary min-w-44 disabled:opacity-60">
        {loading ? 'Открываем демо...' : 'Войти в демо'}
      </button>
      {error ? <p className="mt-3 text-sm text-status-danger">{error}</p> : null}
    </div>
  )
}
