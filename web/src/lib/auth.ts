const AUTH_TOKEN_KEY = 'auth_token'

export function isManagerRole(role?: string | null): boolean {
  return role === 'manager' || role === 'admin'
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function requireAuthToken(): string | null {
  const token = getAuthToken()

  if (!token && typeof window !== 'undefined') {
    window.location.href = '/login'
    return null
  }

  return token
}
