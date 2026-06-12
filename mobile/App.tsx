import { useCallback, useEffect, useState } from 'react'
import { ThemeProvider } from './src/theme'
import { api, setAuthSessionHandler } from './src/api'
import type { Company, User } from './src/types'
import { LoadingScreen } from './src/screens/LoadingScreen'
import { LoginScreen } from './src/screens/LoginScreen'
import { NoCompanyScreen } from './src/screens/NoCompanyScreen'
import { CompanySelectScreen } from './src/screens/CompanySelectScreen'
import { InspectionFlowScreen } from './src/screens/InspectionFlowScreen'

function App() {
  return (
    <ThemeProvider>
      <Main />
    </ThemeProvider>
  )
}

function Main() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [sessionMessage, setSessionMessage] = useState('')

  const resetSessionState = useCallback(() => {
    setUser(null)
    setCompanies([])
    setSelectedCompany(null)
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const me = await api.getMe()
      setUser(me)
      const comps = await api.getCompanies()
      setCompanies(comps)
      if (comps.length === 1 && comps[0]) {
        setSelectedCompany(comps[0])
      }
      setSessionMessage('')
    } catch (error: unknown) {
      const err = error as { message?: string }
      console.log('Auth check failed:', err.message)
      resetSessionState()
      setSessionMessage(err.message ?? '')
    } finally {
      setLoading(false)
    }
  }, [resetSessionState])

  useEffect(() => {
    setAuthSessionHandler((error) => {
      setSessionMessage(error.message)
      resetSessionState()
      setLoading(false)
    })
    queueMicrotask(() => { void checkAuth() })
    return () => setAuthSessionHandler(null)
  }, [checkAuth, resetSessionState])

  if (loading) return <LoadingScreen />
  if (!user) return <LoginScreen onLogin={checkAuth} initialMessage={sessionMessage} />
  if (companies.length === 0) {
    return <NoCompanyScreen onSignedOut={() => { setSessionMessage(''); resetSessionState() }} />
  }
  if (companies.length > 1 && !selectedCompany) {
    return <CompanySelectScreen companies={companies} onSelect={setSelectedCompany} />
  }
  return <InspectionFlowScreen company={selectedCompany!} />
}

export default App
