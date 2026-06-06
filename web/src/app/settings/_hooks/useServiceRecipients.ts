'use client'

import { useCallback, useState } from 'react'
import api from '@/lib/api/client'
import type { ServiceNotificationRecipient } from '@/lib/types'
import type { StatusMessage } from '../_lib/settings'

type SetStatus = (status: StatusMessage | null) => void

export function useServiceRecipients() {
  const [recipients, setRecipients] = useState<ServiceNotificationRecipient[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (setStatus: SetStatus) => {
    setLoading(true)
    const result = await api.getServiceNotificationRecipients()
    if (result.error) {
      setStatus({ tone: 'danger', text: `Не удалось загрузить получателей уведомлений: ${result.error}` })
    } else {
      setRecipients(result.data?.recipients || [])
    }
    setLoading(false)
  }, [])

  const toggle = useCallback(
    async (id: string, enabled: boolean, setStatus: SetStatus, block: { tone: 'info' | 'danger'; text: string } | null | undefined) => {
      if (block) {
        setStatus(block)
        return
      }

      const nextRecipients = recipients.map((recipient) =>
        recipient.id === id ? { ...recipient, serviceNotificationsEnabled: enabled } : recipient,
      )
      setRecipients(nextRecipients)
      setSaving(true)
      setStatus(null)

      const result = await api.updateServiceNotificationRecipients(
        nextRecipients.map((recipient) => ({
          id: recipient.id,
          serviceNotificationsEnabled: recipient.serviceNotificationsEnabled,
        })),
      )

      if (result.error) {
        setStatus({ tone: 'danger', text: `Не удалось сохранить получателей уведомлений: ${result.error}` })
        await load(setStatus)
      } else {
        setRecipients(result.data?.recipients || [])
        setStatus({ tone: 'success', text: 'Получатели сервисных уведомлений обновлены.' })
      }

      setSaving(false)
    },
    [recipients, load],
  )

  return { state: { recipients, loading, saving }, actions: { load, toggle } }
}
