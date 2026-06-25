import { clearAuthToken, endAuthSession, getAuthToken, hasAuthSession, setAuthToken } from '@/lib/auth'
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
  ExportRow,
  ExportType,
  InspectionCreateResponse,
  InspectionApproval,
  InspectionDetail,
  InspectionReadiness,
  InspectionReport,
  InspectionRecord,
  LoginResponse,
  MFAVerifyResponse,
  MFASetupResponse,
  NotificationItem,
  PhotoRequirementsResponse,
  PhotoRecord,
  RegionRecord,
  ResourceCompanyLimitsPayload,
  ResourcePaymentPayload,
  ResourcePlanPayload,
  ResourceAccess,
  ResourceSessionCookies,
  ResourceServiceUser,
  CompanyBillingDetails,
  ServiceProfile,
  NotificationTemplate,
  PilotRequestSubmission,
  PilotRequest,
  PilotRequestAssignee,
  PilotRequestSummary,
  PilotConversionPayload,
  PublicInspectionReport,
  SaasAlertsResponse,
  SaasAdminStats,
  SaasCompanyDetailsResponse,
  SaasCompanyLimits,
  SaasPaymentsResponse,
  SaasPlan,
  ServiceNotificationRecipient,
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
  client_photo_id?: string | null
  upload_status?: string | null
  captured_at?: string | null
  captured_lat?: number | null
  captured_lng?: number | null
  watermark_url?: string | null
  watermark_generated_at?: string | null
}

type RawDefectRecord = Omit<DefectRecord, 'photos'> & {
  photos?: RawPhotoRecord[] | string | null
}

type RawInspectionDetail = Omit<InspectionDetail, 'defects' | 'photos'> & {
  defects?: RawDefectRecord[]
  photos?: RawPhotoRecord[]
}

type RawInspectionRecord = Omit<InspectionRecord, 'completed' | 'duration_seconds' | 'odometer_value' | 'defects_count'> & {
  completed?: number | boolean | string | null
  duration_seconds?: number | string | null
  odometer_value?: number | string | null
  defects_count?: number | string | null
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
        client_photo_id: item.client_photo_id,
        upload_status: item.upload_status,
        captured_at: item.captured_at,
        captured_lat: item.captured_lat,
        captured_lng: item.captured_lng,
        watermark_url: item.watermark_url,
        watermark_generated_at: item.watermark_generated_at,
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
    completed: normalizeBooleanish(raw.completed),
    duration_seconds: normalizeNullableNumber(raw.duration_seconds),
    odometer_value: normalizeNullableNumber(raw.odometer_value),
    photos: normalizePhotos(raw.photos),
    defects: (raw.defects || []).map((defect) => ({
      ...defect,
      photos: normalizePhotos(defect.photos),
    })),
  }
}

