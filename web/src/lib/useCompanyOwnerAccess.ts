'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api/client'
import { isCompanyOwnerRole, requireAuthToken } from '@/lib/auth'
import type { AuthUser } from '@/lib/types'

type CompanyOwnerAccessState = {
  loading: boolean
  allowed: boolean
  user: AuthUser | null
}

export function useCompanyOwnerAccess(): CompanyOwnerAccessState {
  const [state, setState] = useState<CompanyOwnerAccessState>({
    loading: true,
    allowed: false,
    user: null,
  })

  useEffect(() => {
    if (!requireAuthToken()) return

    let cancelled = false

    const loadCurrentUser = async () => {
      const result = await api.getMe()

      if (cancelled) return

      const user = result.data || null
      setState({
        loading: false,
        allowed: isCompanyOwnerRole(user?.role),
        user,
      })
    }

    loadCurrentUser().catch(() => {
      if (!cancelled) {
        setState({
          loading: false,
          allowed: false,
          user: null,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
