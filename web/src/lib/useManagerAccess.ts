'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api/client'
import { isManagerRole, requireAuthToken } from '@/lib/auth'
import type { AuthUser } from '@/lib/types'

type ManagerAccessState = {
  loading: boolean
  allowed: boolean
  user: AuthUser | null
}

export function useManagerAccess(): ManagerAccessState {
  const [state, setState] = useState<ManagerAccessState>({
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
        allowed: isManagerRole(user?.role),
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
