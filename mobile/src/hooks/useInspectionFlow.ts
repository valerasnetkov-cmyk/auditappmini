import { useState } from 'react'
import { Alert } from 'react-native'
import { api } from '../api'
import type { Inspection, InspectionType, PhotoRequirementsResponse, Vehicle } from '../types'
import { QUICK_CHECKLIST, SCHEDULED_CHECKLIST, ACCIDENT_CHECKLIST } from '../types'

export type ChecklistEntry = {
  result: boolean | null
  comment: string
  photo: string | null
}

export type InspectionPhotoPreview = {
  localUri: string
  serverUrl: string
}

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

export function useInspectionFlow() {
  const [step, setStep] = useState<FlowStep>('home')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [inspectionType, setInspectionType] = useState<InspectionType | null>(null)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [photoRequirements, setPhotoRequirements] = useState<PhotoRequirementsResponse | null>(null)
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, InspectionPhotoPreview>>({})
  const [odometer, setOdometer] = useState('')
  const [checklist, setChecklist] = useState<Record<string, ChecklistEntry>>({})
  const [completedInspection, setCompletedInspection] = useState<Inspection | null>(null)
  const [loading, setLoading] = useState(false)
  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')

  const resetChecklist = (type: InspectionType) => {
    const next = Object.fromEntries(
      getChecklistTitles(type).map((title) => [title, { result: null, comment: '', photo: null }]),
    )
    setChecklist(next)
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
    } catch (error: unknown) {
      const err = error as { message?: string }
      Alert.alert('Ошибка', err.message || 'Не удалось найти технику')
    } finally {
      setLoading(false)
    }
  }

  const createInspection = async (type: InspectionType, accidentData?: { occurredAt: string; location: string }) => {
    if (!vehicle) return
    setLoading(true)
    try {
      const requirements = await api.getPhotoRequirements(type)
      const created = await api.createInspection({
        vehicle_id: vehicle.id,
        type,
        checklist: [],
        ...(type === 'accident'
          ? {
              accident_occurred_at: accidentData?.occurredAt.trim(),
              accident_location: accidentData?.location.trim(),
            }
          : {}),
      })
      setInspectionId(created.id)
      setPhotoRequirements(requirements)
      setInspectionPhotos({})
      setStep('photos')
    } catch (error: unknown) {
      const err = error as { message?: string }
      Alert.alert('Ошибка', err.message || 'Не удалось создать осмотр')
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

  const setInspectionPhoto = (photoType: string, preview: InspectionPhotoPreview) => {
    setInspectionPhotos((prev) => ({ ...prev, [photoType]: preview }))
  }

  const setDefectPhoto = (title: string, uri: string) => {
    setChecklist((prev) => ({
      ...prev,
      [title]: {
        ...(prev[title] || { result: false, comment: '', photo: null }),
        result: false,
        photo: uri,
      },
    }))
  }

  const setChecklistResult = (title: string, result: boolean | null) => {
    setChecklist((prev) => ({
      ...prev,
      [title]: {
        ...(prev[title] || { result: null, comment: '', photo: null }),
        result,
        ...(result === true ? { comment: '', photo: null } : {}),
      },
    }))
  }

  const setChecklistComment = (title: string, comment: string) => {
    setChecklist((prev) => ({
      ...prev,
      [title]: {
        ...(prev[title] || { result: false, comment: '', photo: null }),
        result: false,
        comment,
      },
    }))
  }

  const finishInspection = async (distanceUnit: string | null | undefined) => {
    if (!inspectionId || !inspectionType) return
    setLoading(true)
    try {
      const checklistTitles = getChecklistTitles(inspectionType)
      const checklistPayload = checklistTitles.map((title) => ({
        title,
        result: checklist[title]?.result ?? null,
        comment: checklist[title]?.comment || '',
      }))
      const updated = await api.updateInspection(inspectionId, {
        checklist: checklistPayload,
        ...(inspectionType === 'accident'
          ? {
              accident_occurred_at: accidentOccurredAt.trim(),
              accident_location: accidentLocation.trim(),
            }
          : {
              odometer_value: Number(odometer),
              odometer_unit: distanceUnit || 'km',
            }),
      })

      for (const checklistItem of updated.checklist_items) {
        if (checklistItem.result !== false && checklistItem.result !== 0) continue
        const draft = checklist[checklistItem.title]
        const defect = updated.defects?.find(
          (item) => item.checklist_item_id === checklistItem.id || item.title === checklistItem.title,
        )
        if (defect && draft?.photo && defect.photos.length === 0) {
          await api.uploadDefectPhoto(defect.id, draft.photo)
        }
      }
      const completed = await api.completeInspection(inspectionId)
      setCompletedInspection(completed)
      setStep('complete')
    } catch (error: unknown) {
      const err = error as { message?: string }
      Alert.alert('Ошибка', err.message || 'Не удалось завершить осмотр')
    } finally {
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setStep('home')
    setVehicleNumber('')
    setVehicle(null)
    setInspectionType(null)
    setInspectionId(null)
    setPhotoRequirements(null)
    setInspectionPhotos({})
    setOdometer('')
    setChecklist({})
    setCompletedInspection(null)
    setAccidentOccurredAt('')
    setAccidentLocation('')
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
      checklist,
      completedInspection,
      loading,
      accidentOccurredAt,
      accidentLocation,
    },
    actions: {
      setStep,
      setVehicleNumber,
      setInspectionType,
      setOdometer,
      setAccidentOccurredAt,
      setAccidentLocation,
      handleNumberSubmit,
      handleTypeSelect,
      createInspection,
      finishInspection,
      resetFlow,
      setInspectionPhoto,
      setDefectPhoto,
      setChecklistResult,
      setChecklistComment,
    },
  }
}
