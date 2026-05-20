const COMPANY_MUTATION_DISABLED_MESSAGE = 'Company lifecycle is not available in the user panel'

export default function registerCompanyRoutes({ app, db, authenticate, isAdmin }) {
  // GET /api/companies - admins can read all companies, tenant users only their own.
  app.get('/api/companies', authenticate, (req, res) => {
    const companies = isAdmin(req)
      ? db.prepare('SELECT * FROM companies ORDER BY name').all()
      : db.prepare('SELECT * FROM companies WHERE id = ? ORDER BY name').all(req.user.company_id || 'default')

    res.json(companies)
  })

  // GET /api/companies/:id - admins can read any company; tenant users can read only their own.
  app.get('/api/companies/:id', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    if (!isAdmin(req) && req.params.id !== companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
    if (!company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    res.json(company)
  })

  // Company creation, updates and deletion are deliberately kept out of the user panel API.
  app.post('/api/companies', authenticate, (_req, res) => {
    res.status(403).json({ error: COMPANY_MUTATION_DISABLED_MESSAGE })
  })

  app.put('/api/companies/:id', authenticate, (_req, res) => {
    res.status(403).json({ error: COMPANY_MUTATION_DISABLED_MESSAGE })
  })

  app.delete('/api/companies/:id', authenticate, (_req, res) => {
    res.status(403).json({ error: COMPANY_MUTATION_DISABLED_MESSAGE })
  })
}
