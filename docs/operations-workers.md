# Operations workers

Целевая архитектура worker/queue слоя для Auditmini. В текущем безопасном
этапе внедряется observability и heartbeat-ready контракт, а не перенос
photo/PDF pipeline в async.

## Что должно уйти в workers позже

- `photo.process`: WebP, watermark, thumbnails, reprocess старых фото.
- `report.pdf.generate`: PDF, QR/public verification, SHA-256, integrity.
- `export.excel.generate`: выгрузки техники, осмотров, дефектов.
- `billing.scan`: subscription scanner, grace/expired/suspended windows.
- `notification.send`: in-app/service/email/Telegram уведомления.
- `ocr.odometer.recognize`: OCR как assistive/manual-confirmation flow.

## Минимальный job contract

```txt
job_id
job_type
tenant_id
entity_id
payload
status
attempts
max_attempts
created_at
started_at
finished_at
failed_at
last_error
idempotency_key
```

## Worker health contract

```txt
worker_name
status: running | degraded | stopped | not_configured
last_heartbeat_at
jobs_waiting
jobs_active
jobs_failed_24h
avg_duration_ms
last_error
```

Resource-admin читает service-level worker status. После первого worker
foundation этапа локальная очередь хранится в SQLite, а `worker:run-once`
обновляет heartbeat. Для production следующая задача — запустить worker под
PM2/systemd и зафиксировать heartbeat evidence.

Проверки:

```powershell
npm --prefix backend run smoke:workers
npm --prefix backend run worker:run-once
```

## Retry policy

- photo processing: 3 попытки, задержки `10s`, `60s`, `5m`;
- PDF generation: 3 попытки, задержки `15s`, `1m`, `5m`;
- OCR: 2 попытки, задержки `10s`, `1m`;
- notifications: 5 попыток, задержки `10s`, `1m`, `5m`, `15m`, `1h`;
- billing scanner: 2 попытки, задержки `5m`, `30m`.

## Не делать в первом этапе

- Не переводить загрузку фото и генерацию PDF в async до production heartbeat,
  alert evidence и отдельного queue smoke для этих job types.
- Не менять URL/response shape фото и PDF.
- Не раскрывать resource-admin tenant data через operational endpoints.
