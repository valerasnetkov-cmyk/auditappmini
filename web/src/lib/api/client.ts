import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/auth'
import type {
  AnalyticsOverview,
  ApiResponse,
  AuthUser,
  ChecklistItemInput,
  CreateInspectionPayload,
  CreateRegionPayload,
  CreateUserPayload,
  CreateVehiclePayload,
  DashboardStats,
  DefectRecord,
  ExportRow,
  ExportType,
  InspectionCreateResponse,
  InspectionDetail,
  InspectionRecord,
  LoginResponse,
  MFAVerifyResponse,
  MFASetupResponse,
  NotificationItem,
  RegionRecord,
  SettingsResponse,
  UpdateDefectPayload,
  UpdateInspectionPayload,
  UpdateUserPayload,
  UpdateVehiclePayload,
  UploadPhotoResponse,
  UserRecord,
  VehicleDetail,
  VehicleDefectHistoryItem,
  VehicleHistoryEntry,
  VehicleListItem,
  VehicleRecord,
} from '@/lib/types'

type RawPhotoRecord = {
  id?: string
  url?: string | null
}

type RawDefectRecord = Omit<DefectRecord, 'photos'> & {
  photos?: RawPhotoRecord[] | string | null
}

type RawInspectionDetail = Omit<InspectionDetail, 'defects'> & {
  defects?: RawDefectRecord[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '')

export function buildApiUrl(path: string) {
  if (!path) return API_BASE_URL
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function normalizePhotos(source: RawDefectRecord['photos']) {
  if (!source) return []

  if (Array.isArray(source)) {
    return source
      .filter((item): item is RawPhotoRecord & { url: string } => typeof item?.url === 'string' && item.url.length > 0)
      .map((item) => ({ id: item.id, url: item.url }))
  }

  return source
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => ({ url }))
}

function normalizeInspectionDetail(raw: RawInspectionDetail): InspectionDetail {
  return {
    ...raw,
    defects: (raw.defects || []).map((defect) => ({
      ...defect,
      photos: normalizePhotos(defect.photos),
    })),
  }
}

function isUploadPhotoResponse(data: unknown): data is UploadPhotoResponse {
  return data !== null && typeof data === 'object'
}

class ApiClient {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
    if (token) {
      setAuthToken(token)
    } else {
      clearAuthToken()
    }
  }

  getToken(): string | null {
    if (this.token) return this.token
    return getAuthToken()
  }

  protected async request<T>(endpoint: string, options: RequestInit = {}, retry = false): Promise<ApiResponse<T>> {
    const token = this.getToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 401) {
          this.setToken(null)
          if (token) {
            return { error: 'AUTH_REQUIRED' }
          }
        }

        return { error: errorData.error || `HTTP ${response.status}` }
      }

      if (response.status === 204) {
        return {}
      }

      const data = await response.json()
      const isPaginated = data.data && Array.isArray(data.data) && data.pagination
      const responseData: T = isPaginated ? data.data : data
      return { data: responseData, pagination: data.pagination }
    } catch {
      if (!retry) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 400))
          return this.request<T>(endpoint, options, true)
        } catch {
          // fall through
        }
      }

      return { error: 'Ошибка соединения с сервером' }
    }
  }

  async login(email: string, password: string) {
    const result = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (result.data?.token) {
      this.setToken(result.data.token)
    }

    return result
  }

  async logout() {
    this.setToken(null)
  }

  async getAuth() {
    return this.request<AuthUser>('/auth/me')
  }

  async getMe() {
    return this.request<AuthUser>('/auth/me')
  }

  async getVehicles(params?: { page?: number; limit?: number; search?: string; status?: string }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.search) query.set('search', params.search)
    if (params?.status) query.set('status', params.status)

    return this.request<VehicleRecord[]>(`/vehicles?${query}`)
  }

  async getVehiclesList() {
    return this.request<VehicleListItem[]>('/vehicles/list')
  }

  async getVehicle(id: string) {
    return this.request<VehicleDetail>(`/vehicles/${id}`)
  }

  async createVehicle(data: CreateVehiclePayload) {
    return this.request<VehicleDetail>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateVehicle(id: string, data: UpdateVehiclePayload) {
    return this.request<VehicleDetail>(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getVehicleHistory(id: string) {
    return this.request<VehicleHistoryEntry[]>(`/vehicles/${id}/history`)
  }

  async deleteVehicle(id: string) {
    return this.request<void>(`/vehicles/${id}`, {
      method: 'DELETE',
    })
  }

  async getRegions() {
    return this.request<RegionRecord[]>('/regions')
  }

  async createRegion(data: CreateRegionPayload) {
    return this.request<RegionRecord>('/regions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteRegion(id: string) {
    return this.request<void>(`/regions/${id}`, {
      method: 'DELETE',
    })
  }

  async getInspections(params?: { page?: number; limit?: number; type?: string; vehicle?: string; from?: string; to?: string }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.type) query.set('type', params.type)
    if (params?.vehicle) query.set('vehicle', params.vehicle)
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)

    return this.request<InspectionRecord[]>(`/inspections?${query}`)
  }

  async getVehicleInspections(vehicleId: string, params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))

    return this.request<InspectionRecord[]>(`/vehicles/${vehicleId}/inspections?${query}`)
  }

  async getInspection(id: string) {
    const result = await this.request<RawInspectionDetail>(`/inspections/${id}`)
    return {
      ...result,
      data: result.data ? normalizeInspectionDetail(result.data) : undefined,
    }
  }

  async getInspectionDetail(id: string) {
    const result = await this.request<RawInspectionDetail>(`/inspections/${id}`)
    return {
      ...result,
      data: result.data ? normalizeInspectionDetail(result.data) : undefined,
    }
  }

  async uploadPhoto(defectId: string, file: File, geo?: string) {
    const token = this.getToken()
    const formData = new FormData()
    formData.append('photo', file)
    if (geo) formData.append('geo', geo)

    const response = await fetch(`${API_URL}/defects/${defectId}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (!response.ok) {
      return { error: 'Ошибка загрузки фото' }
    }

    const data = await response.json()
    return { data: isUploadPhotoResponse(data) ? data : {} }
  }

  async deletePhoto(id: string) {
    return this.request<void>(`/photos/${id}`, {
      method: 'DELETE',
    })
  }

  async updateDefect(id: string, data: UpdateDefectPayload) {
    return this.request<DefectRecord>(`/defects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteDefect(id: string) {
    return this.request<void>(`/defects/${id}`, {
      method: 'DELETE',
    })
  }

  async createInspection(data: CreateInspectionPayload) {
    return this.request<InspectionCreateResponse>('/inspections', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateInspection(id: string, data: UpdateInspectionPayload) {
    return this.request<InspectionDetail>(`/inspections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteInspection(id: string) {
    return this.request<void>(`/inspections/${id}`, {
      method: 'DELETE',
    })
  }

  async getDefects(params?: { page?: number; limit?: number; search?: string; vehicle?: string; from?: string; to?: string }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.search) query.set('search', params.search)
    if (params?.vehicle) query.set('vehicle', params.vehicle)
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)

    return this.request<DefectRecord[]>(`/defects?${query}`)
  }

  async getDefect(id: string) {
    return this.request<DefectRecord>(`/defects/${id}`)
  }

  async getDefectHistory(defectId: string) {
    return this.request<any[]>(`/defects/${defectId}/history`)
  }

  async getVehicleDefects(id: string, params?: { limit?: number }) {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))

    return this.request<VehicleDefectHistoryItem[]>(`/vehicles/${id}/defects?${query}`)
  }

  async getDashboardStats() {
    return this.request<DashboardStats>('/dashboard/stats')
  }

  async getNotifications() {
    return this.request<NotificationItem[]>('/notifications')
  }

  async getSettings() {
    return this.request<SettingsResponse>('/settings')
  }

  async updateSettings(data: SettingsResponse) {
    return this.request<SettingsResponse>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getAnalyticsOverview(params?: string) {
    return this.request<AnalyticsOverview>(`/analytics/overview${params || ''}`)
  }

  async exportData(type: ExportType) {
    return this.request<ExportRow[]>(`/analytics/export/excel?type=${type}`)
  }

  async seedData(params?: { vehicles?: number; inspections?: number }) {
    return this.request<Record<string, unknown>>('/seed', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    })
  }

  async getUsers() {
    return this.request<UserRecord[]>('/users')
  }

  async getUser(id: string) {
    return this.request<UserRecord>(`/users/${id}`)
  }

  async createUser(data: CreateUserPayload) {
    return this.request<UserRecord>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: string, data: UpdateUserPayload) {
    return this.request<UserRecord>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string) {
    return this.request<void>(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  async setupUserMfa(id: string) {
    return this.request<MFASetupResponse>(`/users/${id}/mfa/setup`, {
      method: 'POST',
    })
  }

  async verifyUserMfa(id: string, token: string) {
    return this.request<MFAVerifyResponse>(`/users/${id}/mfa/verify`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  }

  async closeDefect(defectId: string) {
    return this.request<any>(`/defects/${defectId}/close`, {
      method: 'POST',
    })
  }

  async reopenDefect(defectId: string) {
    return this.request<any>(`/defects/${defectId}/reopen`, {
      method: 'POST',
    })
  }
}

export const api = new ApiClient()
export default api
