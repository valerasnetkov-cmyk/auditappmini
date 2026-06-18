import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProductActivity,
  buildHealthItems,
  mapActivationFunnel,
  mapStorageStats,
  mapTotals,
} from '../../src/services/resourceDashboard.js'

test('dashboard totals map missing aggregate values to zero', () => {
  const result = mapTotals({
    companies: 2,
    activeCompanies: null,
    inspections30d: '7',
    photos: undefined,
  })

  assert.equal(result.companies, 2)
  assert.equal(result.activeCompanies, 0)
  assert.equal(result.inspections30d, 7)
  assert.equal(result.photos, 0)
  assert.equal(result.openDefects, 0)
})

test('activation funnel calculates rate from active companies', () => {
  const result = mapActivationFunnel({
    companiesCreated: 8,
    ownerAssigned: 7,
    ownerLoggedIn: 5,
    vehicleAdded: 4,
    firstInspectionCreated: 3,
    fiveInspectionsReached: 2,
    active30d: 3,
  })

  assert.equal(result.activationRate, 38)
  assert.deepEqual(result.funnel, {
    companiesCreated: 8,
    ownerAssigned: 7,
    ownerLoggedIn: 5,
    vehicleAdded: 4,
    firstInspectionCreated: 3,
    fiveInspectionsReached: 2,
    active30d: 3,
  })
})

test('storage stats normalize byte counters and preserve company breakdown', () => {
  const result = mapStorageStats({
    totalPhotos: '3',
    photos30d: 2,
    totalStorageBytes: 1536,
    avgOriginalSizeBytes: 100.6,
    avgWebpSizeBytes: null,
    estimatedSavedBytes: 512,
  }, [{
    companyId: 'c1',
    companyName: 'Company',
    photos: 3,
    storageBytes: 1536,
  }])

  assert.equal(result.totalPhotos, 3)
  assert.equal(result.avgOriginalSizeBytes, 101)
  assert.equal(result.avgWebpSizeBytes, null)
  assert.equal(result.uploadErrors, 0)
  assert.equal(result.webpErrors, 0)
  assert.deepEqual(result.byCompany, [{
    companyId: 'c1',
    companyName: 'Company',
    photos: 3,
    storageBytes: 1536,
  }])
})

test('health items expose severity and data quality counts', () => {
  const items = buildHealthItems({
    serviceHealth: {
      companiesWithoutOwner: 1,
      companiesWithoutLimits: 0,
    },
    inactiveCompanies14d: 2,
    unfinishedInspectionsOlderThan24h: 3,
    defectsWithoutPhotos: 4,
    accidentInspectionsWithoutRequiredData: 5,
  })

  assert.equal(items.find((item) => item.key === 'companies_without_owner')?.severity, 'high')
  assert.equal(items.find((item) => item.key === 'companies_without_limits')?.severity, 'ok')
  assert.equal(items.find((item) => item.key === 'inactive_14d')?.count, 2)
  assert.equal(items.find((item) => item.key === 'data_quality')?.count, 12)
  assert.equal(items.find((item) => item.key === 'data_quality')?.severity, 'medium')
})

test('product activity builds KPI, series and workload from aggregate rows', () => {
  const result = buildProductActivity({
    dates: ['2026-06-17', '2026-06-18'],
    totals: {
      inspections: 10,
      completedInspections: 7,
      unfinishedInspections: 3,
      inspections24h: 2,
      inspections7d: 5,
      inspections30d: 10,
      quickInspections30d: 4,
      scheduledInspections30d: 3,
      accidents30d: 3,
      photos: 25,
      defects: 2,
      activeInspectors30d: 4,
      activeCompanies30d: 2,
    },
    companies: [
      { id: 'low', name: 'Low', usage: { inspections: 1, photos: 1 } },
      { id: 'high', name: 'High', usage: { vehicles: 2, inspections: 5, defects: 1, accidents: 1, photos: 6 } },
    ],
    inspectionRows: [{ date: '2026-06-18', count: 2 }],
    defectRows: [{ date: '2026-06-18', count: 1 }],
    photoRows: [{ date: '2026-06-18', count: 3 }],
    accidentRows: [{ date: '2026-06-18', count: 1 }],
    typeRows: [{ date: '2026-06-18', quick: 1, scheduled: 0, accident: 1 }],
  })

  assert.equal(result.kpi.completionRate, 70)
  assert.equal(result.kpi.averagePhotosPerInspection, 2.5)
  assert.equal(result.kpi.defectsPer100Inspections, 20)
  assert.equal(result.kpi.averageInspectionsPerActiveCompany30d, 5)
  assert.deepEqual(result.series30d[0], {
    date: '2026-06-17',
    inspections: 0,
    defects: 0,
    accidents: 0,
    photos: 0,
  })
  assert.equal(result.series30d[1].inspections, 2)
  assert.equal(result.inspectionTypesSeries30d[1].quick, 1)
  assert.equal(result.companyWorkload[0].companyId, 'high')
})
