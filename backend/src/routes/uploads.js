import fs from 'fs'
import {
  buildUploadUrl,
  getMimeType,
  resolveUploadPath,
} from '../services/photoUpload.js'

export default function registerProtectedUploadRoutes({
  app,
  authenticate,
  getDb,
  sendError,
}) {
  app.get('/uploads/*', authenticate, (req, res) => {
    const resolved = resolveUploadPath(req.params[0])
    if (!resolved) {
      return sendError(res, 400, 'Invalid upload path')
    }

    const url = buildUploadUrl(resolved.relativePath)
    const companyId = req.user.company_id || 'default'
    const photo = getDb().prepare(`
      SELECT id
      FROM photos
      WHERE company_id = ?
        AND (url = ? OR original_url = ? OR webp_url = ? OR thumb_url = ?)
    `).get(companyId, url, url, url, url)

    if (!photo) {
      return sendError(res, 404, 'Photo not found')
    }

    const filePath = resolved.filePath
    if (!fs.existsSync(filePath)) {
      return sendError(res, 404, 'Photo file not found')
    }

    res.setHeader('Content-Type', getMimeType(filePath))
    res.setHeader('Cache-Control', 'private, max-age=31536000')
    res.sendFile(filePath)
  })
}
