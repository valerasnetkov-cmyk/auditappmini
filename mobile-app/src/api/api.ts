import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

async function readToken(): Promise<string | null> {
  try {
    const t = await SecureStore.getItemAsync('auth_token')
    if (t) return t
  } catch {}
  try {
    const t = await AsyncStorage.getItem('auth_token')
    return t
  } catch {
    return null
  }
}

async function storeToken(token: string) {
  try {
    await SecureStore.setItemAsync('auth_token', token)
  } catch {
    try { await AsyncStorage.setItem('auth_token', token) } catch {}
  }
}

async function removeToken() {
  try { await SecureStore.deleteItemAsync('auth_token') } catch {}
  try { await AsyncStorage.removeItem('auth_token') } catch {}
}

const BASE_DEFAULT = 'http://localhost:3001/api'
function getApiBase() {
  try {
    const g = global as any
    if (g && g.__DEV_API_BASE__) return g.__DEV_API_BASE__
  } catch {}
  return BASE_DEFAULT
}

type ApiResponse<T> = { data?: T; error?: string }

let logoutCallback: (() => void) | null = null;
export const setLogoutCallback = (cb: (() => void) | null) => { logoutCallback = cb; };

const api: any = {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = await readToken()
    const headers: any = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) , ...(options.headers || {}) }
    const resp = await fetch(`${getApiBase()}${endpoint}`, { ...options, headers })
    if (!resp.ok) {
      if (resp.status === 401) {
        try { await removeToken() } catch {}
        if (typeof logoutCallback === 'function') logoutCallback()
      }
      const err = await resp.json().catch(() => ({}))
      throw new Error(err?.error || `HTTP ${resp.status}`)
    }
    if (resp.status === 204) return { data: undefined as any }
    const data = await resp.json()
    return { data }
  },

  async login(email: string, password: string) {
    const res = await this.request<{ token: string; user: any }>( '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (res?.data?.token) await storeToken(res.data.token)
    return res
  },

  async register(data: { email: string; password: string; name: string; role?: string }) {
    return this.request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getDashboardStats() {
    return this.request<any>('/dashboard/stats')
  },

  async getNotifications() {
    return this.request<any[]>('/notifications')
  },

  async getAnalyticsOverview() {
    return this.request<any>('/analytics/overview')
  },

  async getDefects(params?: { page?: number; limit?: number; search?: string; vehicle?: string; from?: string; to?: string }) {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.search) q.set('search', params.search)
    if (params?.vehicle) q.set('vehicle', params.vehicle)
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    return this.request<any[]>(`/defects?${q}`)
  },

  async getDefect(id: string) {
    return this.request<any>(`/defects/${id}`)
  },

  async verifyMfa(userId: string, code: string) {
    return this.request<any>(`/users/${userId}/mfa/verify`, {
      method: 'POST',
      body: JSON.stringify({ token: code }),
    })
  },

  async getVehiclesList() {
    return this.request<any[]>('/vehicles/list')
  },

  async getUser(id: string) {
    return this.request<any>(`/users/${id}`)
  },

  async seedData(params?: { vehicles?: number; inspections?: number }) {
    return this.request<any>('/seed', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    })
  },

  async logout() {
    await removeToken()
  }
}

export default api
