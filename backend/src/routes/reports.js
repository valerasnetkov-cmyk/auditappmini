import fs from 'node:fs'
import { createInspectionReportService } from '../services/inspectionReports.js'
import { sendTelegramAdminAlert } from '../services/telegramBot.js'

export default function registerInspectionReportRoutes({
  app,
  db,
  authenticate,
  inspectionReadiness,
  PHOTO_SELECT_COLUMNS,
  ensureCompanyFeatureEnabled,
}) {
  const reports = createInspectionReportService({ db, PHOTO_SELECT_COLUMNS })

  function parseOptionalBoolean(value, fieldName, res) {
    if (typeof value === 'boolean') return value
    if (value === 1 || value === 'true') return true
    if (value === 0 || value === 'false') return false

    res.status(400).json({
      error: 'INVALID_BOOLEAN_FIELD',
      message: `${fieldName} должен быть boolean-значением`,
    })
    return null
  }

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

  function sendReportFailureAlert(kind, inspectionId, companyId) {
    void sendTelegramAdminAlert({
      type: `report_${kind}_failed`,
      title: 'Ошибка PDF-отчёта',
      message: `Компания ${companyId}: ошибка ${kind} для осмотра ${inspectionId}.`,
      url: '/saas-admin/alerts',
      severity: 'high',
      entityKey: `${companyId}:${inspectionId}:${kind}`,
    }).catch((error) => console.warn('[telegram] report alert skipped:', error.message))
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
      sendReportFailureAlert('generation', req.params.id, context.companyId)
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
      sendReportFailureAlert('verification', req.params.id, context.companyId)
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
      sendReportFailureAlert('download', req.params.id, context.companyId)
      res.status(500).json({ error: 'REPORT_VERIFICATION_FAILED', message: 'Не удалось проверить PDF-отчёт' })
    }
  })

  app.patch('/api/inspections/:id/report/public-access', authenticate, async (req, res) => {
    if (!ensureCompanyFeatureEnabled(req, res, 'pdf_report_enabled', 'PDF-отчёты недоступны на текущем тарифе.')) return
    const context = getCompletedInspection(req, res)
    if (!context) return

    const body = req.body || {}
    const patch = {}

    if (Object.prototype.hasOwnProperty.call(body, 'public_pdf_enabled')) {
      const parsed = parseOptionalBoolean(body.public_pdf_enabled, 'public_pdf_enabled', res)
      if (parsed === null) return
      patch.publicPdfEnabled = parsed
    }

    if (Object.prototype.hasOwnProperty.call(body, 'public_token_expires_at')) {
      if (body.public_token_expires_at === null || body.public_token_expires_at === '') {
        patch.publicTokenExpiresAt = null
      } else {
        const expiresAt = new Date(body.public_token_expires_at)
        if (Number.isNaN(expiresAt.getTime())) {
          return res.status(400).json({
            error: 'INVALID_PUBLIC_TOKEN_EXPIRY',
            message: 'Срок действия публичной ссылки должен быть ISO-датой или null',
          })
        }
        patch.publicTokenExpiresAt = expiresAt.toISOString()
      }
    }

    const report = reports.setPublicReportAccess(req.params.id, context.companyId, patch)
    if (!report) return res.status(404).json({ error: 'REPORT_NOT_GENERATED' })
    res.json(report)
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
      public_pdf_enabled: Boolean(Number(report.public_pdf_enabled || 0)),
      public_token_expires_at: report.public_token_expires_at,
      pdf_url: Number(report.public_pdf_enabled || 0) === 1
        ? `/api/reports/public/${req.params.token}.pdf`
        : null,
    })
  })

  app.get('/api/reports/public/:token.pdf', async (req, res) => {
    const report = reports.getPublicReport(req.params.token)
    const reportPath = reports.getPublicReportPath(report)
    if (!report || !reportPath) return res.status(404).json({ error: 'REPORT_NOT_FOUND' })
    if (Number(report.public_pdf_enabled || 0) !== 1) {
      return res.status(403).json({
        error: 'PUBLIC_REPORT_PDF_DISABLED',
        message: 'PDF доступен только авторизованным пользователям или по разрешённой публичной ссылке.',
      })
    }
    if (report.integrity_status !== 'valid' || report.status !== 'ready' || !fs.existsSync(reportPath)) {
      return res.status(409).json({ error: 'REPORT_INTEGRITY_FAILED' })
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="inspection-${report.inspection_id}.pdf"`)
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.sendFile(reportPath)
  })
}
