const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_SESSION_KEY = 'auth_session'
const LOGIN_PATH = '/login'

type SessionEndReason = 'expired' | 'inactive'

export function isManagerRole(role?: string | null): boolean {
  return role === 'manager' || role === 'owner' || role === 'admin'
}

export function isCompanyOwnerRole(role?: string | null): boolean {
  return role === 'owner' || role === 'admin'
}

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin'
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const legacyToken = localStorage.getItem(AUTH_TOKEN_KEY)
  if (legacyToken) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.setItem(AUTH_SESSION_KEY, '1')
  }

  return legacyToken
}

export function hasAuthSession(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return Boolean(localStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_TOKEN_KEY))
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') {
    return
  }

  void token
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.setItem(AUTH_SESSION_KEY, '1')
}

export function clearAuthToken() {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_SESSION_KEY)
}

function getSafeReturnPath() {
  if (typeof window === 'undefined') {
    return '/'
  }

  const path = `${window.location.pathname}${window.location.search}`
  if (!path || path === LOGIN_PATH || path.startsWith('//')) {
    return '/'
  }

  return path
}

export function redirectToLogin(reason: SessionEndReason = 'expired') {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname === LOGIN_PATH) {
    return
  }

  const params = new URLSearchParams({
    reason,
    next: getSafeReturnPath(),
  })
  window.location.assign(`${LOGIN_PATH}?${params.toString()}`)
}

export function endAuthSession(reason: SessionEndReason = 'expired') {
  clearAuthToken()

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audit:auth-session-ended', { detail: { reason } }))
  }

  redirectToLogin(reason)
}

export function isAuthRequiredError(error?: string | null): boolean {
  return error === 'AUTH_REQUIRED' || error === 'SESSION_INACTIVE'
}

export function requireAuthToken(reason: SessionEndReason = 'expired'): string | null {
  if (!hasAuthSession() && typeof window !== 'undefined') {
    redirectToLogin(reason)
    return null
  }

  return getAuthToken() || 'cookie-session'
}
