import {
  normalizeRegionName,
  getRegionByName,
  getRegionById,
  countVehiclesByRegion,
  listRegions,
  createRegionRecord,
  deleteRegionRecord,
  getRegionForMutation,
} from '../services/regions.js'

export default function registerRegionRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
}) {
  app.get('/api/regions', authenticate, (req, res) => {
    const includeEmpty = req.query.includeEmpty === '1' || req.query.includeEmpty === 'true'
    const companyId = req.user.company_id || 'default'
    const regions = listRegions(db, companyId)
    const normalizedRegions = regions.map((region) => ({
      ...region,
      vehicle_count: Number(region.vehicle_count || 0),
      vehicleCount: Number(region.vehicle_count || 0),
    }))

    res.json(includeEmpty ? normalizedRegions : normalizedRegions.filter((region) => region.vehicle_count > 0))
  })

  app.post('/api/regions', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const regionName = normalizeRegionName(req.body?.name)
    if (!regionName) {
      return sendError(res, 400, API_MESSAGES.regionNameRequired)
    }

    if (getRegionByName(db, regionName)) {
      return sendError(res, 400, API_MESSAGES.regionAlreadyExists)
    }

    createRegionRecord(db, regionName)
    const region = getRegionByName(db, regionName)
    res.status(201).json({ ...region, vehicle_count: 0, vehicleCount: 0 })
  })

  app.put('/api/regions/:id', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'

    const region = getRegionForMutation(db, req.params.id, req.body?.currentName, companyId)
    if (!region) {
      return sendError(res, 404, API_MESSAGES.regionNotFound)
    }

    const newName = normalizeRegionName(req.body?.name)
    if (!newName) {
      return sendError(res, 400, API_MESSAGES.regionNameRequired)
    }

    const existing = getRegionByName(db, newName)
    if (existing && existing.id !== region.id) {
      db.prepare('UPDATE vehicles SET region = ? WHERE region = ? AND company_id = ?').run(existing.name, region.name, companyId)
      if (countVehiclesByRegion(db, region.name) === 0) {
        deleteRegionRecord(db, region.id)
      }

      const vehicleCount = countVehiclesByRegion(db, existing.name, companyId)
      return res.json({
        id: existing.id,
        name: existing.name,
        vehicle_count: vehicleCount,
        vehicleCount,
        merged_from: region.name,
        merged_into: existing.name,
      })
    }

    db.prepare('UPDATE vehicles SET region = ? WHERE region = ? AND company_id = ?').run(newName, region.name, companyId)
    if (countVehiclesByRegion(db, region.name) === 0) {
      db.prepare('UPDATE regions SET name = ? WHERE id = ?').run(newName, region.id)
    } else if (!getRegionByName(db, newName)) {
      createRegionRecord(db, newName)
    }

    const updatedRegion = getRegionByName(db, newName)
    const vehicleCount = countVehiclesByRegion(db, newName, companyId)
    res.json({ id: updatedRegion?.id || region.id, name: newName, vehicle_count: vehicleCount, vehicleCount })
  })

  app.delete('/api/regions/:id', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'

    const region = getRegionById(db, req.params.id)
    if (!region) {
      return sendError(res, 404, API_MESSAGES.regionNotFound)
    }

    db.prepare('UPDATE vehicles SET region = NULL WHERE region = ? AND company_id = ?').run(region.name, companyId)
    if (countVehiclesByRegion(db, region.name) === 0) {
      deleteRegionRecord(db, req.params.id)
    }
    res.status(204).send()
  })
}
