import fs from 'node:fs'
import { createInspectionReportService } from '../services/inspectionReports.js'

export default function registerInspectionReportRoutes({
  app,
  db,
  authenticate,
  inspectionReadiness,
  PHOTO_SELECT_COLUMNS,
  ensureCompanyFeatureEnabled,
}) {
  const reports = createInspectionReportService({ db, PHOTO_SELECT_COLUMNS })

  function getCompletedInspection(req, res) {
    const companyId = req.user.company_id || 'default'
    const inspection = db.prepare(`
      SELECT id, completed
      FROM inspections
      WHERE id = ? AND company_id = ?
    `).get(req.params.id, companyId)
    if (!inspection) {
      res.status(404).json({ error: 'Inspection not found' })
      return null
    }
    const readiness = inspectionReadiness.getReadiness(req.params.id, companyId)
    if (!inspection.completed || (req.user.access_mode !== 'demo_readonly' && !readiness?.ready)) {
      res.status(400).json({
        error: 'INSPECTION_REPORT_BLOCKED',
        message: 'Отчёт доступен только для полного завершённого осмотра',
        missing: readiness?.missing || [],
      })
      return null
    }
    return { inspection, companyId }
  }

  app.post('/api/inspections/:id/report', authenticate, async (req, res) => {
    if (!ensureCompanyFeatureEnabled(req, res, 'pdf_report_enabled', 'PDF-отчёты недоступны на текущем тарифе.')) return
    const context = getCompletedInspection(req, res)
    if (!context) return
    try {
      const report = await reports.generateReport(req.params.id, context.companyId)
      res.status(201).json(report)
    } catch (error) {
      reports.markFailed(req.params.id, context.companyId)
      console.error('[reports] generation failed:', error)
      res.status(500).json({ error: 'REPORT_GENERATION_FAILED', message: 'Не удалось сформировать PDF-отчёт' })
    }
  })

  app.get('/api/inspections/:id/report', authenticate, async (req, res) => {
    if (!ensureCompanyFeatureEnabled(req, res, 'pdf_report_enabled', 'PDF-отчёты недоступны на текущем тарифе.')) return
    const context = getCompletedInspection(req, res)
    if (!context) return
    try {
      const report = await reports.verifyReport(req.params.id, context.companyId)
      if (!report) return res.status(404).json({ error: 'REPORT_NOT_GENERATED' })
      res.json(report)
    } catch (error) {
      console.error('[reports] integrity verification failed:', error)
      res.status(500).json({ error: 'REPORT_VERIFICATION_FAILED', message: 'Не удалось проверить PDF-отчёт' })
    }
  })

  app.get('/api/inspections/:id/report.pdf', authenticate, async (req, res) => {
    if (!ensureCompanyFeatureEnabled(req, res, 'pdf_report_enabled', 'PDF-отчёты недоступны на текущем тарифе.')) return
    const context = getCompletedInspection(req, res)
    if (!context) return
    try {
      const report = await reports.verifyReport(req.params.id, context.companyId)
      const reportPath = reports.getReportPath(req.params.id, context.companyId)
      if (!report) {
        return res.status(404).json({ error: 'REPORT_NOT_GENERATED' })
      }
      if (report.integrity_status !== 'valid' || report.status !== 'ready' || !fs.existsSync(reportPath)) {
        return res.status(409).json({
          error: 'REPORT_INTEGRITY_FAILED',
          message: 'Целостность PDF-отчёта не подтверждена. Сформируйте отчёт заново',
        })
      }
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="inspection-${req.params.id}.pdf"`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.sendFile(reportPath)
    } catch (error) {
      console.error('[reports] download verification failed:', error)
      res.status(500).json({ error: 'REPORT_VERIFICATION_FAILED', message: 'Не удалось проверить PDF-отчёт' })
    }
  })

  app.get('/api/reports/public/:token', async (req, res, next) => {
    if (String(req.params.token || '').endsWith('.pdf')) return next()
    const report = reports.getPublicReport(req.params.token)
    if (!report) return res.status(404).json({ error: 'REPORT_NOT_FOUND' })
    if (report.integrity_status !== 'valid' || report.status !== 'ready') {
      return res.status(409).json({ error: 'REPORT_INTEGRITY_FAILED' })
    }

    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json({
      id: report.id,
      status: report.status,
      integrity_status: report.integrity_status,
      generated_at: report.generated_at,
      verified_at: report.verified_at,
      sha256: report.sha256,
      file_size: report.file_size,
      inspection: {
        id: report.inspection_id,
        type: report.inspection_type,
        created_at: report.inspection_created_at,
        completed_at: report.inspection_completed_at,
      },
      vehicle: {
        number: report.vehicle_number,
        name: report.vehicle_name,
      },
      company: {
        name: report.company_name,
      },
      pdf_url: `/api/reports/public/${req.params.token}.pdf`,
    })
  })

  app.get('/api/reports/public/:token.pdf', async (req, res) => {
    const report = reports.getPublicReport(req.params.token)
    const reportPath = reports.getPublicReportPath(report)
    if (!report || !reportPath) return res.status(404).json({ error: 'REPORT_NOT_FOUND' })
    if (report.integrity_status !== 'valid' || report.status !== 'ready' || !fs.existsSync(reportPath)) {
      return res.status(409).json({ error: 'REPORT_INTEGRITY_FAILED' })
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="inspection-${report.inspection_id}.pdf"`)
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.sendFile(reportPath)
  })
}
