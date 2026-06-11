'use client'

import { FormEvent, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import { hasAuthSession } from '@/lib/auth'
import type { AuthUser } from '@/lib/types'

type LoginFormVariant = 'landing' | 'standalone'

interface LoginFormProps {
  defaultNextPath?: string
  showAccessAction?: boolean
  variant?: LoginFormVariant
}

const ACCESS_EMAIL = 'info@auditavto.ru'

function getSafeNextPath(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return fallback
  }

  return value
}

function getPostLoginPath(user: AuthUser | undefined, nextPath: string) {
  if (user?.role === 'admin') return '/saas-admin/dashboard'
  return nextPath || '/dashboard'
}

export default function LoginForm({
  defaultNextPath = '/dashboard',
  showAccessAction = true,
  variant = 'standalone',
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nextPath, setNextPath] = useState(defaultNextPath)

  const isLanding = variant === 'landing'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const safeNextPath = getSafeNextPath(params.get('next'), defaultNextPath)
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

    if (hasAuthSession()) {
      void api.getMe().then((result) => {
        window.location.href = getPostLoginPath(result.data, safeNextPath)
      })
    }
  }, [defaultNextPath])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await api.login(email, password)

      if (result.data?.token) {
        window.location.href = getPostLoginPath(result.data.user, nextPath)
        return
      }

      if (result.data?.mfaRequired && result.data.mfaToken) {
        setMfaToken(result.data.mfaToken)
        setMfaCode('')
        return
      }

      setError(result.error || 'Не удалось войти')
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await api.verifyLoginMfa(mfaToken, mfaCode)

      if (result.data?.token) {
        window.location.href = getPostLoginPath(result.data.user, nextPath)
        return
      }

      setError(result.error || 'Не удалось подтвердить MFA')
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const formClassName = isLanding ? 'mt-8 space-y-6' : 'mt-6 space-y-4'
  const inputClassName = isLanding
    ? 'h-[52px] w-full rounded-2xl border border-line bg-white px-4 text-[15px] text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15'
    : 'w-full rounded-lg border px-3 py-2'
  const labelClassName = isLanding
    ? 'mb-3 block text-sm font-semibold text-slate-950'
    : 'mb-1 block text-sm font-medium text-gray-700'
  const buttonClassName = isLanding
    ? 'group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-base font-semibold text-foreground-inverse shadow-[var(--shadow-orange)] hover:bg-primary-hover disabled:opacity-60'
    : 'w-full rounded-lg bg-primary px-4 py-2 text-foreground-inverse hover:bg-primary-hover disabled:opacity-50'

  return (
    <form onSubmit={mfaToken ? handleMfaSubmit : handleSubmit} className={formClassName}>
      {mfaToken ? (
        <div>
          <label className={labelClassName}>Код MFA</label>
          <input
            name="mfa"
            data-testid="login-mfa-code"
            inputMode="numeric"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            className={inputClassName}
            autoComplete="one-time-code"
            required
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelClassName}>Email</label>
            <input
              name="email"
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
              placeholder="name@company.ru"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <label className="block text-sm font-semibold text-slate-950">Пароль</label>
              {isLanding ? (
                <a className="text-sm font-medium text-primary hover:text-primary-hover" href={`mailto:${ACCESS_EMAIL}?subject=Восстановление доступа AuditAvto`}>
                  Забыли пароль?
                </a>
              ) : null}
            </div>
            <input
              name="password"
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
              placeholder="Введите пароль"
              autoComplete="current-password"
              required
            />
          </div>
        </>
      )}

      {error ? (
        <div className={isLanding ? 'rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700' : 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700'}>
          {error}
        </div>
      ) : null}

      {isLanding && !mfaToken ? (
        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex items-center gap-3 text-slate-600">
            <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-slate-300 text-primary" />
            Запомнить меня
          </label>
        </div>
      ) : null}

      <button type="submit" disabled={loading} className={buttonClassName}>
        {loading ? 'Вход...' : mfaToken ? 'Подтвердить' : 'Войти'}
        {isLanding && !loading ? <span className="text-2xl leading-none transition-transform group-hover:translate-x-1">→</span> : null}
      </button>

      {showAccessAction ? (
        isLanding ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-[0.18em] text-foreground-muted">
              <span className="h-px flex-1 bg-slate-200" />
              или
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <a
              href={`mailto:${ACCESS_EMAIL}?subject=Получить доступ к AuditAvto`}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-line bg-white px-5 text-base font-semibold text-primary hover:border-primary/40 hover:bg-primary/5"
            >
              Получить доступ
            </a>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-600">
            Нет доступа?{' '}
            <a className="font-semibold text-primary hover:text-primary-hover" href={`mailto:${ACCESS_EMAIL}?subject=Получить доступ к AuditAvto`}>
              Напишите нам
            </a>
          </p>
        )
      ) : null}
    </form>
  )
}
