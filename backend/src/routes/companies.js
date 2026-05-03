import { v4 as uuidv4 } from 'uuid'

export default function registerCompanyRoutes({ app, db, authenticate }) {
  // GET /api/companies - list all companies
  app.get('/api/companies', authenticate, (req, res) => {
    const companies = db.prepare('SELECT * FROM companies ORDER BY name').all()
    res.json(companies)
  })

  // GET /api/companies/:id - get company by ID
  app.get('/api/companies/:id', authenticate, (req, res) => {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
    if (!company) {
      return res.status(404).json({ error: 'Company not found' })
    }
    res.json(company)
  })

  // POST /api/companies - create company
  app.post('/api/companies', authenticate, (req, res) => {
    const { slug, name, region_code, data_residency, api_cluster_key, storage_cluster_key, ocr_cluster_key } = req.body

    if (!slug || !name) {
      return res.status(400).json({ error: 'slug and name are required' })
    }

    const existing = db.prepare('SELECT id FROM companies WHERE slug = ?').get(slug)
    if (existing) {
      return res.status(400).json({ error: 'Company with this slug already exists' })
    }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO companies (id, slug, name, region_code, data_residency, api_cluster_key, storage_cluster_key, ocr_cluster_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, slug, name, region_code || null, data_residency || null, api_cluster_key || null, storage_cluster_key || null, ocr_cluster_key || null)

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id)
    res.status(201).json(company)
  })

  // PUT /api/companies/:id - update company
  app.put('/api/companies/:id', authenticate, (req, res) => {
    const { name, region_code, data_residency, api_cluster_key, storage_cluster_key, ocr_cluster_key, status } = req.body

    const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Company not found' })
    }

    db.prepare(`
      UPDATE companies SET 
        name = COALESCE(?, name),
        region_code = COALESCE(?, region_code),
        data_residency = COALESCE(?, data_residency),
        api_cluster_key = COALESCE(?, api_cluster_key),
        storage_cluster_key = COALESCE(?, storage_cluster_key),
        ocr_cluster_key = COALESCE(?, ocr_cluster_key),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(name, region_code, data_residency, api_cluster_key, storage_cluster_key, ocr_cluster_key, status, req.params.id)

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
    res.json(company)
  })

  // DELETE /api/companies/:id - delete company
  app.delete('/api/companies/:id', authenticate, (req, res) => {
    const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Company not found' })
    }

    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id)
    res.status(204).send()
  })
}