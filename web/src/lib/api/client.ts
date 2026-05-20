import { clearAuthToken, endAuthSession, getAuthToken, setAuthToken } from '@/lib/auth'
import type {
  AnalyticsOverview,
  ApiResponse,
  AuthUser,
  CompanyUsageResponse,
  CompanyRecord,
  CreateCompanyPayload,
  CreateInspectionPayload,
  CreateRegionPayload,
  CreateUserPayload,
  CreateVehiclePayload,
  DashboardStats,
  DefectHistoryEntry,
  DefectRecord,
  DirectusIntegrationStatus,
  ExportRow,
  ExportType,
  InspectionCreateResponse,
  InspectionDetail,
  InspectionRecord,
  LoginResponse,
  MFAVerifyResponse,
  MFASetupResponse,
  NotificationItem,
  PhotoRequirementsResponse,
  RegionRecord,
  SaasAdminStats,
  SettingsResponse,
  UpdateCompanyPayload,
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
  original_url?: string | null
  webp_url?: string | null
  thumb_url?: string | null
  original_mime?: string | null
  original_name?: string | null
  width?: number | null
  height?: number | null
  size_original?: number | null
  size_webp?: number | null
  size_thumb?: number | null
  hash?: string | null
  photo_type?: string | null
  is_required?: number | boolean
  geo?: string | null
}

type RawDefectRecord = Omit<DefectRecord, 'photos'> & {
  photos?: RawPhotoRecord[] | string | null
}

type RawInspectionDetail = Omit<InspectionDetail, 'defects' | 'photos'> & {
  defects?: RawDefectRecord[]
  photos?: RawPhotoRecord[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '')
const INACTIVE_USER_ERROR = 'User is inactive'

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
      .map((item) => ({
        id: item.id,
        url: item.url,
        original_url: item.original_url,
        webp_url: item.webp_url,
        thumb_url: item.thumb_url,
        original_mime: item.original_mime,
        original_name: item.original_name,
        width: item.width,
        height: item.height,
        size_original: item.size_original,
        size_webp: item.size_webp,
        size_thumb: item.size_thumb,
        hash: item.hash,
        photo_type: item.photo_type,
        is_required: item.is_required,
        geo: item.geo,
      }))
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
    photos: normalizePhotos(raw.photos),
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

  private shouldHandleSessionFailure(endpoint: string, token: string | null) {
    if (!token) return false
    return !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/owner-setup')
  }

  private handleSessionFailure(status: number, endpoint: string, token: string | null, error?: string) {
    if (!this.shouldHandleSessionFailure(endpoint, token)) {
      return null
    }

    if (status === 401) {
      this.token = null
      endAuthSession('expired')
      return 'AUTH_REQUIRED'
    }

    if (status === 403 && error === INACTIVE_USER_ERROR) {
      this.token = null
      endAuthSession('inactive')
      return 'SESSION_INACTIVE'
    }

    return null
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
        const sessionError = this.handleSessionFailure(response.status, endpoint, token, errorData.error)
        if (sessionError) {
          return { error: sessionError }
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

  async completeOwnerSetup(token: string, password: string) {
    const result = await this.request<LoginResponse>('/auth/owner-setup', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
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

  async checkHealth() {
    return this.request<{ status: string; version: string }>('/health')
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

  async importVehicles(vehicles: { number: string; name: string; region: string }[]) {
    return this.request<{ imported: number; errors: { row: number; error: string }[]; regionsAdded?: number }>('/vehicles/import', {
      method: 'POST',
      body: JSON.stringify({ vehicles }),
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

  async getRegions(params?: { includeEmpty?: boolean }) {
    const query = params?.includeEmpty ? '?includeEmpty=1' : ''
    return this.request<RegionRecord[]>(`/regions${query}`)
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

  async updateRegion(id: string, name: string, currentName?: string) {
    return this.request<RegionRecord>(`/regions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, currentName }),
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
      const errorData = await response.json().catch(() => ({}))
      const sessionError = this.handleSessionFailure(response.status, `/defects/${defectId}/photos`, token, errorData.error)
      if (sessionError) return { error: sessionError }

      return { error: errorData.error || 'Ошибка загрузки фото' }
    }

    const data = await response.json()
    return { data: isUploadPhotoResponse(data) ? data : {} }
  }

  async uploadInspectionPhoto(inspectionId: string, photoType: string, file: File, geo?: string) {
    const token = this.getToken()
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('photo_type', photoType)
    if (geo) formData.append('geo', geo)

    const response = await fetch(`${API_URL}/inspections/${inspectionId}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const sessionError = this.handleSessionFailure(response.status, `/inspections/${inspectionId}/photos`, token, errorData.error)
      if (sessionError) return { error: sessionError }

      return { error: errorData.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data: isUploadPhotoResponse(data) ? data : {} }
  }

  async deletePhoto(id: string) {
    return this.request<void>(`/photos/${id}`, {
      method: 'DELETE',
    })
  }

  async completeInspection(id: string) {
    return this.request<InspectionDetail>(`/inspections/${id}/complete`, {
      method: 'POST',
    })
  }

  async getPhotoRequirements(type: string) {
    return this.request<PhotoRequirementsResponse>(`/photo-requirements/${type}`)
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
    return this.request<DefectHistoryEntry[]>(`/defects/${defectId}/history`)
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

  async getCompanyUsage() {
    return this.request<CompanyUsageResponse>('/company/usage')
  }

  async updateSettings(data: SettingsResponse) {
    return this.request<SettingsResponse>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getDirectusStatus() {
    return this.request<DirectusIntegrationStatus>('/integrations/directus/status')
  }

  async getAnalyticsOverview(params?: string) {
    return this.request<AnalyticsOverview>(`/analytics/overview${params || ''}`)
  }

  async getSaasAdminStats() {
    return this.request<SaasAdminStats>('/admin/saas/stats')
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
    return this.request<DefectRecord>(`/defects/${defectId}/close`, {
      method: 'POST',
    })
  }

  async reopenDefect(defectId: string) {
    return this.request<DefectRecord>(`/defects/${defectId}/reopen`, {
      method: 'POST',
    })
  }

  async getCompanies() {
    return this.request<CompanyRecord[]>('/companies')
  }

  async getCompany(id: string) {
    return this.request<CompanyRecord>(`/companies/${id}`)
  }

  async createCompany(data: CreateCompanyPayload) {
    return this.request<CompanyRecord>('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCompany(id: string, data: UpdateCompanyPayload) {
    return this.request<CompanyRecord>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCompany(id: string) {
    return this.request<void>(`/companies/${id}`, {
      method: 'DELETE',
    })
  }
}

export const api = new ApiClient()
export default api
