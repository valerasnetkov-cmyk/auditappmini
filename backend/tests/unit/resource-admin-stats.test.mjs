import test from 'node:test'
import assert from 'node:assert/strict'
import { buildResourceCompanyDetails } from '../../src/services/resourceAdminStats.js'

function makeFakeDb() {
  return {
    prepare(sql) {
      return {
        all(...params) {
          if (sql.includes('FROM companies c') && sql.includes('LEFT JOIN company_limits')) {
            return [{
              id: 'company-1',
              slug: 'company-one',
              name: 'Company One',
              status: 'active',
              users: 1,
              owners: 1,
              vehicles: 2,
              inspections: 3,
              inspections_30d: 2,
              inspections_prev_30d: 1,
              accidents: 1,
              defects: 1,
              photos: 4,
              monthly_price_rub: 1000,
              plan_name: 'Pilot',
              plan_code: 'pilot',
              max_vehicles: 10,
              max_users: 5,
              ocr_enabled: 1,
              accident_module_enabled: 1,
              analytics_enabled: 0,
              api_access_enabled: 0,
              subscription_id: 'sub-1',
              subscription_status: 'active',
              subscription_plan_code: 'pilot',
              current_period_end: '2026-06-30',
              mrr_rub: 1000,
            }]
          }
          if (sql.includes('FROM users') && sql.includes("WHERE role = 'owner'")) {
            return [{
              id: 'owner-1',
              email: 'owner@example.com',
              name: 'Owner',
              role: 'owner',
              status: 'active',
              company_id: 'company-1',
            }]
          }
          if (sql.includes('FROM company_payments')) {
            assert.equal(params[0], 'company-1')
            return [{
              id: 'payment-1',
              company_id: 'company-1',
              amount: 1000,
              currency: 'RUB',
              status: 'active',
            }]
          }
          if (sql.includes('FROM company_notifications')) return []
          if (sql.includes('FROM audit_logs')) return []
          if (sql.includes('FROM photos p')) {
            assert.equal(params[0], 'company-1')
            return [{
              id: 'photo-1',
              company_id: 'company-1',
              inspection_id: 'inspection-1',
              url: '/uploads/inspections/inspection-1/photos/photo-1/main.webp',
              thumb_url: '/uploads/inspections/inspection-1/photos/photo-1/thumb.webp',
              captured_lat: 46.959,
              captured_lng: 142.738,
              vehicle_number: 'А123ВС65',
              inspection_type: 'quick',
            }]
          }
          if (sql.includes('FROM plans')) {
            return [{
              code: 'pilot',
              name: 'Pilot',
              monthly_price_rub: 1000,
              status: 'active',
            }]
          }
          return []
        },
      }
    },
  }
}

test('resource company details preserve company overview contract', () => {
  const details = buildResourceCompanyDetails(makeFakeDb(), 'company-1')

  assert.equal(details.company.id, 'company-1')
  assert.equal(details.owners[0].email, 'owner@example.com')
  assert.equal(details.limits.planCode, 'pilot')
  assert.equal(details.subscription.id, 'sub-1')
  assert.equal(details.payments[0].id, 'payment-1')
  assert.equal(details.alerts.length, 0)
  assert.equal(details.auditLogs.length, 0)
  assert.equal(details.recentPhotos[0].id, 'photo-1')
  assert.equal(details.recentPhotos[0].captured_lat, 46.959)
  assert.equal(details.plans[0].code, 'pilot')
})
