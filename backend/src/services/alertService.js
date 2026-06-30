const TELEGRAM_API_BASE_URL = 'https://api.telegram.org'

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info'])

function normalizeSeverity(value) {
  return SEVERITIES.has(value) ? value : 'info'
}

function maskSensitiveContext(value) {
  if (!value || typeof value !== 'object') return value ?? null

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/token|secret|password|cookie|authorization|jwt/i.test(key)) {
      return [key, '[redacted]']
    }

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return [key, maskSensitiveContext(entry)]
    }

    return [key, entry]
  }))
}

export function buildAlertEvent({ severity = 'info', source = 'backend', message, context = {}, timestamp = new Date().toISOString() } = {}) {
  if (!message || typeof message !== 'string') {
    throw new Error('Alert message is required')
  }

  return {
    severity: normalizeSeverity(severity),
    source: String(source || 'backend'),
    message: message.trim(),
    context: maskSensitiveContext(context),
    timestamp,
  }
}

export function getAlertConfig(env = process.env) {
  const telegramEnabled = String(env.TELEGRAM_ALERTS_ENABLED || '').toLowerCase() === 'true'
  const sentryBackendConfigured = Boolean(env.SENTRY_DSN || env.BACKEND_SENTRY_DSN)

  return {
    telegram: {
      enabled: telegramEnabled,
      configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ALERT_CHAT_ID),
      botToken: env.TELEGRAM_BOT_TOKEN || '',
      chatId: env.TELEGRAM_ALERT_CHAT_ID || '',
      dryRun: String(env.TELEGRAM_ALERTS_DRY_RUN || '').toLowerCase() === 'true' || !telegramEnabled,
    },
    sentry: {
      backendConfigured: sentryBackendConfigured,
      dsnConfigured: sentryBackendConfigured,
      environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || 'development',
    },
  }
}

function formatTelegramMessage(event) {
  const context = event.context && Object.keys(event.context).length
    ? `\ncontext=${JSON.stringify(event.context)}`
    : ''

  return [
    `[Auditmini ${event.severity}] ${event.source}`,
    event.message,
    event.timestamp,
    context,
  ].filter(Boolean).join('\n')
}

export async function sendAlert(input, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const event = buildAlertEvent(input)
  const config = getAlertConfig(env)

  if (config.telegram.dryRun || !config.telegram.enabled) {
    return {
      ok: true,
      delivered: false,
      dryRun: true,
      channel: 'telegram',
      event,
      config: {
        telegramEnabled: config.telegram.enabled,
        telegramConfigured: config.telegram.configured,
        sentryBackendConfigured: config.sentry.backendConfigured,
      },
    }
  }

  if (!config.telegram.configured) {
    return {
      ok: false,
      delivered: false,
      dryRun: false,
      channel: 'telegram',
      error: 'Telegram alerts are enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_ALERT_CHAT_ID is missing',
      event,
    }
  }

  const response = await fetchImpl(`${TELEGRAM_API_BASE_URL}/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegram.chatId,
      text: formatTelegramMessage(event),
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    return {
      ok: false,
      delivered: false,
      dryRun: false,
      channel: 'telegram',
      status: response.status,
      error: await response.text().catch(() => 'Telegram API request failed'),
      event,
    }
  }

  return {
    ok: true,
    delivered: true,
    dryRun: false,
    channel: 'telegram',
    event,
  }
}
