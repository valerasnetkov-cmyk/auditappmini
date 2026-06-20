export type ApiPagination = {
  page: number
  limit: number
  total: number
  pages: number
}

export type ApiResponse<T> = {
  data?: T
  error?: string
  code?: string
  missing?: InspectionReadinessMissingItem[]
  pagination?: ApiPagination
}

export type AuthUser = {
  id: string
  email: string
  name: string
  role: UserRole
  status?: 'active' | 'inactive'
  company_id?: string
  access_mode?: 'standard' | 'demo_readonly' | string
}

export type ResourceAccess = {
  role: string
  permissions: string[]
  availablePermissions: string[]
  presets: Record<string, string[]>
}

export type ResourceServiceUser = {
  id: string
  email: string
  name: string
  role: string
  status: string
  preset: string
  permissions: string[]
  createdAt?: string | null
}

export type ResourceSessionCookies = {
  authCookieName: string
  authSource: 'cookie' | 'bearer' | null
  authCookiePresent: boolean
  cookieNames: string[]
  authCookieLength: number
  jwt: {
    subject: string | null
    userId: string | null
    email: string | null
    companyId: string | null
    role: string | null
    issuedAt: string | null
    expiresAt: string | null
    expiresInSeconds: number | null
    isExpired: boolean | null
  } | null
  settings: {
    httpOnly: boolean
    secure: boolean
    sameSite: string
    maxAgeSeconds: number
    path: string
  }
  tokenFingerprint: string | null
}

export type CompanyBillingDetails = {
  id?: string
  legal_name?: string | null
  short_name?: string | null
  inn?: string | null
  kpp?: string | null
  ogrn?: string | null
  legal_address?: string | null
  postal_address?: string | null
  billing_email?: string | null
  billing_contact_name?: string | null
  billing_contact_phone?: string | null
  accounting_comment?: string | null
}

export type ServiceProfile = {
  id?: string
  service_name?: string | null
  legal_name?: string | null
  inn?: string | null
  kpp?: string | null
  ogrn?: string | null
  legal_address?: string | null
  postal_address?: string | null
  bank_name?: string | null
  bik?: string | null
  bank_account?: string | null
  correspondent_account?: string | null
  billing_email?: string | null
  support_email?: string | null
  support_phone?: string | null
}

export type NotificationTemplate = {
  id: string
  code: string
  title: string
  body: string
  category: string
  is_active: number
}

export type PilotRequestSubmission = {
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  vehicleCount: number
  region?: string
  comment?: string
  website?: string
  consentGiven: boolean
  source?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
}

export type PilotRequestStatus = 'new' | 'in_progress' | 'approved' | 'rejected' | 'converted'

export type PilotRequest = {
  id: string
  companyName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  vehicleCount: number
  region: string | null
  comment: string | null
  status: PilotRequestStatus
  assignedUserId: string | null
  assignedUserName: string | null
  internalComment: string | null
  rejectionReason: string | null
  source: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  consentGiven: boolean
  consentAt: string | null
  linkedCompanyId: string | null
  convertedAt: string | null
  anonymizedAt: string | null
  createdAt: string
  updatedAt: string
}

export type PilotRequestSummary = {
  total: number
  new: number
  inProgress: number
  approved: number
  rejected: number
  converted: number
}

export type PilotRequestAssignee = {
  id: string
  name: string
  email: string
  role: string
}

export type PilotConversionPayload = {
  companyName: string
  slug: string
  regionCode?: string
  dataResidency?: string
  ownerName: string
  ownerEmail: string
  planCode: string
  limits: {
    maxVehicles: number | null
    maxUsers: number | null
    maxInspectionsPerMonth: number | null
    maxStorageMb: number | null
    storageLimitGb: number | null
    ocrEnabled: boolean
    ocrMonthlyLimit: number | null
    accidentModuleEnabled: boolean
    analyticsEnabled: boolean
    pdfReportEnabled: boolean
    exportEnabled: boolean
    apiAccessEnabled: boolean
    customBrandingEnabled: boolean
    regionalStorageEnabled: boolean
    supportLevel: string
  }
}

export type LoginResponse = {
  token?: string
  user?: AuthUser
  mfaRequired?: boolean
  mfaToken?: string
}

export type UserRole = 'inspector' | 'manager' | 'owner' | 'admin' | 'resource_manager' | string

