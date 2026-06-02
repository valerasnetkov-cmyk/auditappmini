import { useState } from 'react'
import { api } from '../api'
import type { Company } from '../types'

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  const loadCompanies = async (): Promise<Company[]> => {
    const comps = await api.getCompanies()
    setCompanies(comps)
    if (comps.length === 1 && comps[0]) {
      setSelectedCompany(comps[0])
    }
    return comps
  }

  const reset = () => {
    setCompanies([])
    setSelectedCompany(null)
  }

  const logout = async () => {
    await api.logout()
    reset()
  }

  return {
    companies,
    selectedCompany,
    setSelectedCompany,
    loadCompanies,
    reset,
    logout,
  }
}
