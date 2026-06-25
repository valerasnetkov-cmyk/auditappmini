import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import type {
  DraftSyncStatus,
  InspectionType,
  PhotoRequirementsResponse,
  PhotoUploadStatus,
  Vehicle,
} from '../types'

const DRAFT_KEY = 'inspection_draft_v1'
const DRAFT_VERSION = 1

export type StoredPhotoDraft = {
  clientPhotoId: string
  localUri: string
  serverUrl: string
  status: PhotoUploadStatus
  error?: string
  capturedAt: string
  capturedLat?: number | null
  capturedLng?: number | null
}

export type StoredChecklistEntry = {
  result: boolean | null
  comment: string
  photo: string | null
  clientPhotoId?: string
  photoStatus?: PhotoUploadStatus
  photoError?: string
  capturedAt?: string
  capturedLat?: number | null
  capturedLng?: number | null
}

export type StoredInspectionDraft = {
  version: 1
  inspectionId: string
  clientInspectionId: string
  step: string
  vehicleNumber: string
  vehicle: Vehicle
  inspectionType: InspectionType
  photoRequirements: PhotoRequirementsResponse
  inspectionPhotos: Record<string, StoredPhotoDraft>
  odometer: string
  odometerUnavailableReason: string
  checklist: Record<string, StoredChecklistEntry>
  accidentOccurredAt: string
  accidentLocation: string
  syncStatus: DraftSyncStatus
  updatedAt: string
}

function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function extensionFromUri(uri: string) {
  const match = uri.split('?')[0]?.match(/\.([a-zA-Z0-9]+)$/)
  return match?.[1]?.toLowerCase() || 'jpg'
}

export const inspectionDraftStore = {
  createClientId,

  async load(): Promise<StoredInspectionDraft | null> {
    const value = await AsyncStorage.getItem(DRAFT_KEY)
    if (!value) return null
    try {
      const parsed = JSON.parse(value) as StoredInspectionDraft
      return parsed.version === DRAFT_VERSION ? parsed : null
    } catch {
      return null
    }
  },

  async save(draft: Omit<StoredInspectionDraft, 'version' | 'updatedAt'>): Promise<void> {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...draft,
      version: DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
    }))
  },

  async persistCapturedPhoto(inspectionId: string, sourceUri: string, clientPhotoId: string): Promise<string> {
    if (!FileSystem.documentDirectory) return sourceUri
    const directory = `${FileSystem.documentDirectory}inspection-drafts/${inspectionId}/`
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
    const destination = `${directory}${clientPhotoId}.${extensionFromUri(sourceUri)}`
    await FileSystem.copyAsync({ from: sourceUri, to: destination })
    return destination
  },

  async clear(inspectionId?: string): Promise<void> {
    await AsyncStorage.removeItem(DRAFT_KEY)
    if (!inspectionId || !FileSystem.documentDirectory) return
    const directory = `${FileSystem.documentDirectory}inspection-drafts/${inspectionId}/`
    await FileSystem.deleteAsync(directory, { idempotent: true })
  },
}
