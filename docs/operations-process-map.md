# Operations process map

Этот документ интегрирует внешний operational pack от 2026-06-30 в основную
документацию проекта. Он не заменяет существующие runbook'и, а связывает
процессы пилота с уже реализованными проверками.

## Цель пилота

- стабильный backend API;
- доказательные фото и PDF без потери integrity;
- production doctor на реальном окружении;
- backup/restore discipline;
- управляемые alerts, logs и release evidence;
- resource-admin как сервисный операционный центр.

## Контуры

- **Public contour**: лендинг, заявка на пилот, публичное read-only demo.
- **Tenant web**: кабинет owner/manager, техника, дефекты, отчёты, настройки.
- **Mobile**: active Expo app для проведения осмотров и загрузки доказательств.
- **Backend**: auth, tenant API, photo/PDF pipeline, billing, health, smoke.
- **Resource-admin**: SaaS-level компании, тарифы, платежи, заявки, support,
  service health и release/incident evidence.

## Роли

- `admin` и `resource_manager` работают на service-level и не должны читать
  tenant endpoints техники, осмотров, дефектов или фото.
- `owner`, `manager`, `inspector` работают внутри компании и получают доступ
  только через tenant-scoped API.

## P0 для пилота

- Observability: request id, structured logs, Sentry-ready placeholders,
  Telegram alert dry-run, health/readiness evidence.
- Release gate: `verify:launch`, `doctor:production`, backup/verify,
  release evidence, rollback plan.
- Data safety: persistent `DATABASE_PATH`, `UPLOAD_DIR`, `BACKUP_DIR`, backup
  retention, restore drill.
- Resource-admin visibility: service health, billing scan status, backup
  evidence, worker placeholder до внедрения очередей.

## Связанные runbook'и

- [`release-runbook.md`](./release-runbook.md) — порядок релиза и rollback.
- [`production-env.md`](./production-env.md) — production env contract.
- [`backup-restore.md`](./backup-restore.md) — backup, verify, restore drill.
- [`storage.md`](./storage.md) — правила uploads/reports/runtime storage.
- [`operations-workers.md`](./operations-workers.md) — целевая worker/queue
  архитектура.
- [`observability-alerts.md`](./observability-alerts.md) — logs, Sentry,
  Telegram alerts и incident workflow.
