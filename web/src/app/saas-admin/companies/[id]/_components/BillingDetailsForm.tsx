'use client'

import { FormEvent, useEffect, useState } from 'react'
import api from '@/lib/api/client'
import type { CompanyBillingDetails } from '@/lib/types'

export default function BillingDetailsForm({ companyId }: { companyId: string }) {
  const [form, setForm] = useState<CompanyBillingDetails | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void api.getCompanyBillingDetails(companyId).then((result) => {
      if (cancelled) return
      if (result.data) setForm(result.data)
      else if (result.error && !result.error.toLowerCase().includes('access')) setError(result.error)
    })
    return () => { cancelled = true }
  }, [companyId])

  if (!form && !error) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await api.updateCompanyBillingDetails(companyId, form || {})
    if (result.data) {
      setForm(result.data)
      setMessage('Реквизиты сохранены')
      setError('')
    } else setError(result.error || 'Не удалось сохранить реквизиты')
  }

  return (
    <form onSubmit={submit} className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Платёжные реквизиты</h2>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
      {form ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['legal_name', 'Юридическое название'], ['short_name', 'Краткое название'],
              ['inn', 'ИНН'], ['kpp', 'КПП'], ['ogrn', 'ОГРН'],
              ['billing_email', 'Email для документов'], ['billing_contact_name', 'Контакт'],
              ['billing_contact_phone', 'Телефон'], ['legal_address', 'Юридический адрес'],
              ['postal_address', 'Почтовый адрес'], ['accounting_comment', 'Комментарий бухгалтерии'],
            ].map(([field, label]) => (
              <input
                key={field}
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder={label}
                value={String(form[field as keyof CompanyBillingDetails] || '')}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            ))}
          </div>
          <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Сохранить реквизиты</button>
        </>
      ) : null}
    </form>
  )
}
