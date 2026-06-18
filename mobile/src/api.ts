import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import type {
  User,
  Vehicle,
  Company,
  Inspection,
  CreateInspectionPayload,
  InspectionType,
  AuthResponse,
  PhotoRequirementsResponse,
  VehicleNumberRecognitionResponse,
  OdometerRecognitionResponse,
  UploadPhotoResponse,
  InspectionReadiness,
  InspectionReadinessMissingItem,
} from './types'

const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:3001/api',
  default: 'http://localhost:3001/api',
})
const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '')

const isWeb = Platform.OS === 'web'
const AUTH_TOKEN_KEY = 'auth_token'
const INACTIVE_USER_ERROR = 'User is inactive'

export type AuthSessionReason = 'expired' | 'inactive'

export class AuthSessionError extends Error {
  reason: AuthSessionReason

  constructor(reason: AuthSessionReason) {
    super(
      reason === 'inactive'
        ? 'Ваша учетная запись отключена. Обратитесь к администратору.'
        : 'Сессия истекла или была отозвана. Войдите снова.',
    )
    this.name = 'AuthSessionError'
    this.reason = reason
  }
}

export function isAuthSessionError(error: unknown): error is AuthSessionError {
  return error instanceof AuthSessionError
}

let authSessionHandler: ((error: AuthSessionError) => void) | null = null

export function setAuthSessionHandler(handler: ((error: AuthSessionError) => void) | null): void {
  authSessionHandler = handler
}

function notifyAuthSessionError(reason: AuthSessionReason): AuthSessionError {
  const error = new AuthSessionError(reason)
  authSessionHandler?.(error)
  return error
}

async function getToken(): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(AUTH_TOKEN_KEY)
  }
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

async function setToken(token: string): Promise<void> {
  if (isWeb) {
    return AsyncStorage.setItem(AUTH_TOKEN_KEY, token)
  }
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token)
}

async function removeToken(): Promise<void> {
  if (isWeb) {
    return AsyncStorage.removeItem(AUTH_TOKEN_KEY)
  }
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY)
  } catch {
    // The safest fallback for a revoked/inactive session is to continue the UI reset
    // even if the platform secure-store cleanup fails transiently.
  }
}

function isAuthEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/owner-setup')
}

async function getSessionError(
  status: number,
  endpoint: string,
  token: string | null,
  backendError?: string,
): Promise<AuthSessionError | null> {
  if (!token || isAuthEndpoint(endpoint)) {
    return null
  }

  if (status === 401) {
    await removeToken()
    return notifyAuthSessionError('expired')
  }

  if (status === 403 && backendError === INACTIVE_USER_ERROR) {
    await removeToken()
    return notifyAuthSessionError('inactive')
  }

  return null
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers as Record<string, string>,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    const backendError = typeof error?.error === 'string' ? error.error : undefined
    const sessionError = await getSessionError(response.status, endpoint, token, backendError)
    if (sessionError) {
      throw sessionError
    }
    throw new ApiRequestError(
      error?.message || backendError || 'Request failed',
      response.status,
      backendError,
      Array.isArray(error?.missing) ? error.missing : [],
    )
  }

  return response.json()
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public missing: InspectionReadinessMissingItem[] = [],
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

function getPhotoUploadMetadata(imageUri: string, basename: string): { type: string; name: string } {
  const cleanUri = imageUri.split('?')[0]?.toLowerCase() || ''
  if (cleanUri.endsWith('.png')) {
    return { type: 'image/png', name: `${basename}.png` }
  }
  if (cleanUri.endsWith('.webp')) {
    return { type: 'image/webp', name: `${basename}.webp` }
  }

  return { type: 'image/jpeg', name: `${basename}.jpg` }
}

function appendPhoto(formData: FormData, fieldName: string, imageUri: string, basename: string): void {
  const metadata = getPhotoUploadMetadata(imageUri, basename)
  formData.append(fieldName, {
    uri: imageUri,
    type: metadata.type,
    name: metadata.name,
  } as any)
}

