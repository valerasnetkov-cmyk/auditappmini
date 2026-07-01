import crypto from 'node:crypto'

const DEFAULT_TELEGRAM_API_BASE_URL = 'https://api.telegram.org'
const DEFAULT_DEDUPE_WINDOW_MS = 15 * 60 * 1000
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info'])
const SENSITIVE_PATTERN = /token|secret|password|cookie|authorization|jwt|setup|payload_json|photo|pdf|file/i
const dedupeMap = new Map()

function readBoolean(value) {
  return String(value || '').toLowerCase() === 'true'
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeSeverity(value) {
  return SEVERITIES.has(value) ? value : 'info'
}

function sanitizeText(value, maxLength = 500) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/https?:\/\/\S*(token|jwt|setup|secret|password)\S*/gi, '[redacted-url]')
    .replace(/(token|secret|password|cookie|authorization|jwt)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .trim()
    .slice(0, maxLength)
}

function sanitizeUrl(url) {
  if (!url) return ''
  const value = String(url).trim()
  if (!value.startsWith('/saas-admin/')) return ''
  if (SENSITIVE_PATTERN.test(value)) return ''
  return value.slice(0, 240)
}

function resolveWebUrl(relativeUrl, env) {
  const url = sanitizeUrl(relativeUrl)
  if (!url) return ''
  const base = env.WEB_APP_URL || env.FRONTEND_URL || ''
  if (!base) return url
  try {
    return new URL(url, base).toString()
  } catch {
    return url
  }
}

function tokenFingerprint(token) {
  if (!token) return null
  return crypto.createHash('sha256').update(token).digest('hex').slice(-4)
}

export function getTelegramBotConfig(env = process.env) {
  const explicitEnabled = env.TELEGRAM_BOT_ENABLED
  const enabled = explicitEnabled === undefined || explicitEnabled === ''
    ? readBoolean(env.TELEGRAM_ALERTS_ENABLED)
    : readBoolean(explicitEnabled)
  const token = env.TELEGRAM_BOT_TOKEN || ''
  const adminChatId = env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_ALERT_CHAT_ID || ''
  const resourceAlertsChatId = env.TELEGRAM_RESOURCE_ALERTS_CHAT_ID || adminChatId
  const dedupeWindowMs = readPositiveInteger(env.TELEGRAM_BOT_DEDUPE_WINDOW_MS, DEFAULT_DEDUPE_WINDOW_MS)
  const apiBaseUrl = env.TELEGRAM_BOT_API_BASE_URL || DEFAULT_TELEGRAM_API_BASE_URL

  return {
    enabled,
    configured: Boolean(token && (adminChatId || resourceAlertsChatId)),
    token,
    adminChatId,
    resourceAlertsChatId,
    dedupeWindowMs,
    apiBaseUrl,
    status: {
      enabled,
      configured: Boolean(token && (adminChatId || resourceAlertsChatId)),
      adminChatConfigured: Boolean(adminChatId),
      resourceAlertsChatConfigured: Boolean(resourceAlertsChatId),
      tokenFingerprint: tokenFingerprint(token),
    },
  }
}

export function getTelegramBotStatus(env = process.env) {
  return getTelegramBotConfig(env).status
}

function pickChatId(config, type) {
  if (/subscription|report|defect|health|readiness/i.test(type || '')) {
    return config.resourceAlertsChatId || config.adminChatId
  }
  return config.adminChatId || config.resourceAlertsChatId
}

function buildDedupeKey({ type, entityKey, chatId }) {
  return [type || 'event', entityKey || 'global', chatId || 'none'].join(':')
}

function isDuplicate(config, event, chatId, now = Date.now()) {
  const key = buildDedupeKey({ ...event, chatId })
  const previous = dedupeMap.get(key)
  if (previous && now - previous < config.dedupeWindowMs) return true
  dedupeMap.set(key, now)
  return false
}

export function clearTelegramDedupe() {
  dedupeMap.clear()
}

function formatTelegramAdminMessage(event, url) {
  const lines = [
    `[AuditAvto] ${sanitizeText(event.title, 140)}`,
    '',
    sanitizeText(event.message, 700),
  ]
  if (event.severity && event.severity !== 'info') lines.push(`Важность: ${event.severity}`)
  if (url) lines.push(`Открыть: ${url}`)
  return lines.filter((line) => line !== '').join('\n')
}

export async function sendTelegramAdminAlert(input, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now(),
} = {}) {
  const config = getTelegramBotConfig(env)
  const event = {
    type: sanitizeText(input?.type || 'service_event', 80),
    title: sanitizeText(input?.title || 'Сервисное уведомление', 140),
    message: sanitizeText(input?.message || '', 700),
    severity: normalizeSeverity(input?.severity || 'info'),
    entityKey: sanitizeText(input?.entityKey || '', 160),
  }
  const chatId = pickChatId(config, event.type)
  const url = resolveWebUrl(input?.url, env)

  if (!config.enabled) {
    return { ok: true, delivered: false, skipped: true, reason: 'disabled', status: config.status }
  }

  if (!config.token || !chatId) {
    console.warn('[telegram] Telegram bot enabled but token or chat id is missing')
    return { ok: false, delivered: false, skipped: true, reason: 'not_configured', status: config.status }
  }

  if (isDuplicate(config, event, chatId, now)) {
    return { ok: true, delivered: false, skipped: true, reason: 'duplicate', status: config.status }
  }

  const response = await fetchImpl(`${config.apiBaseUrl}/bot${config.token}/sendMessage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auditavto-event-type': event.type,
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatTelegramAdminMessage(event, url),
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    return {
      ok: false,
      delivered: false,
      statusCode: response.status,
      error: await response.text().catch(() => 'Telegram API request failed'),
      status: config.status,
    }
  }

  return { ok: true, delivered: true, status: config.status }
}
