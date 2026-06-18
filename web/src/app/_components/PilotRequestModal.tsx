'use client'

import Link from 'next/link'
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import api from '@/lib/api/client'

type PilotRequestContextValue = {
  openPilotRequest: (source?: string) => void
}

const PilotRequestContext = createContext<PilotRequestContextValue | null>(null)

const EMPTY_FORM = {
  companyName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  vehicleCount: '',
  region: '',
  comment: '',
  website: '',
  consentGiven: false,
}

function readTrackingParams() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent: params.get('utm_content') || undefined,
    utmTerm: params.get('utm_term') || undefined,
  }
}

export function PilotRequestProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('landing')
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const openPilotRequest = useCallback((nextSource = 'landing') => {
    setSource(nextSource)
    setError('')
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    if (submitting) return
    setOpen(false)
    setSubmitted(false)
    setError('')
  }, [submitting])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('pilot') !== '1') return
    const timer = window.setTimeout(() => openPilotRequest(params.get('source') || 'direct'), 0)
    return () => window.clearTimeout(timer)
  }, [openPilotRequest])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await api.createPilotRequest({
      ...form,
      vehicleCount: Number(form.vehicleCount),
      source,
      ...readTrackingParams(),
    })
    setSubmitting(false)
    if (!result.data) {
      setError(result.error || 'Не удалось отправить заявку. Попробуйте ещё раз.')
      return
    }
    setSubmitted(true)
    setForm(EMPTY_FORM)
  }

  return (
    <PilotRequestContext.Provider value={{ openPilotRequest }}>
      {children}
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-6 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pilot-request-title"
            className="relative w-full max-w-3xl rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-7"
          >
            <button
              type="button"
              aria-label="Закрыть форму"
              className="absolute right-4 top-4 rounded-lg p-2 text-foreground-muted hover:bg-surface-hover hover:text-foreground"
              onClick={close}
            >
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>

            {submitted ? (
              <div className="py-10 text-center">
                <CheckCircleIcon className="mx-auto h-14 w-14 text-status-success" aria-hidden="true" />
                <h2 id="pilot-request-title" className="mt-5 text-2xl font-semibold text-foreground">
                  Заявка принята
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-foreground-secondary">
                  Мы свяжемся с вами по указанным контактам.
                </p>
                <button type="button" className="btn btn-primary mt-7" onClick={close}>
                  Готово
                </button>
              </div>
            ) : (
              <>
                <div className="pr-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Пилот AuditAvto</p>
                  <h2 id="pilot-request-title" className="mt-2 text-2xl font-semibold text-foreground">
                    Запустить пилот на вашем автопарке
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-foreground-secondary">
                    Оставьте рабочие контакты. Мы уточним сценарий внедрения и состав пилотной группы техники.
                  </p>
                </div>

                <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
                  <label className="sm:col-span-2">
                    <span className="label">Компания *</span>
                    <input
                      className="input"
                      value={form.companyName}
                      onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    <span className="label">Контактное лицо *</span>
                    <input
                      className="input"
                      value={form.contactName}
                      onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label>
                    <span className="label">Рабочий email *</span>
                    <input
                      className="input"
                      type="email"
                      value={form.contactEmail}
                      onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                      maxLength={254}
                      required
                    />
                  </label>
                  <label>
                    <span className="label">Телефон *</span>
                    <input
                      className="input"
                      type="tel"
                      value={form.contactPhone}
                      onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                      maxLength={32}
                      placeholder="+7 900 000-00-00"
                      required
                    />
                  </label>
                  <label>
                    <span className="label">Количество техники *</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="100000"
                      value={form.vehicleCount}
                      onChange={(event) => setForm((current) => ({ ...current, vehicleCount: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="label">Регион</span>
                    <input
                      className="input"
                      value={form.region}
                      onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
                      maxLength={160}
                      placeholder="Например, Сахалинская область"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="label">Комментарий</span>
                    <textarea
                      className="input min-h-24 resize-y"
                      value={form.comment}
                      onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
                      maxLength={2000}
                      placeholder="Какие задачи хотите проверить на пилоте?"
                    />
                  </label>

                  <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                    Веб-сайт
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                    />
                  </label>

                  <label className="flex items-start gap-3 text-sm leading-5 text-foreground-secondary sm:col-span-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-line"
                      checked={form.consentGiven}
                      onChange={(event) => setForm((current) => ({ ...current, consentGiven: event.target.checked }))}
                      required
                    />
                    <span>
                      Я согласен на обработку контактных данных для ответа на заявку в соответствии с{' '}
                      <Link href="/privacy" className="font-medium text-primary hover:text-primary-hover" target="_blank">
                        политикой обработки персональных данных
                      </Link>{' '}
                      и{' '}
                      <Link href="/personal-data-consent" className="font-medium text-primary hover:text-primary-hover" target="_blank">
                        согласием на обработку персональных данных
                      </Link>.
                    </span>
                  </label>

                  {error ? (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">{error}</div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
                    <button type="button" className="btn btn-secondary" onClick={close} disabled={submitting}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Отправляем…' : 'Отправить заявку'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </PilotRequestContext.Provider>
  )
}

export function PilotRequestButton({
  children,
  className,
  source,
}: {
  children: ReactNode
  className?: string
  source: string
}) {
  const context = useContext(PilotRequestContext)
  if (!context) throw new Error('PilotRequestButton must be used inside PilotRequestProvider')
  return (
    <button type="button" className={className} onClick={() => context.openPilotRequest(source)}>
      {children}
    </button>
  )
}
