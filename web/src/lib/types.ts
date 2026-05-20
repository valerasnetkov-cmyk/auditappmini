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
  status?: 'active' | 'inactive'
  company_id?: string
}

export type LoginResponse = {
  token?: string
  user?: AuthUser
  mfaRequired?: boolean
}

export type UserRole = 'inspector' | 'manager' | 'owner' | 'admin' | string

export type CompanyRecord = {
  id: string
  slug: string
  name: string
  region_code?: string
  data_residency?: string
  api_cluster_key?: string
  storage_cluster_key?: string
  ocr_cluster_key?: string
  status: 'active' | 'inactive'
  created_at: string
}

export type CreateCompanyPayload = {
  slug: string
  name: string
  region_code?: string
  data_residency?: string
  api_cluster_key?: string
  storage_cluster_key?: string
  ocr_cluster_key?: string
}

export type UpdateCompanyPayload = Partial<CreateCompanyPayload> & { status?: 'active' | 'inactive' }

export type UserRecord = {
  id: string
  email: string
  name: string
  role: UserRole
  status?: 'active' | 'inactive'
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
  vehicleCount?: number
  merged_from?: string
  merged_into?: string
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
  created_at?: string
  defectsCount?: number
  lastInspection?: {
    id: string
    created_at: string
  } | null
}

export type VehicleDetail = VehicleListItem & {
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
  region?: string
}

export type UpdateVehiclePayload = {
  number: string
  name: string
  status: VehicleStatus
  region?: string
  reason?: string
}

export type InspectionType = 'quick' | 'scheduled' | 'accident' | string

export type ChecklistItemInput = {
  id?: string
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

export type PhotoRequirementsResponse = {
  type: InspectionType
  requirements: {
    required: string[]
    optional: string[]
  }
  labels: Record<string, string>
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

export type DefectHistoryEntry = {
  id: string
  defect_id: string
  status: string
  changed_at: string
  changed_by?: string | null
}

export type VehicleDefectHistoryItem = DefectRecord & {
  inspection_id: string
  vehicle_id: string
}

export type UploadPhotoResponse = {
  id?: string
  url?: string
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
  odometer_value?: number | null
  odometer_unit?: string | null
  checklist_items: ChecklistItemResponse[]
  defects: DefectRecord[]
  photos?: PhotoRecord[]
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
  odometer_value?: number
  odometer_unit?: string
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

export type DirectusIntegrationStatus = {
  configured: boolean
  url: string
  collections: string[]
  legacy_sync_collections?: string[]
}

export type CompanyResourceUsage = {
  current: number
  max: number | null
  remaining: number | null
  percent: number | null
  unlimited: boolean
  exceeded: boolean
}

export type CompanyFeatureAccess = {
  enabled: boolean
  configured: boolean | null
}

export type CompanyUsageResponse = {
  company: {
    id: string
    slug?: string | null
    name: string
    status: 'active' | 'inactive' | string
    region_code?: string | null
    data_residency?: string | null
  }
  plan: {
    code?: string | null
  }
  usage: {
    vehicles: CompanyResourceUsage
    users: CompanyResourceUsage
  }
  limits: {
    maxStorageMb?: number | null
  }
  features: {
    ocr: CompanyFeatureAccess
    accidentModule: CompanyFeatureAccess
    analytics: CompanyFeatureAccess
    apiAccess: CompanyFeatureAccess
  }
  updatedAt?: string | null
}

export type SaasAdminTotals = {
  companies: number
  activeCompanies: number
  inactiveCompanies: number
  users: number
  owners: number
  managers: number
  inspectors: number
  vehicles: number
  activeVehicles: number
  repairVehicles: number
  inspections: number
  completedInspections: number
  accidents: number
  defects: number
  openDefects: number
  closedDefects: number
  photos: number
  inspections7d: number
  defects7d: number
  accidents7d: number
}

export type SaasOperationalHealth = {
  companiesWithoutOwner: number
  companiesWithoutLimits: number
  companiesWithoutOwnerList?: SaasHealthCompany[]
  companiesWithoutLimitsList?: SaasHealthCompany[]
  unassignedVehicles: number
  unassignedInspections: number
  unassignedDefects: number
}

export type SaasHealthCompany = {
  id: string
  slug?: string | null
  name: string
  status?: string | null
}

export type SaasCompanyLimits = {
  planCode?: string | null
  maxVehicles?: number | null
  maxUsers?: number | null
  maxStorageMb?: number | null
  ocrEnabled?: boolean | null
  accidentModuleEnabled?: boolean | null
  analyticsEnabled?: boolean | null
  apiAccessEnabled?: boolean | null
}

export type SaasCompanyStats = {
  id: string
  slug: string
  name: string
  region_code?: string | null
  data_residency?: string | null
  status: 'active' | 'inactive' | string
  created_at?: string | null
  users: number
  owners: number
  vehicles: number
  activeVehicles: number
  repairVehicles: number
  inspections: number
  accidents: number
  defects: number
  openDefects: number
  lastInspectionAt?: string | null
  limits?: SaasCompanyLimits | null
}

export type SaasAdminStats = {
  generated_at: string
  window: {
    recent_days: number
    from: string
  }
  totals: SaasAdminTotals
  operational_health: SaasOperationalHealth
  companies: SaasCompanyStats[]
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

export type DailyCount = {
  date: string
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
  dailyInspections?: DailyCount[]
  vehiclesByRegion?: CountByRegion[]
  inspectionsByRegion?: CountByRegion[]
}

export type ExportType = 'vehicles' | 'inspections' | 'defects'

export type ExportRow = Record<string, unknown>
