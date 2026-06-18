import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVehicleInspectionSchedule,
  calculateInspectionSchedule,
} from '../../src/services/inspectionSchedule.js'

const now = new Date('2026-06-12T12:00:00.000Z')

test('inspection schedule marks a missing inspection as never inspected', () => {
  assert.deepEqual(calculateInspectionSchedule({
    lastInspectionAt: null,
    intervalDays: 7,
    now,
  }), {
    status: 'never_inspected',
    interval_days: 7,
    last_inspection_at: null,
    next_due: null,
    days_until: null,
  })
})

test('inspection schedule distinguishes actual, due soon and overdue dates', () => {
  assert.equal(calculateInspectionSchedule({
    lastInspectionAt: '2026-06-10T10:00:00.000Z',
    intervalDays: 7,
    dueSoonDays: 3,
    now,
  }).status, 'inspection_actual')

  assert.equal(calculateInspectionSchedule({
    lastInspectionAt: '2026-06-08T10:00:00.000Z',
    intervalDays: 7,
    dueSoonDays: 3,
    now,
  }).status, 'inspection_due_soon')

  const overdue = calculateInspectionSchedule({
    lastInspectionAt: '2026-06-01T10:00:00.000Z',
    intervalDays: 7,
    dueSoonDays: 3,
    now,
  })
  assert.equal(overdue.status, 'inspection_overdue')
  assert.equal(overdue.days_until, -4)
  assert.equal(overdue.next_due, '2026-06-08')
})

test('vehicle schedule uses overrides and exposes the highest risk', () => {
  const schedule = buildVehicleInspectionSchedule({
    quick_inspection_interval_days: 2,
    planned_inspection_interval_days: null,
    last_quick_inspection_at: '2026-06-08T00:00:00.000Z',
    last_planned_inspection_at: '2026-06-10T00:00:00.000Z',
  }, {
    companyQuickIntervalDays: 7,
    companyPlannedIntervalDays: 30,
    dueSoonDays: 3,
    now,
  })

  assert.equal(schedule.quick.interval_days, 2)
  assert.equal(schedule.planned.interval_days, 30)
  assert.equal(schedule.quick.status, 'inspection_overdue')
  assert.equal(schedule.planned.status, 'inspection_actual')
  assert.equal(schedule.status, 'inspection_overdue')
})