function normalizeInspectionRecord(raw: RawInspectionRecord): InspectionRecord {
  const durationSeconds = normalizeNullableNumber(raw.duration_seconds)
  const completed = normalizeBooleanish(raw.completed) || Boolean(raw.completed_at) || durationSeconds !== null
  return {
    ...raw,
    completed,
    duration_seconds: durationSeconds,
    odometer_value: normalizeNullableNumber(raw.odometer_value),
    defects_count: normalizeNullableNumber(raw.defects_count) || 0,
  }
}

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeBooleanish(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true'
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
    if (!token && !hasAuthSession()) return false
    return !endpoint.startsWith('/auth/login')
      && !endpoint.startsWith('/auth/demo')
      && !endpoint.startsWith('/auth/mfa/verify')
      && !endpoint.startsWith('/auth/owner-setup')
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
        cache: options.cache ?? 'no-store',
        ...options,
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const sessionError = this.handleSessionFailure(response.status, endpoint, token, errorData.error)
        if (sessionError) {
          return { error: sessionError }
        }

        return {
          error: errorData.error === 'demo_read_only'
            ? (errorData.message || 'Это демо-режим. Изменение данных ограничено.')
            : (errorData.message || errorData.error || `HTTP ${response.status}`),
          code: errorData.error,
          missing: Array.isArray(errorData.missing) ? errorData.missing : undefined,
        }
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

  protected async publicRequest<T>(endpoint: string, options: RequestInit = {}, retry = false): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        cache: options.cache ?? 'no-store',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { error: errorData.message || errorData.error || `HTTP ${response.status}`, code: errorData.error }
      }

      if (response.status === 204) return {}
      return { data: await response.json() }
    } catch {
      if (!retry) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 400))
          return this.publicRequest<T>(endpoint, options, true)
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

  async createPilotRequest(data: PilotRequestSubmission) {
    return this.request<{ accepted: true }>('/public/pilot-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getPilotRequests(query = '') {
    return this.request<{ requests: PilotRequest[]; summary: PilotRequestSummary }>(
      `/admin/resource/pilot-requests${query ? `?${query}` : ''}`,
    )
  }

  async getPilotRequest(id: string) {
    return this.request<PilotRequest>(`/admin/resource/pilot-requests/${id}`)
  }

  async getPilotRequestSummary() {
    return this.request<PilotRequestSummary>('/admin/resource/pilot-requests/summary')
  }

  async getPilotRequestAssignees() {
    return this.request<{ users: PilotRequestAssignee[] }>('/admin/resource/pilot-requests/assignees')
  }

  async updatePilotRequest(id: string, data: Partial<PilotRequest>) {
    return this.request<PilotRequest>(`/admin/resource/pilot-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getPilotConversionPreview(id: string) {
    return this.request<PilotConversionPayload>(`/admin/resource/pilot-requests/${id}/conversion-preview`)
  }

  async convertPilotRequest(id: string, data: PilotConversionPayload) {
    return this.request<{
      request: PilotRequest
      company: { id: string; slug: string; name: string; planCode: string }
      owner: { id: string; name: string; email: string }
      setup: { setup_url: string; expires_at: string }
    }>(`/admin/resource/pilot-requests/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async anonymizePilotRequest(id: string) {
    return this.request<PilotRequest>(`/admin/resource/pilot-requests/${id}/anonymize`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async loginDemo() {
    const result = await this.request<LoginResponse>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    if (result.data?.token) {
      this.setToken(result.data.token)
    }

    return result
  }

  async verifyLoginMfa(mfaToken: string, token: string) {
    const result = await this.request<LoginResponse>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, token }),
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
    await this.request<void>('/auth/logout', { method: 'POST' })
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

  async getVehicles(params?: {
    page?: number
    limit?: number
    search?: string
    status?: string
    inspectionStatus?: string
  }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.search) query.set('search', params.search)
    if (params?.status) query.set('status', params.status)
    if (params?.inspectionStatus) query.set('inspection_status', params.inspectionStatus)

    return this.request<VehicleRecord[]>(`/vehicles?${query}`)
  }

  async getVehiclesList() {
    return this.request<VehicleListItem[]>('/vehicles/list')
  }

  async getVehicle(id: string) {
    return this.request<VehicleDetail>(`/vehicles/${id}`)
  }

  async getVehiclePhotoOptions(id: string) {
    return this.request<PhotoRecord[]>(`/vehicles/${id}/photo-options`)
  }

  async uploadVehiclePrimaryPhoto(id: string, file: File) {
    const token = this.getToken()
    const formData = new FormData()
    formData.append('photo', file)

    try {
      const response = await fetch(`${API_URL}/vehicles/${id}/primary-photo`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const sessionError = this.handleSessionFailure(response.status, `/vehicles/${id}/primary-photo`, token, errorData.error)
        if (sessionError) return { error: sessionError }
        return { error: errorData.message || errorData.error || `HTTP ${response.status}` }
      }

      return { data: await response.json() as VehicleDetail }
    } catch {
      return { error: 'Ошибка соединения с сервером' }
    }
  }

  async setVehiclePrimaryPhotoFromPhoto(id: string, photoId: string) {
    return this.request<VehicleDetail>(`/vehicles/${id}/primary-photo/from-photo`, {
      method: 'POST',
      body: JSON.stringify({ photo_id: photoId }),
    })
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

  async archiveVehicles(ids: string[]) {
    return this.request<{ requested: number; matched: number; archived: number; skipped: number; ids: string[] }>('/vehicles/archive', {
      method: 'POST',
      body: JSON.stringify({ ids }),
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

    const result = await this.request<RawInspectionRecord[]>(`/inspections?${query}`)
    return {
      ...result,
      data: result.data?.map(normalizeInspectionRecord),
    }
  }

  async getVehicleInspections(vehicleId: string, params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))

    const result = await this.request<RawInspectionRecord[]>(`/vehicles/${vehicleId}/inspections?${query}`)
    return {
      ...result,
      data: result.data?.map(normalizeInspectionRecord),
    }
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

  async uploadPhoto(defectId: string, file: File, geo?: string, coordinates?: { lat: number; lng: number }) {
    const token = this.getToken()
    const formData = new FormData()
    formData.append('photo', file)
    if (geo) formData.append('geo', geo)
    if (coordinates) {
      formData.append('captured_lat', String(coordinates.lat))
      formData.append('captured_lng', String(coordinates.lng))
    }

    const response = await fetch(`${API_URL}/defects/${defectId}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
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

  async uploadInspectionPhoto(inspectionId: string, photoType: string, file: File, geo?: string, coordinates?: { lat: number; lng: number }) {
    const token = this.getToken()
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('photo_type', photoType)
    if (geo) formData.append('geo', geo)
    if (coordinates) {
      formData.append('captured_lat', String(coordinates.lat))
      formData.append('captured_lng', String(coordinates.lng))
    }

    const response = await fetch(`${API_URL}/inspections/${inspectionId}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
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

  async createPhotoWatermark(id: string) {
    return this.request<PhotoRecord>(`/photos/${id}/watermark`, {
      method: 'POST',
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

  async getServiceNotificationRecipients() {
    return this.request<{ recipients: ServiceNotificationRecipient[] }>('/company/service-notification-recipients')
  }

  async updateServiceNotificationRecipients(recipients: Pick<ServiceNotificationRecipient, 'id' | 'serviceNotificationsEnabled'>[]) {
    return this.request<{ recipients: ServiceNotificationRecipient[] }>('/company/service-notification-recipients', {
      method: 'PUT',
      body: JSON.stringify({ recipients }),
    })
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

  async getSaasAdminStats() {
    return this.request<SaasAdminStats>('/admin/resource/stats')
  }

  async createDefect(
    inspectionId: string,
    data: { title: string; comment?: string; severity?: string },
  ) {
    return this.request<DefectRecord>(`/inspections/${inspectionId}/defects`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getInspectionApproval(id: string) {
    return this.request<InspectionApproval>(`/inspections/${id}/approval`)
  }

  async submitInspection(id: string, comment?: string) {
    return this.request<InspectionApproval>(`/inspections/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    })
  }

  async reviewInspection(
    id: string,
    status: 'approved' | 'rejected' | 'revision_required',
    comment?: string,
  ) {
    return this.request<InspectionApproval>(`/inspections/${id}/approval`, {
      method: 'POST',
      body: JSON.stringify({ status, comment }),
    })
  }

  async getInspectionReadiness(id: string) {
    return this.request<InspectionReadiness>(`/inspections/${id}/readiness`)
  }

  async getInspectionReport(id: string) {
    return this.request<InspectionReport>(`/inspections/${id}/report`)
  }

  async getPublicInspectionReport(token: string) {
    return this.publicRequest<PublicInspectionReport>(`/reports/public/${encodeURIComponent(token)}`)
  }

  async createInspectionReport(id: string) {
    return this.request<InspectionReport>(`/inspections/${id}/report`, {
      method: 'POST',
    })
  }

  async downloadInspectionReport(id: string): Promise<ApiResponse<Blob>> {
    const token = this.getToken()
    try {
      const response = await fetch(`${API_URL}/inspections/${id}/report.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const sessionError = this.handleSessionFailure(
          response.status,
          `/inspections/${id}/report.pdf`,
          token,
          errorData.error,
        )
        if (sessionError) return { error: sessionError }
        return {
          error: errorData.message || errorData.error || `HTTP ${response.status}`,
          code: errorData.error,
          missing: Array.isArray(errorData.missing) ? errorData.missing : undefined,
        }
      }
      return { data: await response.blob() }
    } catch {
      return { error: 'Ошибка соединения с сервером' }
    }
  }

  async getResourceAccess() {
    return this.request<ResourceAccess>('/admin/resource/access')
  }

  async getResourceCompanyRegistry(query = '') {
    return this.request<{ companies: SaasAdminStats['companies'] }>(`/admin/resource/companies-list${query ? `?${query}` : ''}`)
  }

  async getResourceCompanyNotificationRecipients(companyId: string) {
    return this.request<{ recipients: ServiceNotificationRecipient[] }>(`/admin/resource/companies/${companyId}/notification-recipients`)
  }

  async getCompanyBillingDetails(companyId: string) {
    return this.request<CompanyBillingDetails>(`/admin/resource/companies/${companyId}/billing-details`)
  }

  async updateCompanyBillingDetails(companyId: string, data: CompanyBillingDetails) {
    return this.request<CompanyBillingDetails>(`/admin/resource/companies/${companyId}/billing-details`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getResourceServiceUsers() {
    return this.request<{ users: ResourceServiceUser[]; presets: Record<string, string[]>; permissions: string[] }>('/admin/resource/service-users')
  }

  async getResourceSessionCookies() {
    return this.request<ResourceSessionCookies>('/admin/resource/session-cookies')
  }

  async createResourceServiceUser(data: { email: string; name: string; password: string; preset: string; permissions?: string[] }) {
    return this.request<ResourceServiceUser>('/admin/resource/service-users', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateResourceServiceUser(id: string, data: Partial<ResourceServiceUser>) {
    return this.request<ResourceServiceUser>(`/admin/resource/service-users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async updateResourceProfile(data: { name?: string; email?: string; password?: string }) {
    return this.request<AuthUser>('/admin/resource/profile', { method: 'PUT', body: JSON.stringify(data) })
  }

  async getServiceProfile() {
    return this.request<ServiceProfile>('/admin/resource/service-profile')
  }

  async updateServiceProfile(data: ServiceProfile) {
    return this.request<ServiceProfile>('/admin/resource/service-profile', { method: 'PUT', body: JSON.stringify(data) })
  }

  async getNotificationTemplates() {
    return this.request<{ templates: NotificationTemplate[] }>('/admin/resource/notification-templates')
  }

  async createNotificationTemplate(data: Partial<NotificationTemplate>) {
    return this.request<NotificationTemplate>('/admin/resource/notification-templates', { method: 'POST', body: JSON.stringify(data) })
  }

  async createResourceMessage(data: { companyId: string; recipientUserId?: string; title: string; message: string; templateId?: string }) {
    return this.request<{ created: number }>('/admin/resource/messages', { method: 'POST', body: JSON.stringify(data) })
  }

  async getResourcePayments() {
    return this.request<SaasPaymentsResponse>('/admin/resource/payments')
  }

  async createResourcePayment(data: ResourcePaymentPayload) {
    return this.request<{ payment: SaasPaymentsResponse['payments'][number] }>('/admin/resource/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async cancelResourcePayment(id: string, comment?: string) {
    return this.request<{ payment: SaasPaymentsResponse['payments'][number] }>(`/admin/resource/payments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    })
  }

  async getResourceAlerts() {
    return this.request<SaasAlertsResponse>('/admin/resource/alerts')
  }

  async scanResourceAlerts() {
    return this.request<SaasAlertsResponse>('/admin/resource/alerts/scan', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async markResourceAlertRead(id: string) {
    return this.request<SaasAlertsResponse['alerts'][number]>(`/admin/resource/alerts/${id}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async createResourceCompany(data: CreateCompanyPayload & { id?: string; status?: string; limits?: unknown }) {
    return this.request<CompanyRecord>('/admin/resource/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getResourceCompanyDetails(id: string) {
    return this.request<SaasCompanyDetailsResponse>(`/admin/resource/companies/${id}`)
  }

  async updateResourceCompany(id: string, data: UpdateCompanyPayload) {
    return this.request<CompanyRecord>(`/admin/resource/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async createResourceOwner(companyId: string, data: { email: string; name: string; status?: string; issue_setup_link?: boolean }) {
    return this.request<UserRecord & { setup?: { token: string; setup_url: string; expires_in: string; expires_at?: string } }>(`/admin/resource/companies/${companyId}/owners`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async issueResourceOwnerSetupLink(id: string) {
    return this.request<UserRecord & { setup?: { token: string; setup_url: string; expires_in: string; expires_at?: string } }>(`/admin/resource/owners/${id}/setup-link`, {
      method: 'POST',
    })
  }

  async updateResourceOwner(id: string, data: { email?: string; name?: string; status?: string }) {
    return this.request<UserRecord>(`/admin/resource/owners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteResourceOwner(id: string) {
    return this.request<void>(`/admin/resource/owners/${id}`, {
      method: 'DELETE',
    })
  }

  async updateResourceCompanyLimits(companyId: string, data: ResourceCompanyLimitsPayload) {
    return this.request<SaasCompanyLimits>(`/admin/resource/companies/${companyId}/limits`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async createResourcePlan(data: ResourcePlanPayload & { code: string; name: string }) {
    return this.request<SaasPlan>('/admin/resource/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateResourcePlan(code: string, data: ResourcePlanPayload) {
    return this.request<SaasPlan>(`/admin/resource/plans/${code}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteResourcePlan(code: string) {
    return this.request<void>(`/admin/resource/plans/${code}`, {
      method: 'DELETE',
    })
  }

  async exportData(type: ExportType) {
    return this.request<{ data: ExportRow[]; exportedAt: string }>(`/analytics/export/excel?type=${type}`)
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

  async enableUserMfa(id: string, token: string) {
    return this.request<MFAVerifyResponse>(`/users/${id}/mfa/enable`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  }

  async verifyUserMfa(id: string, token: string) {
    return this.enableUserMfa(id, token)
  }

  async disableUserMfa(id: string, data: { password: string; token?: string }) {
    return this.request<{ ok: boolean; mfa_enabled: boolean }>(`/users/${id}/mfa/disable`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async setDefectStatus(defectId: string, status: string, comment: string) {
    return this.request<DefectRecord>(`/defects/${defectId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, comment }),
    })
  }

  async closeDefect(defectId: string, comment: string) {
    return this.request<DefectRecord>(`/defects/${defectId}/close`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    })
  }

  async reopenDefect(defectId: string, comment: string) {
    return this.request<DefectRecord>(`/defects/${defectId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
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
