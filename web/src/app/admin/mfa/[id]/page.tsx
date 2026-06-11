'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { useToast } from '@/app/contexts/ToastContext'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import ManagerAccessDenied from '@/components/ManagerAccessDenied'
import api from '@/lib/api/client'
import { useCompanyOwnerAccess } from '@/lib/useCompanyOwnerAccess'
import type { UserRecord } from '@/lib/types'
import { Badge, EmptyState, NoticeCard, Skeleton, StatusButton, Tooltip } from '@/components/ui'

function getRoleLabel(role: string) {
  if (role === 'manager') return 'Менеджер'
  if (role === 'inspector') return 'Инспектор'
  if (role === 'owner') return 'Владелец'
  if (role === 'admin') return 'Администратор'
  return role
}

export default function AdminMfaUserPage() {
  const { id } = useParams<{ id: string }>()
  const ownerAccess = useCompanyOwnerAccess()
  const [user, setUser] = useState<UserRecord | null>(null)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  // Unified toast system will handle all feedback; remove inline copy indicators
  const [secretVisible, setSecretVisible] = useState(false)
  const { showToast } = useToast()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [setupLoading, setSetupLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!ownerAccess.allowed) return
    void loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ownerAccess.allowed])

  const loadUser = async () => {
    try {
      setLoading(true)
      setError('')

      const result = await api.getUser(id)
      if (result.error) {
        setError(result.error)
        return
      }

      setUser(result.data || null)
    } catch {
      setError('Не удалось загрузить пользователя')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    setSetupLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await api.setupUserMfa(id)
      if (result.error || !result.data) {
        setError(result.error || 'Не удалось подготовить MFA')
        return
      }

      setOtpauthUrl(result.data.otpauth_url)
      setSecret(result.data.secret)
      setSuccess('Секрет MFA подготовлен. Отсканируйте QR-код и подтвердите одноразовый код.')
    } catch {
      setError('Не удалось подготовить MFA')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!code.trim()) return

    setVerifyLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await api.enableUserMfa(id, code.trim())
      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess('MFA успешно активирован')
      await loadUser()
    } catch {
      setError('Не удалось подтвердить MFA')
    } finally {
      setVerifyLoading(false)
    }
  }

  if (ownerAccess.loading) {
    return (
      <div className="mx-auto grid min-h-screen max-w-3xl content-center gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (!ownerAccess.allowed) {
    return (
      <Layout currentPage="users">
        <div className="max-w-3xl p-6">
          <ManagerAccessDenied description="Настройка MFA доступна только владельцу компании." />
        </div>
      </Layout>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto grid min-h-screen max-w-3xl content-center gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <Layout currentPage="users">
      <div className="max-w-3xl p-6">
        <Link href="/admin/mfa" className="text-sm text-blue-600 hover:underline">
          ← Назад к списку MFA
        </Link>

        <div className="mb-6 mt-3">
          <h1 className="text-2xl font-bold text-slate-900">Настройка MFA</h1>
          <p className="mt-1 text-sm text-slate-500">Подключение двухфакторной аутентификации для выбранного пользователя.</p>
        </div>

        {error ? (
          <div className="mb-4"><NoticeCard title="Настройка MFA не выполнена" tone="danger" compact>{error}</NoticeCard></div>
        ) : null}

        {success ? (
          <div className="mb-4"><NoticeCard title="MFA обновлена" tone="success" compact>{success}</NoticeCard></div>
        ) : null}

        {user ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Пользователь</h2>
              <div className="grid gap-2 text-sm text-slate-600">
                <p>
                  <span className="text-slate-500">Имя:</span> <span className="font-medium text-slate-900">{user.name}</span>
                </p>
                <p>
                  <span className="text-slate-500">Email:</span> <span className="font-medium text-slate-900">{user.email}</span>
                </p>
                <p>
                  <span className="text-slate-500">Роль:</span> <span className="font-medium text-slate-900">{getRoleLabel(user.role)}</span>
                </p>
                <p>
                  <span className="text-slate-500">MFA:</span>{' '}
                  <Badge tone={user.mfa_enabled ? 'success' : 'warning'}>{user.mfa_enabled ? 'Включено' : 'Ещё не активировано'}</Badge>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Шаг 1. Выпустить секрет</h2>
                  <p className="mt-1 text-sm text-slate-500">Сформируйте QR-код и секрет для приложения-аутентификатора.</p>
                </div>
                <StatusButton
                  onClick={handleSetup}
                  status={setupLoading ? 'loading' : 'idle'}
                  loadingLabel="Подготавливаем MFA…"
                >
                  Подготовить MFA
                </StatusButton>
              </div>

          {otpauthUrl ? (
                <div className="flex flex-col items-start gap-6 md:flex-row">
                  <img
                    alt="QR-код MFA"
                    src={`https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(otpauthUrl)}`}
                    className="h-56 w-56 rounded-xl border border-slate-200 bg-white"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-slate-100 px-3 py-1 text-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(otpauthUrl ?? '')
                      showToast('URL MFA скопирован')
                    }}
                    >
                      Копировать URL MFA
                    </button>
                    {/* Unified toast handles feedback; no inline copy indicator */}
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 font-medium text-slate-900">
                      <Tooltip content="Резервный способ подключения, если QR-код невозможно отсканировать">Ручной код</Tooltip>
                    </h3>
                    <p className="mb-3 text-sm text-slate-500">
                      Если QR-код не подходит, можно ввести этот секрет вручную в приложении-аутентификаторе.
                    </p>
                    <code className="block break-all rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">{secretVisible ? secret : (secret ? '******' : '')}</code>
                    {secret ? (
                      <button
                        type="button"
                        className="mt-1 inline-block rounded-md bg-slate-100 px-3 py-1 text-sm"
                        onClick={() => setSecretVisible((s) => !s)}
                      >
                        {secretVisible ? 'Спрятать секрет' : 'Показать секрет'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="mt-1 inline-block rounded-md bg-slate-100 px-3 py-1 text-sm"
                    onClick={() => {
                      if (secret) {
                        navigator.clipboard.writeText(secret)
                        showToast('Секрет MFA скопирован')
                      }
                    }}
                    >
                      Копировать секрет
                    </button>
                    { /* No inline copy feedback; toast used */ }
                  </div>
                </div>
              ) : null}

          
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Шаг 2. Подтверждение</h2>
              <p className="mb-4 text-sm text-slate-500">Введите 6-значный код из приложения, чтобы завершить активацию MFA.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-значный код"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 sm:w-56"
                />
                <StatusButton
                  onClick={handleVerify}
                  disabled={verifyLoading || !code.trim()}
                  status={verifyLoading ? 'loading' : 'idle'}
                  loadingLabel="Проверяем код…"
                >
                  Подтвердить
                </StatusButton>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="Пользователь не найден" description="Вернитесь к списку MFA и выберите существующего пользователя." />
        )}
      </div>
    </Layout>
  )
}
