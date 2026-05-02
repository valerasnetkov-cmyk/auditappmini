export type ApiPagination = {
  page: number
  limit: number
  total: number
  pages: number
}

export type ApiResponse<T> = {
  data?: T
  error?: string
  pagination?: ApiPagination
}

export type AuthUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

export type LoginResponse = {
  token?: string
  user?: AuthUser
  mfaRequired?: boolean
}

export type UserRole = 'inspector' | 'manager' | 'admin' | string

export type UserRecord = {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
  mfa_enabled?: boolean
}

export type CreateUserPayload = {
  email: string
  password: string
  name: string
  role?: UserRole
}

export type UpdateUserPayload = {
  email?: string
  name?: string
  role?: UserRole
  password?: string
}

export type RegionRecord = {
  id: string
  name: string
  created_at?: string
  vehicle_count?: number
}

export type CreateRegionPayload = {
  name: string
}

export type MFASetupResponse = {
  otpauth_url: string
  secret: string
}

export type MFAVerifyResponse = {
  token?: string
  user?: AuthUser
}

export type VehicleStatus = 'active' | 'repair' | string

export type VehicleListItem = {
  id: string
  number: string
  name: string
  status: VehicleStatus
  region?: string | null
}

export type VehicleRecord = VehicleListItem & {
  qr_code?: string | null
  created_at?: string
  defectsCount?: number
  lastInspection?: {
    id: string
    created_at: string
  } | null
}

export type VehicleDetail = VehicleListItem & {
  qr_code?: string | null
  last_scheduled_inspection?: string | null
}

export type VehicleHistoryEntry = {
  id: string
  vehicle_id?: string
  old_status: VehicleStatus
  new_status: VehicleStatus
  reason?: string | null
  changed_by_name?: string | null
  created_at: string
}

export type CreateVehiclePayload = {
  number: string
  name: string
  status?: VehicleStatus
  qr_code?: string
  region?: string
}

export type UpdateVehiclePayload = {
  number: string
  name: string
  status: VehicleStatus
  qr_code?: string
  region?: string
  reason?: string
}

export type InspectionType = 'quick' | 'scheduled' | 'accident' | string

export type ChecklistItemInput = {
  title: string
  result: boolean
  comment?: string
}

export type AccidentMetadata = {
  accident_occurred_at?: string | null
  accident_location?: string | null
}

export type ChecklistItemResponse = {
  id?: string
  inspection_id?: string
  title: string
  result: number | boolean
  comment?: string | null
}

export type PhotoRecord = {
  id?: string
  url: string
  geo?: string | null
}

export type DefectRecord = {
  id: string
  inspection_id?: string
  vehicle_id?: string
  vehicle_number?: string
  vehicle_name?: string
  vehicle_region?: string | null
  inspection_date?: string | null
  inspection_type?: InspectionType
  inspection_time?: string | null
  accident_occurred_at?: string | null
  accident_location?: string | null
  inspector_name?: string
  title: string
  comment?: string | null
  created_at: string
  status?: string
  closed_at?: string
  photos: PhotoRecord[]
}

export type VehicleDefectHistoryItem = DefectRecord & {
  inspection_id: string
  vehicle_id: string
}

export type UploadPhotoResponse = {
  id?: string
  url?: string
  geo?: string | null
}

export type UpdateDefectPayload = {
  title: string
  comment?: string
}

export type InspectionRecord = {
  id: string
  vehicle_id: string
  type: InspectionType
  completed?: number | boolean
  created_at: string
  accident_occurred_at?: string | null
  accident_location?: string | null
  vehicle_number: string
  vehicle_name: string
  vehicle_region?: string | null
  inspector_name: string
  defects_count: number
}

export type InspectionDetail = {
  id: string
  vehicle_id: string
  vehicle_number: string
  vehicle_name: string
  inspector_name?: string
  type: InspectionType
  completed?: number | boolean
  created_at: string
  accident_occurred_at?: string | null
  accident_location?: string | null
  checklist_items: ChecklistItemResponse[]
  defects: DefectRecord[]
}

export type CreateInspectionPayload = {
  vehicle_id: string
  type: InspectionType
  checklist: ChecklistItemInput[]
  accident_occurred_at?: string
  accident_location?: string
}

export type UpdateInspectionPayload = {
  checklist: ChecklistItemInput[]
  accident_occurred_at?: string
  accident_location?: string
}

export type InspectionCreateResponse = {
  id: string
  vehicle_id: string
  inspector_id: string
  type: InspectionType
  completed?: number | boolean
  created_at?: string
}

export type DashboardStats = {
  totalVehicles: number
  vehiclesWithDefects: number
  totalInspections: number
  inspectionsToday: number
}

export type NotificationItem = {
  vehicle_id: string
  vehicle_number: string
  vehicle_name: string
  is_overdue: boolean
  days_until: number
  next_due?: string | null
  last_inspection?: string | null
}

export type SettingsResponse = {
  scheduled_inspection_days?: number
  notification_days_before?: number
  timezone_offset?: number
}

export type CountByRegion = {
  region?: string | null
  count: number
}

export type CountByStatus = {
  status: string
  count: number
}

export type CountByType = {
  type: string
  count: number
}

export type AccidentRecentItem = {
  id: string
  vehicle_number: string
  vehicle_name: string
  created_at: string
}

export type AccidentStats = {
  total: number
  daysWithoutAccident: number
  recent: AccidentRecentItem[]
}

export type AnalyticsOverview = {
  total?: {
    vehicles?: number
    inspections?: number
    defects?: number
  }
  week?: {
    inspections?: number
  }
  accidents?: AccidentStats | null
  defectsByRegion?: CountByRegion[]
  vehiclesByStatus?: CountByStatus[]
  inspectionsByType?: CountByType[]
  vehiclesByRegion?: CountByRegion[]
  inspectionsByRegion?: CountByRegion[]
}

export type ExportType = 'vehicles' | 'inspections' | 'defects'

export type ExportRow = Record<string, unknown>
