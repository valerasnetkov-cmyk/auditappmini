'use client'

import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import api from '@/lib/api/client'
import type { CompanyUsageResponse } from '@/lib/types'
import { formatCompanyUsageError, type StatusMessage } from '../_lib/settings'

export function useCompanyUsagePanel() {
  const [usage, setUsage] = useState<CompanyUsageResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (setStatus: Dispatch<SetStateAction<StatusMessage | null>>) => {
    setLoading(true)
    const result = await api.getCompanyUsage()
    if (result.error) {
      setUsage(null)
      setStatus({ tone: 'danger', text: formatCompanyUsageError(result.error) })
    } else {
      setUsage(result.data || null)
      setStatus((current) => clearIfCompanyUsageError(current))
    }
    setLoading(false)
  }, [])

  return { usage, loading, load }
}

function clearIfCompanyUsageError(status: StatusMessage | null): StatusMessage | null {
  if (!status) return status
  if (status.text === 'Backend на http://localhost:3001 запущен старой версией и не знает endpoint /api/company/usage. Перезапустите backend из корня проекта или командой npm --prefix backend run dev.') {
    return null
  }
  if (status.text.startsWith('Не удалось загрузить тариф компании:')) return null
  return status
}
