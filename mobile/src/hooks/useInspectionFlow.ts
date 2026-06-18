import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState } from 'react-native'
import { ApiRequestError, api } from '../api'
import { inspectionDraftStore, type StoredPhotoDraft } from '../services/inspectionDraftStore'
import type {
  DraftSyncStatus,
  Inspection,
  InspectionType,
  PhotoRequirementsResponse,
  PhotoUploadStatus,
  Vehicle,
} from '../types'
import { ACCIDENT_CHECKLIST, QUICK_CHECKLIST, SCHEDULED_CHECKLIST } from '../types'

export type ChecklistEntry = {
  result: boolean | null
  comment: string
  photo: string | null
  clientPhotoId?: string
  photoStatus?: PhotoUploadStatus
  photoError?: string
  capturedAt?: string
}

export type InspectionPhotoPreview = StoredPhotoDraft

export type FlowStep =
  | 'home'
  | 'number'
  | 'type'
  | 'accident'
  | 'photos'
  | 'odometer'
  | 'checklist'
  | 'complete'

export function getChecklistTitles(type: InspectionType): string[] {
  if (type === 'quick') return QUICK_CHECKLIST
  if (type === 'scheduled') return SCHEDULED_CHECKLIST.flatMap((section) => section.items)
  return ACCIDENT_CHECKLIST
}

function missingMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.missing.length > 0) {
    return error.missing.map((item) => `• ${item.label}`).join('\n')
  }
  return error instanceof Error ? error.message : 'Не удалось завершить осмотр'
}

