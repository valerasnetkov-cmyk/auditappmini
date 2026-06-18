export const INSPECTION_SCHEDULE_STATUSES = [
  'inspection_actual',
  'inspection_due_soon',
  'inspection_overdue',
  'never_inspected',
]

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_QUICK_INTERVAL_DAYS = 7
const DEFAULT_PLANNED_INTERVAL_DAYS = 30
const DEFAULT_DUE_SOON_DAYS = 3

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function dateOnly(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
}

export function calculateInspectionSchedule({
  lastInspectionAt,
  intervalDays,
  dueSoonDays = DEFAULT_DUE_SOON_DAYS,
  now = new Date(),
}) {
  const normalizedInterval = positiveInteger(intervalDays, DEFAULT_PLANNED_INTERVAL_DAYS)
  const lastDate = dateOnly(lastInspectionAt)

  if (!lastDate) {
    return {
      status: 'never_inspected',
      interval_days: normalizedInterval,
      last_inspection_at: null,
      next_due: null,
      days_until: null,
    }
  }

  const today = dateOnly(now) || dateOnly(new Date())
  const nextDue = new Date(lastDate.getTime() + normalizedInterval * DAY_MS)
  const daysUntil = Math.round((nextDue.getTime() - today.getTime()) / DAY_MS)
  const threshold = positiveInteger(dueSoonDays, DEFAULT_DUE_SOON_DAYS)
  const status = daysUntil < 0
    ? 'inspection_overdue'
    : daysUntil <= threshold
      ? 'inspection_due_soon'
      : 'inspection_actual'

  return {
    status,
    interval_days: normalizedInterval,
    last_inspection_at: lastInspectionAt,
    next_due: nextDue.toISOString().slice(0, 10),
    days_until: daysUntil,
  }
}

function overallScheduleStatus(quick, planned) {
  const priority = {
    inspection_overdue: 4,
    never_inspected: 3,
    inspection_due_soon: 2,
    inspection_actual: 1,
  }
  return priority[quick.status] >= priority[planned.status] ? quick.status : planned.status
}

export function buildVehicleInspectionSchedule(vehicle, {
  companyQuickIntervalDays = DEFAULT_QUICK_INTERVAL_DAYS,
  companyPlannedIntervalDays = DEFAULT_PLANNED_INTERVAL_DAYS,
  dueSoonDays = DEFAULT_DUE_SOON_DAYS,
  now = new Date(),
} = {}) {
  const quickInterval = positiveInteger(
    vehicle.quick_inspection_interval_days,
    positiveInteger(companyQuickIntervalDays, DEFAULT_QUICK_INTERVAL_DAYS),
  )
  const plannedInterval = positiveInteger(
    vehicle.planned_inspection_interval_days,
    positiveInteger(companyPlannedIntervalDays, DEFAULT_PLANNED_INTERVAL_DAYS),
  )
  const quick = calculateInspectionSchedule({
    lastInspectionAt: vehicle.last_quick_inspection_at,
    intervalDays: quickInterval,
    dueSoonDays,
    now,
  })
  const planned = calculateInspectionSchedule({
    lastInspectionAt: vehicle.last_planned_inspection_at || vehicle.last_scheduled_inspection,
    intervalDays: plannedInterval,
    dueSoonDays,
    now,
  })

  return {
    status: overallScheduleStatus(quick, planned),
    quick,
    planned,
  }
}

export function createInspectionScheduleService({ db, readSettings = () => ({}) }) {
  function getCompanySettings(companyId) {
    const company = db.prepare(`
      SELECT default_quick_inspection_interval_days, default_planned_inspection_interval_days
      FROM companies
      WHERE id = ?
    `).get(companyId) || {}
    const settings = readSettings()

    return {
      companyQuickIntervalDays: positiveInteger(
        company.default_quick_inspection_interval_days,
        DEFAULT_QUICK_INTERVAL_DAYS,
      ),
      companyPlannedIntervalDays: positiveInteger(
        company.default_planned_inspection_interval_days,
        positiveInteger(settings.scheduled_inspection_days, DEFAULT_PLANNED_INTERVAL_DAYS),
      ),
      dueSoonDays: positiveInteger(settings.notification_days_before, DEFAULT_DUE_SOON_DAYS),
    }
  }

  function enrichVehicle(vehicle, companyId, now = new Date()) {
    if (!vehicle) return vehicle
    return {
      ...vehicle,
      inspection_schedule: buildVehicleInspectionSchedule(vehicle, {
        ...getCompanySettings(companyId),
        now,
      }),
    }
  }

  return {
    getCompanySettings,
    enrichVehicle,
    enrichVehicles(vehicles, companyId, now = new Date()) {
      const settings = getCompanySettings(companyId)
      return vehicles.map((vehicle) => ({
        ...vehicle,
        inspection_schedule: buildVehicleInspectionSchedule(vehicle, { ...settings, now }),
      }))
    },
  }
}