export type CompanyRecord = {
  id: string
  slug: string
  name: string
  access_mode?: 'standard' | 'demo_readonly' | string
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

export type VehicleStatus = 'active' | 'repair' | 'archived' | string
export type InspectionScheduleStatus =
  | 'inspection_actual'
  | 'inspection_due_soon'
  | 'inspection_overdue'
  | 'never_inspected'

export type InspectionScheduleItem = {
  status: InspectionScheduleStatus
  interval_days: number
  last_inspection_at?: string | null
  next_due?: string | null
  days_until?: number | null
}

export type VehicleInspectionSchedule = {
  status: InspectionScheduleStatus
  quick: InspectionScheduleItem
  planned: InspectionScheduleItem
}

export type VehicleListItem = {
  id: string
  number: string
  name: string
  status: VehicleStatus
  region?: string | null
}

export type VehicleRecord = VehicleListItem & {
  created_at?: string
  quick_inspection_interval_days?: number | null
  planned_inspection_interval_days?: number | null
  inspection_schedule?: VehicleInspectionSchedule
  defectsCount?: number
  lastInspection?: {
    id: string
    created_at: string
  } | null
}

export type VehicleDetail = VehicleListItem & {
  created_at?: string | null
  primary_photo_url?: string | null
  primary_photo_original_url?: string | null
  primary_photo_webp_url?: string | null
  primary_photo_thumb_url?: string | null
  primary_photo_source?: 'upload' | 'inspection' | string | null
  last_scheduled_inspection?: string | null
  quick_inspection_interval_days?: number | null
  planned_inspection_interval_days?: number | null
  inspection_schedule?: VehicleInspectionSchedule
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
  quick_inspection_interval_days?: number | null
  planned_inspection_interval_days?: number | null
}

export type UpdateVehiclePayload = {
  number: string
  name: string
  status: VehicleStatus
  region?: string
  reason?: string
  quick_inspection_interval_days?: number | null
  planned_inspection_interval_days?: number | null
}

export type InspectionType = 'quick' | 'scheduled' | 'accident' | string
export type InspectionApprovalStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'revision_required'
  | string

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
  client_photo_id?: string | null
  upload_status?: string | null
  captured_at?: string | null
  captured_lat?: number | null
  captured_lng?: number | null
  watermark_url?: string | null
  watermark_generated_at?: string | null
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
  severity?: 'low' | 'medium' | 'high' | 'critical' | string
  resolved_at?: string | null
  closed_at?: string
  closed_by?: string | null
  manager_comment?: string | null
  photos: PhotoRecord[]
}

export type DefectHistoryEntry = {
  id: string
  defect_id: string
  status: string
  from_status?: string | null
  to_status?: string
  comment?: string | null
  changed_at: string
  changed_by?: string | null
  changed_by_name?: string | null
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
  started_at?: string | null
  completed_at?: string | null
  duration_seconds?: number | null
  accident_occurred_at?: string | null
  accident_location?: string | null
  odometer_value?: number | null
  odometer_unit?: string | null
  odometer_confirmed_at?: string | null
  odometer_unavailable_reason?: string | null
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
  started_at?: string | null
  accident_occurred_at?: string | null
  accident_location?: string | null
  odometer_value?: number | null
  odometer_unit?: string | null
  odometer_confirmed_at?: string | null
  odometer_unavailable_reason?: string | null
  completed_at?: string | null
  duration_seconds?: number | null
  approval_status?: InspectionApprovalStatus
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
  odometer_unavailable_reason?: string
}

export type InspectionApprovalHistoryEntry = {
  id: string
  company_id: string
  inspection_id: string
  from_status?: InspectionApprovalStatus | null
  to_status: InspectionApprovalStatus
  comment?: string | null
  created_by: string
  created_by_name?: string | null
  created_by_role?: string | null
  created_at: string
}

export type InspectionApproval = {
  status: InspectionApprovalStatus
  submitted_at?: string | null
  submitted_by?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  comment?: string | null
  history: InspectionApprovalHistoryEntry[]
}

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