export const api = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const result = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (result.token) {
      await setToken(result.token)
    }
    return result
  },

  async logout(): Promise<void> {
    await removeToken()
  },

  async getMe(): Promise<User> {
    return request<User>('/auth/me')
  },

  async getCompanies(): Promise<Company[]> {
    return request<Company[]>('/companies')
  },

  async getVehiclesList(): Promise<Vehicle[]> {
    return request<Vehicle[]>('/vehicles/list')
  },

  async resolveVehicleNumber(number: string): Promise<Vehicle | null> {
    const result = await request<{ data: Vehicle | null }>('/vehicles/resolve-number', {
      method: 'POST',
      body: JSON.stringify({ number: number.toUpperCase() }),
    })
    return result.data
  },

  async recognizeVehicleNumber(imageUri: string): Promise<VehicleNumberRecognitionResponse> {
    const formData = new FormData()
    appendPhoto(formData, 'photo', imageUri, 'plate')

    const result = await request<Omit<VehicleNumberRecognitionResponse, 'candidates'>>('/vehicle-number/recognize', {
      method: 'POST',
      body: formData as any,
    })

    const candidates = [result.normalized_value, result.raw_value].filter((value): value is string => Boolean(value))
    return { ...result, candidates }
  },

  async createInspection(payload: CreateInspectionPayload): Promise<Inspection> {
    return request<Inspection>('/inspections', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async updateInspection(id: string, payload: Partial<CreateInspectionPayload>): Promise<Inspection> {
    return request<Inspection>(`/inspections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async completeInspection(id: string): Promise<Inspection> {
    return request<Inspection>(`/inspections/${id}/complete`, {
      method: 'POST',
    })
  },

  async getInspectionReadiness(id: string): Promise<InspectionReadiness> {
    return request<InspectionReadiness>(`/inspections/${id}/readiness`)
  },

  async getInspection(id: string): Promise<Inspection> {
    return request<Inspection>(`/inspections/${id}`)
  },

  async getPhotoRequirements(type: InspectionType): Promise<PhotoRequirementsResponse> {
    return request<PhotoRequirementsResponse>(`/photo-requirements/${type}`)
  },

  async uploadPhoto(
    inspectionId: string,
    photoType: string,
    imageUri: string,
    metadata?: {
      clientPhotoId?: string
      capturedAt?: string
      capturedLat?: number | null
      capturedLng?: number | null
    },
  ): Promise<UploadPhotoResponse> {
    const formData = new FormData()
    appendPhoto(formData, 'photo', imageUri, 'photo')
    formData.append('photo_type', photoType)
    if (metadata?.clientPhotoId) formData.append('client_photo_id', metadata.clientPhotoId)
    if (metadata?.capturedAt) formData.append('captured_at', metadata.capturedAt)
    if (metadata?.capturedLat !== null && metadata?.capturedLat !== undefined) {
      formData.append('captured_lat', String(metadata.capturedLat))
    }
    if (metadata?.capturedLng !== null && metadata?.capturedLng !== undefined) {
      formData.append('captured_lng', String(metadata.capturedLng))
    }

    return request<UploadPhotoResponse>(`/inspections/${inspectionId}/photos`, {
      method: 'POST',
      body: formData as any,
    })
  },

  async recognizeOdometer(imageUri: string): Promise<OdometerRecognitionResponse> {
    const formData = new FormData()
    appendPhoto(formData, 'photo', imageUri, 'odometer')

    const result = await request<Omit<OdometerRecognitionResponse, 'value'>>('/odometer/recognize', {
      method: 'POST',
      body: formData as any,
    })

    return {
      ...result,
      value: typeof result.normalized_value === 'number' ? result.normalized_value : null,
    }
  },

  async createDefect(inspectionId: string, payload: { title: string; comment?: string }): Promise<{ id: string }> {
    return request<{ id: string }>(`/inspections/${inspectionId}/defects`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async uploadDefectPhoto(
    defectId: string,
    imageUri: string,
    metadata?: {
      clientPhotoId?: string
      capturedAt?: string
      capturedLat?: number | null
      capturedLng?: number | null
    },
  ): Promise<UploadPhotoResponse> {
    const formData = new FormData()
    appendPhoto(formData, 'photo', imageUri, 'defect')
    if (metadata?.clientPhotoId) formData.append('client_photo_id', metadata.clientPhotoId)
    if (metadata?.capturedAt) formData.append('captured_at', metadata.capturedAt)
    if (metadata?.capturedLat !== null && metadata?.capturedLat !== undefined) {
      formData.append('captured_lat', String(metadata.capturedLat))
    }
    if (metadata?.capturedLng !== null && metadata?.capturedLng !== undefined) {
      formData.append('captured_lng', String(metadata.capturedLng))
    }

    return request<UploadPhotoResponse>(`/defects/${defectId}/photos`, {
      method: 'POST',
      body: formData as any,
    })
  },
}

export const offlineQueue = {
  async add(inspection: CreateInspectionPayload & { type: InspectionType; photos: string[] }): Promise<void> {
    const pending = await this.getAll()
    pending.push({ ...inspection, created_at: new Date().toISOString() })
    await AsyncStorage.setItem('offline_queue', JSON.stringify(pending))
  },

  async getAll(): Promise<(CreateInspectionPayload & { type: InspectionType; photos: string[]; created_at: string })[]> {
    const data = await AsyncStorage.getItem('offline_queue')
    return data ? JSON.parse(data) : []
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem('offline_queue')
  },

  async remove(index: number): Promise<void> {
    const pending = await this.getAll()
    pending.splice(index, 1)
    await AsyncStorage.setItem('offline_queue', JSON.stringify(pending))
  },
}
