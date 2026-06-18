export type UserRole = 'inspector' | 'manager' | 'owner' | 'admin'

export type InspectionType = 'quick' | 'scheduled' | 'accident'

export type InspectionStatus = 'open' | 'closed'
export type PhotoUploadStatus = 'local_pending' | 'uploading' | 'uploaded' | 'failed'
export type DraftSyncStatus = 'draft_local' | 'sync_pending' | 'syncing' | 'synced' | 'sync_failed'

export type VehicleStatus = 'active' | 'repair'

export type Company = {
  id: string
  slug: string
  name: string
  region_code?: string
  distance_unit?: 'km' | 'mi'
}

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  status?: 'active' | 'inactive'
  company_id: string
}

export type Vehicle = {
  id: string
  number: string
  name: string
  status: VehicleStatus
  region?: string
}

export type ChecklistItem = {
  id?: string
  title: string
  result: boolean | 0 | 1 | null
  comment: string
}

export type PhotoRequirementsResponse = {
  type: InspectionType
  requirements: {
    required: string[]
    optional: string[]
  }
  labels: Record<string, string>
}

export type VehicleNumberRecognitionResponse = {
  raw_value: string | null
  normalized_value: string | null
  confidence: number
  requires_confirmation: boolean
  message?: string
  photo_url?: string
  recognized_at?: string
  candidates: string[]
}

export type OdometerRecognitionResponse = {
  raw_value: string | null
  normalized_value: number | null
  unit: string
  confidence: number
  requires_manual_confirmation: boolean
  message?: string
  photo_url?: string
  recognized_at?: string
  value: number | null
}

export type PhotoRecord = {
  id: string
  url: string
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
}

export type UploadPhotoResponse = PhotoRecord

export type Inspection = {
  id: string
  vehicle_id: string
  vehicle_number: string
  vehicle_name: string
  inspector_id: string
  inspector_name: string
  type: InspectionType
  completed: boolean
  odometer_value?: number
  odometer_unit?: string
  odometer_confirmed_at?: string
  odometer_unavailable_reason?: string
  accident_occurred_at?: string
  accident_location?: string
  checklist_items: ChecklistItem[]
  defects?: Defect[]
  photos?: PhotoRecord[]
  created_at: string
}

export type Defect = {
  id: string
  inspection_id: string
  checklist_item_id?: string | null
  title: string
  comment?: string
  status: InspectionStatus
  photos: PhotoRecord[]
}

export type CreateInspectionPayload = {
  vehicle_id: string
  type: InspectionType
  odometer_value?: number
  odometer_unit?: string
  odometer_unavailable_reason?: string
  checklist: ChecklistItem[]
  accident_occurred_at?: string
  accident_location?: string
  client_inspection_id?: string
  sync_source?: 'mobile' | 'web'
}

export type CreateDefectPayload = {
  inspection_id: string
  title: string
  comment?: string
}

export type AuthResponse = {
  token: string
  user: User
}

export type ApiError = {
  error: string
  message?: string
  missing?: InspectionReadinessMissingItem[]
}

export type ApiResponse<T> = T | ApiError

export type InspectionReadinessMissingItem = {
  code: string
  field: string
  label: string
}

export type InspectionReadiness = {
  inspectionId: string
  inspectionType: InspectionType
  completed: boolean
  ready: boolean
  missing: InspectionReadinessMissingItem[]
}

export const QUICK_CHECKLIST = [
  'Внешний вид',
  'Повреждения кузова',
  'Колёса',
  'Стёкла',
  'Госномер',
]

export const SCHEDULED_CHECKLIST = [
  { section: 'Внешнее состояние', items: ['Внешний вид', 'Повреждения кузова', 'Лакокрасочное покрытие', 'Стёкла', 'Фары', 'Зеркала', 'Двери', 'Госномер'] },
  { section: 'Ходовая часть', items: ['Нет видимых повреждений подвески', 'Нет течей амортизаторов', 'Шины без критичных повреждений'] },
  { section: 'Тормозная система', items: ['Нет видимых подтёков', 'Тормозные шланги без повреждений', 'Стояночный тормоз работает'] },
  { section: 'Электрика', items: ['Аккумулятор без повреждений', 'Проводка без повреждений', 'Приборная панель без ошибок'] },
  { section: 'Световые приборы', items: ['Ближний свет', 'Дальний свет', 'Габариты', 'Стоп-сигналы', 'Поворотники'] },
]

export const ACCIDENT_CHECKLIST = [
  'Повреждения кузова',
  'Остекление',
  'Ходовая',
  'Кузов',
  'Безопасность',
]