export function useInspectionFlow() {
  const [step, setStep] = useState<FlowStep>('home')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [inspectionType, setInspectionType] = useState<InspectionType | null>(null)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [clientInspectionId, setClientInspectionId] = useState<string | null>(null)
  const [photoRequirements, setPhotoRequirements] = useState<PhotoRequirementsResponse | null>(null)
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, InspectionPhotoPreview>>({})
  const [odometer, setOdometer] = useState('')
  const [odometerUnavailableReason, setOdometerUnavailableReason] = useState('')
  const [checklist, setChecklist] = useState<Record<string, ChecklistEntry>>({})
  const [completedInspection, setCompletedInspection] = useState<Inspection | null>(null)
  const [loading, setLoading] = useState(false)
  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')
  const [syncStatus, setSyncStatus] = useState<DraftSyncStatus>('draft_local')
  const [hydrated, setHydrated] = useState(false)
  const [queueTick, setQueueTick] = useState(0)
  const uploadQueueRunning = useRef(false)

  useEffect(() => {
    void inspectionDraftStore.load().then((draft) => {
      if (draft) {
        setStep(draft.step as FlowStep)
        setVehicleNumber(draft.vehicleNumber)
        setVehicle(draft.vehicle)
        setInspectionType(draft.inspectionType)
        setInspectionId(draft.inspectionId)
        setClientInspectionId(draft.clientInspectionId)
        setPhotoRequirements(draft.photoRequirements)
        setInspectionPhotos(Object.fromEntries(
          Object.entries(draft.inspectionPhotos).map(([photoType, photo]) => [
            photoType,
            {
              ...photo,
              status: photo.status === 'uploaded' ? 'uploaded' : 'local_pending',
              error: undefined,
            },
          ]),
        ))
        setOdometer(draft.odometer)
        setOdometerUnavailableReason(draft.odometerUnavailableReason || '')
        setChecklist(draft.checklist)
        setAccidentOccurredAt(draft.accidentOccurredAt)
        setAccidentLocation(draft.accidentLocation)
        setSyncStatus(draft.syncStatus === 'synced' ? 'synced' : 'sync_pending')
      }
      setHydrated(true)
    })
  }, [])

  useEffect(() => {
    if (!hydrated || !inspectionId || !clientInspectionId || !vehicle || !inspectionType || !photoRequirements) return
    void inspectionDraftStore.save({
      inspectionId,
      clientInspectionId,
      step,
      vehicleNumber,
      vehicle,
      inspectionType,
      photoRequirements,
      inspectionPhotos,
      odometer,
      odometerUnavailableReason,
      checklist,
      accidentOccurredAt,
      accidentLocation,
      syncStatus,
    })
  }, [
    hydrated,
    inspectionId,
    clientInspectionId,
    step,
    vehicleNumber,
    vehicle,
    inspectionType,
    photoRequirements,
    inspectionPhotos,
    odometer,
    odometerUnavailableReason,
    checklist,
    accidentOccurredAt,
    accidentLocation,
    syncStatus,
  ])

  const retryFailedUploads = useCallback(() => {
    setInspectionPhotos((current) => Object.fromEntries(
      Object.entries(current).map(([photoType, photo]) => [
        photoType,
        photo.status === 'failed' ? { ...photo, status: 'local_pending', error: undefined } : photo,
      ]),
    ))
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryFailedUploads()
    })
    return () => subscription.remove()
  }, [retryFailedUploads])

  useEffect(() => {
    if (!inspectionId || uploadQueueRunning.current) return
    const pending = Object.entries(inspectionPhotos)
      .filter(([, photo]) => photo.status === 'local_pending')
      .slice(0, 2)
    if (pending.length === 0) return

    uploadQueueRunning.current = true
    const pendingTypes = new Set(pending.map(([photoType]) => photoType))
    setInspectionPhotos((current) => Object.fromEntries(
      Object.entries(current).map(([photoType, photo]) => [
        photoType,
        pendingTypes.has(photoType) ? { ...photo, status: 'uploading', error: undefined } : photo,
      ]),
    ))

    void Promise.all(pending.map(async ([photoType, photo]) => {
      try {
        const uploaded = await api.uploadPhoto(inspectionId, photoType, photo.localUri, {
          clientPhotoId: photo.clientPhotoId,
          capturedAt: photo.capturedAt,
          capturedLat: photo.capturedLat,
          capturedLng: photo.capturedLng,
        })
        setInspectionPhotos((current) => ({
          ...current,
          [photoType]: {
            ...current[photoType],
            status: 'uploaded',
            serverUrl: uploaded.thumb_url || uploaded.webp_url || uploaded.url,
            error: undefined,
          },
        }))
      } catch (error) {
        setInspectionPhotos((current) => ({
          ...current,
          [photoType]: {
            ...current[photoType],
            status: 'failed',
            error: error instanceof Error ? error.message : 'Не удалось загрузить фото',
          },
        }))
      }
    })).finally(() => {
      uploadQueueRunning.current = false
      setQueueTick((value) => value + 1)
    })
  }, [inspectionId, inspectionPhotos, queueTick])

  const resetChecklist = (type: InspectionType) => {
    setChecklist(Object.fromEntries(
      getChecklistTitles(type).map((title) => [title, { result: null, comment: '', photo: null }]),
    ))
  }

  const handleNumberSubmit = async () => {
    if (!vehicleNumber.trim()) return
    setLoading(true)
    try {
      const normalized = vehicleNumber.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '')
      const resolvedVehicle = await api.resolveVehicleNumber(normalized)
      if (!resolvedVehicle) {
        Alert.alert('Техника не найдена', 'Проверьте номер и попробуйте снова')
        return
      }
      setVehicle(resolvedVehicle)
      setStep('type')
    } catch (error) {
      Alert.alert('Нет связи', error instanceof Error ? error.message : 'Новый осмотр можно начать только при подключении')
    } finally {
      setLoading(false)
    }
  }

  const createInspection = async (type: InspectionType, accidentData?: { occurredAt: string; location: string }) => {
    if (!vehicle) return
    setLoading(true)
    const nextClientInspectionId = inspectionDraftStore.createClientId('inspection')
    try {
      const [requirements, created] = await Promise.all([
        api.getPhotoRequirements(type),
        api.createInspection({
          vehicle_id: vehicle.id,
          type,
          checklist: [],
          client_inspection_id: nextClientInspectionId,
          sync_source: 'mobile',
          ...(type === 'accident'
            ? {
                accident_occurred_at: accidentData?.occurredAt.trim(),
                accident_location: accidentData?.location.trim(),
              }
            : {}),
        }),
      ])
      setInspectionId(created.id)
      setClientInspectionId(nextClientInspectionId)
      setPhotoRequirements(requirements)
      setInspectionPhotos({})
      setSyncStatus('synced')
      setStep('photos')
    } catch (error) {
      Alert.alert('Нет связи', error instanceof Error ? error.message : 'Новый осмотр можно начать только при подключении')
    } finally {
      setLoading(false)
    }
  }

  const handleTypeSelect = async (type: InspectionType) => {
    setInspectionType(type)
    setCompletedInspection(null)
    resetChecklist(type)
    if (type === 'accident') {
      setStep('accident')
      return
    }
    await createInspection(type)
  }

  const enqueueInspectionPhoto = async (
    photoType: string,
    uri: string,
    coordinates?: { latitude: number; longitude: number } | null,
  ) => {
    if (!inspectionId) return
    const clientPhotoId = inspectionDraftStore.createClientId('photo')
    const localUri = await inspectionDraftStore.persistCapturedPhoto(inspectionId, uri, clientPhotoId)
    setInspectionPhotos((current) => ({
      ...current,
      [photoType]: {
        clientPhotoId,
        localUri,
        serverUrl: '',
        status: 'local_pending',
        capturedAt: new Date().toISOString(),
        capturedLat: coordinates?.latitude ?? null,
        capturedLng: coordinates?.longitude ?? null,
      },
    }))
    setSyncStatus('sync_pending')
  }

  const setDefectPhoto = async (title: string, uri: string) => {
    if (!inspectionId) return
    const clientPhotoId = inspectionDraftStore.createClientId('defect-photo')
    const localUri = await inspectionDraftStore.persistCapturedPhoto(inspectionId, uri, clientPhotoId)
    setChecklist((current) => ({
      ...current,
      [title]: {
        ...(current[title] || { result: false, comment: '', photo: null }),
        result: false,
        photo: localUri,
        clientPhotoId,
        photoStatus: 'local_pending',
        photoError: undefined,
        capturedAt: new Date().toISOString(),
      },
    }))
    setSyncStatus('sync_pending')
  }

  const setChecklistResult = (title: string, result: boolean | null) => {
    setChecklist((current) => ({
      ...current,
      [title]: {
        ...(current[title] || { result: null, comment: '', photo: null }),
        result,
        ...(result === true
          ? {
              comment: '',
              photo: null,
              clientPhotoId: undefined,
              photoStatus: undefined,
              photoError: undefined,
            }
          : {}),
      },
    }))
    setSyncStatus('sync_pending')
  }

  const setChecklistComment = (title: string, comment: string) => {
    setChecklist((current) => ({
      ...current,
      [title]: {
        ...(current[title] || { result: false, comment: '', photo: null }),
        result: false,
        comment,
      },
    }))
    setSyncStatus('sync_pending')
  }

  const finishInspection = async (distanceUnit: string | null | undefined) => {
    if (!inspectionId || !inspectionType) return
    const requiredPhotoTypes = photoRequirements?.requirements.required || []
    const pendingRequired = requiredPhotoTypes.filter((photoType) => inspectionPhotos[photoType]?.status !== 'uploaded')
    if (pendingRequired.length > 0) {
      Alert.alert('Фото ещё не синхронизированы', 'Повторите отправку не загруженных обязательных фото.')
      return
    }

    setLoading(true)
    setSyncStatus('syncing')
    try {
      const checklistTitles = getChecklistTitles(inspectionType)
      const updated = await api.updateInspection(inspectionId, {
        checklist: checklistTitles.map((title) => ({
          title,
          result: checklist[title]?.result ?? null,
          comment: checklist[title]?.comment || '',
        })),
        ...(inspectionType === 'accident'
          ? {
              accident_occurred_at: accidentOccurredAt.trim(),
              accident_location: accidentLocation.trim(),
              ...(odometer ? { odometer_value: Number(odometer), odometer_unit: distanceUnit || 'km' } : {}),
              odometer_unavailable_reason: odometer ? '' : odometerUnavailableReason.trim(),
            }
          : {
              odometer_value: Number(odometer),
              odometer_unit: distanceUnit || 'km',
            }),
      })

      const defectUploads = updated.checklist_items.flatMap((checklistItem) => {
        if (checklistItem.result !== false && checklistItem.result !== 0) return []
        const draft = checklist[checklistItem.title]
        const defect = updated.defects?.find(
          (item) => item.checklist_item_id === checklistItem.id || item.title === checklistItem.title,
        )
        if (!defect || !draft?.photo || defect.photos.length > 0) return []
        return [{ title: checklistItem.title, defectId: defect.id, draft }]
      })

      for (let index = 0; index < defectUploads.length; index += 2) {
        await Promise.all(defectUploads.slice(index, index + 2).map(async ({ title, defectId, draft }) => {
          setChecklist((current) => ({
            ...current,
            [title]: { ...current[title], photoStatus: 'uploading', photoError: undefined },
          }))
          try {
            await api.uploadDefectPhoto(defectId, draft.photo!, {
              clientPhotoId: draft.clientPhotoId,
              capturedAt: draft.capturedAt,
            })
            setChecklist((current) => ({
              ...current,
              [title]: { ...current[title], photoStatus: 'uploaded', photoError: undefined },
            }))
          } catch (error) {
            setChecklist((current) => ({
              ...current,
              [title]: {
                ...current[title],
                photoStatus: 'failed',
                photoError: error instanceof Error ? error.message : 'Не удалось загрузить фото дефекта',
              },
            }))
            throw error
          }
        }))
      }

      const readiness = await api.getInspectionReadiness(inspectionId)
      if (!readiness.ready) {
        throw new ApiRequestError(
          'Осмотр нельзя завершить: не хватает обязательных данных',
          400,
          'INSPECTION_COMPLETION_BLOCKED',
          readiness.missing,
        )
      }
      const completed = await api.completeInspection(inspectionId)
      setCompletedInspection(completed)
      setSyncStatus('synced')
      const completedInspectionId = inspectionId
      setInspectionId(null)
      setClientInspectionId(null)
      await inspectionDraftStore.clear(completedInspectionId)
      setStep('complete')
    } catch (error) {
      setSyncStatus('sync_failed')
      Alert.alert('Осмотр не завершён', missingMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const retryInspectionPhoto = (photoType: string) => {
    setInspectionPhotos((current) => ({
      ...current,
      [photoType]: current[photoType]
        ? { ...current[photoType], status: 'local_pending', error: undefined }
        : current[photoType],
    }))
  }

  const retryDefectPhoto = (title: string) => {
    setChecklist((current) => ({
      ...current,
      [title]: current[title]
        ? { ...current[title], photoStatus: 'local_pending', photoError: undefined }
        : current[title],
    }))
  }

  const resetFlow = () => {
    const previousInspectionId = inspectionId
    setStep('home')
    setVehicleNumber('')
    setVehicle(null)
    setInspectionType(null)
    setInspectionId(null)
    setClientInspectionId(null)
    setPhotoRequirements(null)
    setInspectionPhotos({})
    setOdometer('')
    setOdometerUnavailableReason('')
    setChecklist({})
    setCompletedInspection(null)
    setAccidentOccurredAt('')
    setAccidentLocation('')
    setSyncStatus('draft_local')
    void inspectionDraftStore.clear(previousInspectionId || undefined)
  }

  return {
    state: {
      step,
      vehicleNumber,
      vehicle,
      inspectionType,
      inspectionId,
      photoRequirements,
      inspectionPhotos,
      odometer,
      odometerUnavailableReason,
      checklist,
      completedInspection,
      loading,
      accidentOccurredAt,
      accidentLocation,
      syncStatus,
    },
    actions: {
      setStep,
      setVehicleNumber,
      setInspectionType,
      setOdometer,
      setOdometerUnavailableReason,
      setAccidentOccurredAt,
      setAccidentLocation,
      handleNumberSubmit,
      handleTypeSelect,
      createInspection,
      finishInspection,
      resetFlow,
      enqueueInspectionPhoto,
      retryInspectionPhoto,
      retryFailedUploads,
      retryDefectPhoto,
      setDefectPhoto,
      setChecklistResult,
      setChecklistComment,
    },
  }
}