export type InspectionReport = {
  id: string
  company_id: string
  inspection_id: string
  pdf_url?: string | null
  public_url?: string | null
  sha256?: string | null
  file_size?: number | null
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'corrupted' | string
  integrity_status?: 'unverified' | 'valid' | 'missing' | 'mismatch' | string
  verified_at?: string | null
  actual_sha256?: string | null
  actual_file_size?: number | null
  generated_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type PublicInspectionReport = {
  id: string
  status: InspectionReport['status']
  integrity_status?: InspectionReport['integrity_status']
  generated_at?: string | null
  verified_at?: string | null
  sha256?: string | null
  file_size?: number | null
  pdf_url?: string | null
  inspection: {
    id: string
    type: InspectionType
    created_at?: string | null
    completed_at?: string | null
  }
  vehicle: {
    number?: string | null
    name?: string | null
  }
  company: {
    name?: string | null
  }
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
  overdueInspections: number
  openDefects: number
  criticalDefects: number
  unfinishedInspections: number
  failedPhotoUploads: number
}

export type NotificationItem = {
  vehicle_id: string
  vehicle_number: string
  vehicle_name: string
  is_overdue: boolean
  days_until: number | null
  inspection_type?: 'quick' | 'planned'
  schedule_status?: InspectionScheduleStatus
  next_due?: string | null
  last_inspection?: string | null
}

export type SettingsResponse = {
  scheduled_inspection_days?: number
  notification_days_before?: number
  timezone_offset?: number
  default_quick_inspection_interval_days?: number
  default_planned_inspection_interval_days?: number
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

export type CompanyServiceWarning = {
  type: string
  severity: 'info' | 'warning' | 'danger' | string
  title: string
  message: string
}

export type CompanyServiceAlert = {
  id: string
  type: string
  title: string
  message?: string | null
  status: string
  createdAt?: string | null
}

export type ServiceNotificationRecipient = {
  id: string
  email: string
  name: string
  role: 'owner' | 'manager' | string
  status: 'active' | 'inactive' | string
  serviceNotificationsEnabled: boolean
  serviceNotificationTypes?: string[]
  locked?: boolean
}

export type CompanyUsageResponse = {
  company: {
    id: string
    slug?: string | null
    name: string
    access_mode?: 'standard' | 'demo_readonly' | string
    status: 'active' | 'inactive' | string
    region_code?: string | null
    data_residency?: string | null
  }
    plan: {
      code?: string | null
      name?: string | null
      monthlyPriceRub?: number
      yearlyPriceRub?: number | null
      recommended?: boolean
    }
    billing?: {
      status: 'trial' | 'active' | 'payment_due' | 'suspended' | 'archived' | string
      paidUntil?: string | null
      trialUntil?: string | null
      daysLeft?: number | null
      lastPaymentDate?: string | null
      lastPaymentAmountRub?: number | null
    } | null
  subscription?: {
    id?: string | null
    planCode?: string | null
    status: 'active' | 'expiring' | 'grace' | 'expired' | 'suspended' | string
    currentPeriodStart?: string | null
    currentPeriodEnd?: string | null
    graceUntil?: string | null
    mrrRub?: number
    daysUntilEnd?: number | null
    updatedAt?: string | null
  } | null
  serviceWarnings?: CompanyServiceWarning[]
  alerts?: CompanyServiceAlert[]
  usage: {
      vehicles: CompanyResourceUsage
      users: CompanyResourceUsage
      inspectionsMonth?: CompanyResourceUsage & { period?: string | null }
      storageGb?: CompanyResourceUsage
      ocrMonth?: CompanyResourceUsage & { period?: string | null }
  }
  limits: {
    maxStorageMb?: number | null
  }
  features: {
    ocr: CompanyFeatureAccess
    accidentModule: CompanyFeatureAccess
      analytics: CompanyFeatureAccess
      pdfReport?: CompanyFeatureAccess
      export?: CompanyFeatureAccess
      apiAccess: CompanyFeatureAccess
      brandedReports?: CompanyFeatureAccess
      customBranding?: CompanyFeatureAccess
      regionalStorage?: CompanyFeatureAccess
    }
    supportLevel?: 'basic' | 'priority' | 'personal' | string
  updatedAt?: string | null
}

export type SaasAdminTotals = {
  companies: number
  activeCompanies: number
  activeCompanies7d?: number
  activeCompanies30d?: number
  inactiveCompanies: number
  tenantUsers: number
  owners: number
  managers?: number
  inspectors?: number
  plans: number
  vehicles: number
  inspections: number
  inspections24h?: number
  inspections7d?: number
  accidents: number
  defects: number
  photos: number
  inspections30d: number
  accidents30d: number
  quickInspections30d?: number
  scheduledInspections30d?: number
  completedInspections?: number
  unfinishedInspections?: number
  activeInspectors30d?: number
  openDefects: number
  activeVehicles: number
  repairVehicles: number
  companiesWithoutOwner: number
  companiesWithoutLimits: number
}

export type SaasServiceHealth = {
  companiesWithoutOwner: number
  companiesWithoutLimits: number
  companiesWithoutPlan?: number
  inactiveCompanies14d?: number
  unfinishedInspectionsOlderThan24h?: number
  defectsWithoutPhotos?: number
  accidentInspectionsWithoutRequiredData?: number
  orphanRecords?: {
    vehicles: number
    inspections: number
    defects: number
    photos: number
    users: number
  }
  items?: SaasHealthItem[]
  companiesWithoutOwnerList?: SaasHealthCompany[]
  companiesWithoutLimitsList?: SaasHealthCompany[]
}

export type SaasHealthItem = {
  key: string
  severity: 'ok' | 'medium' | 'high' | string
  title: string
  description: string
  count: number
  actionLabel?: string
  actionHref?: string
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
  pdfReportEnabled?: boolean | null
  apiAccessEnabled?: boolean | null
  updatedAt?: string | null
}

export type SaasOwner = {
  id: string
  email: string
  name: string
  role: 'owner' | string
  status: 'active' | 'inactive' | string
  company_id: string
  created_at?: string | null
  last_login_at?: string | null
  setup?: {
    status: 'not_sent' | 'pending' | 'accepted' | 'expired' | string
    issued_at?: string | null
    expires_at?: string | null
    accepted_at?: string | null
    token?: string
    setup_url?: string
    expires_in?: string
  } | null
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
  lastActivityAt?: string | null
  inspections30d?: number
  previousInspections30d?: number
  activityDropPercent?: number | null
  vehiclesLimit?: number | null
  usersLimit?: number | null
  vehiclesUsagePercent?: number | null
  usersUsagePercent?: number | null
  healthStatus?: 'ok' | 'attention' | 'inactive' | string
  riskStatus?: 'ok' | 'watch' | 'upsell' | 'blocked' | 'churn' | string
  usage?: {
    vehicles: number
    inspections: number
    accidents: number
    defects: number
    photos: number
  }
  billing?: {
    planName?: string | null
    monthlyPriceRub: number
    monthlyRevenueRub: number
  }
  subscription?: SaasSubscription | null
  ownerUsers?: SaasOwner[]
  limits?: SaasCompanyLimits | null
}

export type SaasSubscription = {
  id: string
  companyId: string
  planCode?: string | null
  status: 'active' | 'expiring' | 'grace' | 'expired' | 'suspended' | string
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  graceUntil?: string | null
  lastPaymentId?: string | null
  mrrRub: number
  autoSuspendEnabled?: boolean
  daysUntilEnd?: number | null
}

export type SaasPayment = {
  id: string
  companyId: string
  companyName?: string | null
  planCode?: string | null
  amount: number
  currency: string
  paymentDate?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  paymentMethod?: string | null
  documentNumber?: string | null
  comment?: string | null
  status: 'active' | 'cancelled' | string
  createdBy?: string | null
  createdByName?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SaasExpiringSubscription = {
  id: string
  companyId: string
  companyName: string
  companySlug?: string | null
  ownerEmail?: string | null
  ownerName?: string | null
  planCode?: string | null
  status: 'active' | 'expiring' | 'grace' | 'expired' | 'suspended' | string
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  graceUntil?: string | null
  daysUntilEnd?: number | null
  lastPaymentId?: string | null
  lastPaymentDate?: string | null
  lastPaymentAmount: number
  mrrRub: number
}

export type SaasPaymentsResponse = {
  payments: SaasPayment[]
  expiringSubscriptions: SaasExpiringSubscription[]
  summary: {
    paidThisMonthRub: number
    paymentsThisMonth: number
    averagePaymentRub: number
    expectedRenewalsRub: number
    expiringCount: number
    graceCount: number
    expiredCount: number
    suspendedCount: number
  }
  companies: SaasCompanyStats[]
  plans: SaasPlan[]
}

export type SaasAlert = {
  id: string
  companyId?: string | null
  companyName?: string | null
  recipientUserId?: string | null
  recipientRole?: string | null
  type: string
  channel: string
  title: string
  message?: string | null
  status: 'new' | 'read' | string
  sentAt?: string | null
  readAt?: string | null
  createdAt?: string | null
}

export type SaasAlertsResponse = {
  alerts: SaasAlert[]
  summary: {
    total: number
    unread: number
    expiring: number
    critical: number
  }
  expiringSubscriptions: SaasExpiringSubscription[]
  result?: {
    scannedSubscriptions: number
    updatedSubscriptions: number
    createdNotifications: number
    summary: SaasAlertsResponse['summary']
  }
}

export type SaasAuditLog = {
  id: string
  companyId?: string | null
  actorUserId?: string | null
  actorName?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  payload?: Record<string, unknown> | null
  createdAt?: string | null
}

export type SaasCompanyDetailsResponse = {
  company: SaasCompanyStats
  owners: SaasOwner[]
  limits: SaasCompanyLimits | null
  subscription: SaasSubscription | null
  payments: SaasPayment[]
  alerts: SaasAlert[]
  auditLogs: SaasAuditLog[]
  plans: SaasPlan[]
}

export type ResourcePaymentPayload = {
  companyId: string
  planCode: string
  amount: number
  currency?: string
  paymentDate: string
  periodStart: string
  periodEnd: string
  paymentMethod?: string
  documentNumber?: string
  comment?: string
}

export type ResourceCompanyLimitsPayload = {
  planCode?: string
  maxVehicles?: number | null
  maxUsers?: number | null
  maxStorageMb?: number | null
  ocrEnabled?: boolean | null
  accidentModuleEnabled?: boolean | null
  analyticsEnabled?: boolean | null
  pdfReportEnabled?: boolean | null
  apiAccessEnabled?: boolean | null
}

export type ResourcePlanPayload = {
  code?: string
  name?: string
  status?: 'active' | 'archived' | string
  maxVehicles?: number | null
  maxUsers?: number | null
  maxStorageMb?: number | null
  ocrEnabled?: boolean | null
  accidentModuleEnabled?: boolean | null
  analyticsEnabled?: boolean | null
  pdfReportEnabled?: boolean | null
  apiAccessEnabled?: boolean | null
  monthlyPriceRub?: number | null
}

export type SaasPlan = {
  code: string
  name: string
  status: 'active' | 'archived' | string
  monthlyPriceRub?: number
  limits: {
    maxVehicles?: number | null
    maxUsers?: number | null
    maxStorageMb?: number | null
  }
  features: {
    ocrEnabled?: boolean | null
    accidentModuleEnabled?: boolean | null
    analyticsEnabled?: boolean | null
    pdfReportEnabled?: boolean | null
    apiAccessEnabled?: boolean | null
  }
  createdAt?: string | null
  updatedAt?: string | null
}

export type SaasBillingSummary = {
  currency: 'RUB' | string
  monthlyRevenueRub: number
  annualRevenueRub: number
  paidCompanies: number
  freeCompanies: number
  trialCompanies?: number
  activeFreeCompanies?: number
  potentialMrr?: number
  recommendedPlanCode?: string | null
  trialToPaidConversionRate?: number | null
  paidThisMonthRub?: number
  paymentsThisMonth?: number
  averagePaymentRub?: number
  expectedRenewalsRub?: number
  expiringCount?: number
  graceCount?: number
  expiredCount?: number
  suspendedCount?: number
  averageRevenuePerActiveCompanyRub: number
}

export type SaasPlanBreakdown = {
  planCode: string
  planName: string
  monthlyPriceRub: number
  companies: number
  activeCompanies: number
  monthlyRevenueRub: number
  usage: {
    vehicles: number
    inspections: number
    accidents: number
  }
}

export type SaasActivityTrend = {
  date: string
  inspections: number
  accidents: number
}

export type SaasProductActivitySeriesItem = {
  date: string
  inspections: number
  defects: number
  accidents: number
  photos: number
}

export type SaasInspectionTypesSeriesItem = {
  date: string
  quick: number
  scheduled: number
  accident: number
}

export type SaasCompanyWorkloadItem = {
  companyId: string
  companyName: string
  vehicles: number
  inspections: number
  defects: number
  accidents: number
  photos: number
}

export type SaasProductActivity = {
  kpi: {
    inspections24h: number
    inspections7d: number
    inspections30d: number
    quickInspections30d: number
    scheduledInspections30d: number
    accidentInspections30d: number
    completedInspections: number
    unfinishedInspections: number
    completionRate: number
    averagePhotosPerInspection: number
    defectsPer100Inspections: number
    activeInspectors30d: number
    averageInspectionsPerActiveCompany30d: number
  }
  series30d: SaasProductActivitySeriesItem[]
  inspectionTypesSeries30d: SaasInspectionTypesSeriesItem[]
  companyWorkload: SaasCompanyWorkloadItem[]
}

export type SaasStorageStats = {
  totalPhotos: number
  photos30d: number
  totalStorageBytes: number
  avgOriginalSizeBytes?: number | null
  avgWebpSizeBytes?: number | null
  estimatedSavedBytes?: number | null
  uploadErrors: number
  webpErrors: number
  byCompany: Array<{
    companyId: string
    companyName: string
    photos: number
    storageBytes: number
  }>
}

export type SaasOcrStats = {
  plateAttempts: number
  plateSuccess: number
  plateSuccessRate?: number | null
  plateManualCorrections: number
  odometerAttempts: number
  odometerSuccess: number
  odometerSuccessRate?: number | null
  avgConfidence?: number | null
  errors: number
  companiesWithOcrDisabled?: number
}

export type SaasActivationStats = {
  activationRate: number
  funnel: {
    companiesCreated: number
    ownerAssigned: number
    ownerLoggedIn: number
    vehicleAdded: number
    firstInspectionCreated: number
    fiveInspectionsReached: number
    active30d: number
  }
}

export type SaasLimitUsageCompany = {
  companyId: string
  companyName: string
  planCode?: string | null
  vehiclesUsed: number
  vehiclesLimit?: number | null
  vehiclesUsagePercent?: number | null
  usersUsed: number
  usersLimit?: number | null
  usersUsagePercent?: number | null
  ocrEnabled: boolean
  accidentModuleEnabled: boolean
  analyticsEnabled: boolean
  pdfReportEnabled: boolean
  apiAccessEnabled: boolean
  riskLevel: 'ok' | 'watch' | 'upsell' | 'blocked' | string
}

export type SaasLimitUsage = {
  companiesNearVehicleLimit: number
  companiesNearUserLimit: number
  disabledModules: {
    ocr: number
    accidentModule: number
    analytics: number
    pdfReport: number
    apiAccess: number
  }
  usage: SaasLimitUsageCompany[]
}

export type SaasChurnRiskCompany = {
  companyId: string
  companyName: string
  planCode?: string | null
  lastActivityAt?: string | null
  inspections30d: number
  previousInspections30d?: number
  activityDropPercent?: number | null
  riskLevel: 'medium' | 'high' | string
  reasons: string[]
  recommendedAction: string
}

export type SaasUpsellCandidate = {
  companyId: string
  companyName: string
  currentPlanCode?: string | null
  recommendedPlanCode?: string | null
  reason: string
  potentialMrr: number
  vehiclesUsagePercent?: number | null
  usersUsagePercent?: number | null
  inspections30d: number
}

export type SaasRiskCenter = {
  churnRiskCompanies: number
  upsellCandidates: number
  churn: SaasChurnRiskCompany[]
  upsell: SaasUpsellCandidate[]
}

export type SaasAdminStats = {
  generated_at: string
  totals: SaasAdminTotals
  billing?: SaasBillingSummary
  plan_breakdown?: SaasPlanBreakdown[]
  activity_trend?: SaasActivityTrend[]
  activity?: SaasProductActivity
  storage?: SaasStorageStats
  ocr?: SaasOcrStats
  alerts?: SaasAlertsResponse['summary']
  recent_alerts?: SaasAlert[]
  recent_payments?: SaasPayment[]
  expiring_subscriptions?: SaasExpiringSubscription[]
  service_health: SaasServiceHealth
  activation?: SaasActivationStats
  health_center?: SaasServiceHealth
  limit_usage?: SaasLimitUsage
  risk_center?: SaasRiskCenter
  companies: SaasCompanyStats[]
  plans: SaasPlan[]
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
  byMonth?: Array<{ month: string; count: number }>
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
