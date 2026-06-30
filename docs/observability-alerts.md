# Observability, logs and alerts

## Production minimum

```txt
Health endpoints
Readiness endpoints
Structured logs
Request ID
Sentry-ready backend/web env
Telegram alert dry-run
Worker heartbeat contract
Backup verification logs
Release evidence
```

## Health and readiness

- Liveness: `GET /health`, `GET /api/health/live`.
- Readiness: `GET /api/health/ready`.
- Readiness проверяет database, uploads и Redis, если задан `REDIS_URL`.

## Structured logs

Backend access logs должны включать:

```txt
timestamp
requestId
method
path
statusCode
durationMs
ip
userId
companyId
userAgent
```

Worker logs после внедрения очередей должны включать:

```txt
timestamp
worker_name
job_id
job_type
tenant_id
entity_id
duration_ms
attempt
status
last_error
```

## Sentry-ready placeholders

Backend:

```dotenv
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
```

Web:

```dotenv
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

Пустые значения допустимы: runtime, smoke и build не должны падать без Sentry.
В Sentry нельзя отправлять JWT, cookie, пароли, setup tokens, raw photo или
необработанные персональные данные.

## Telegram alert dry-run

Env:

```dotenv
TELEGRAM_ALERTS_ENABLED=false
TELEGRAM_ALERTS_DRY_RUN=true
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALERT_CHAT_ID=
```

Проверка без реальной отправки:

```powershell
npm --prefix backend run alerts:dry-run
```

Формат события:

```txt
severity
source
message
context
timestamp
```

Секретные ключи в `context` маскируются.

## Alert events for production

- critical: backend down, readiness false, DB unavailable, backup verify failed,
  PDF integrity mismatch, worker stopped;
- high: 5xx spike, photo failures spike, billing scanner missed, demo auth
  unavailable;
- medium: OCR provider skipped, export failed, email/Telegram notification
  failed, high latency endpoint.

## Incident workflow

```txt
Telegram/Sentry alert
  -> open resource-admin health center
  -> classify severity and affected scope
  -> record incident note
  -> fix and attach evidence: logs, smoke, release note
```
