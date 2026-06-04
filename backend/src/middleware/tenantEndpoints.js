const TENANT_USER_ENDPOINT_PREFIXES = [
  '/api/vehicles',
  '/api/inspections',
  '/api/defects',
  '/api/photos',
  '/api/users',
  '/api/dashboard',
  '/api/analytics',
  '/api/notifications',
  '/api/settings',
  '/api/company',
  '/api/companies',
  '/api/regions',
  '/api/photo-requirements',
  '/api/defect-categories',
  '/api/seed',
  '/uploads',
]

export function isTenantUserEndpoint(pathname) {
  const path = String(pathname || '')
  return TENANT_USER_ENDPOINT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}
