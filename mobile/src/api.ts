import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import type { User, Vehicle, Company, Inspection, CreateInspectionPayload, InspectionType, ChecklistItem, AuthResponse, ApiResponse } from './types'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api'

const isWeb = Platform.OS === 'web'

async function getToken(): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem('auth_token')
  }
  try {
    return await SecureStore.getItemAsync('auth_token')
  } catch {
    return null
  }
}

async function setToken(token: string): Promise<void> {
  if (isWeb) {
    return AsyncStorage.setItem('auth_token', token)
  }
  await SecureStore.setItemAsync('auth_token', token)
}

async function removeToken(): Promise<void> {
  if (isWeb) {
    return AsyncStorage.removeItem('auth_token')
  }
  await SecureStore.deleteItemAsync('auth_token')
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers as Record<string, string>,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
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

  async recognizeVehicleNumber(imageBase64: string): Promise<{ candidates: string[] }> {
    const formData = new FormData()
    formData.append('image', {
      uri: `data:image/jpeg;base64,${imageBase64}`,
      type: 'image/jpeg',
      name: 'plate.jpg',
    } as any)

    return request('/vehicle-number/recognize', {
      method: 'POST',
      body: formData as any,
    })
  },

  async createInspection(payload: { vehicle_id: string; type: InspectionType }): Promise<{ id: string }> {
    return request<{ id: string }>('/inspections', {
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

  async getInspection(id: string): Promise<Inspection> {
    return request<Inspection>(`/inspections/${id}`)
  },

  async uploadPhoto(inspectionId: string, imageBase64: string): Promise<{ url: string; id: string }> {
    const formData = new FormData()
    formData.append('photo', {
      uri: `data:image/jpeg;base64,${imageBase64}`,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any)

    return request(`/inspections/${inspectionId}/photos`, {
      method: 'POST',
      body: formData as any,
    })
  },

  async recognizeOdometer(imageBase64: string): Promise<{ value: number }> {
    const formData = new FormData()
    formData.append('image', {
      uri: `data:image/jpeg;base64,${imageBase64}`,
      type: 'image/jpeg',
      name: 'odometer.jpg',
    } as any)

    return request('/odometer/recognize', {
      method: 'POST',
      body: formData as any,
    })
  },

  async createDefect(payload: { inspection_id: string; title: string; comment?: string }): Promise<{ id: string }> {
    return request<{ id: string }>('/defects', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async uploadDefectPhoto(defectId: string, imageBase64: string): Promise<{ url: string; id: string }> {
    const formData = new FormData()
    formData.append('photo', {
      uri: `data:image/jpeg;base64,${imageBase64}`,
      type: 'image/jpeg',
      name: 'defect.jpg',
    } as any)

    return request(`/defects/${defectId}/photos`, {
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