# Epic 3.1: `sql.js` → `better-sqlite3` (или внешний RDBMS)

## Цель

Заменить `sql.js` (WASM, in-memory, serialized на диск после каждой записи)
на `better-sqlite3` (нативный binding с реальными транзакциями) или на
внешний RDBMS (PostgreSQL / Supabase).

## Текущее состояние (подтверждено в коде)

- `backend/src/db.js` использует `better-sqlite3` и открывает `DATABASE_PATH`
  напрямую.
- `backend/src/db.js` включает WAL и foreign keys при создании connection.
- `getDb()` сохраняет прежний facade (`run`, `get`, `all`) для route/service
  callers.
- `saveDatabase()` оставлен только как compatibility no-op: native SQLite
  driver пишет изменения напрямую в файл.
- `backend/package.json` больше не содержит активную зависимость `sql.js`.
- Исторические `sql.js`-скрипты остаются только в `backend/scripts/_legacy/`.

## Проблемы

- **RAM:** вся БД живёт в памяти Node.js; ~790 КБ SQLite на диске = десятки МБ
  в heap после десериализации.
- **O(N) на каждую запись:** `saveDatabase()` пишет весь файл даже для
  единственного UPDATE.
- **Нет реальных транзакций:** параллельные операции могут привести к
  inconsistent state.
- **Disk wear:** постоянные full-file writes на SSD.
- **`node --watch` реагирует на изменения файла данных** (audit finding).

## Целевые опции

### Вариант A: `better-sqlite3` (минимум трения)

- Нативный binding, синхронный API, реальные транзакции, WAL-режим.
- `npm install better-sqlite3` — заменяет `sql.js` без миграции схемы.
- `db.js` переписывается под `new Database(path)` + `prepare(...).run(...)`.
- `saveDatabase()` удаляется; SQLite сам пишет изменения.
- Подходит для MVP-пилота с одним-двумя процессами backend.

### Вариант B: внешний RDBMS (для multi-tenant SaaS)

- PostgreSQL + `pg` driver (или Supabase).
- Реальная multi-tenant: `company_id` в каждой строке, RLS policies.
- Требует миграции схемы (один раз) и operational changes (managed instance,
  backups, connection pooling).
- Требует отдельного планирования deployment, security perimeter и
  observability.

## Подзадачи (для варианта A)

1. Зафиксировать целевой путь `DATABASE_PATH` (`backend/data/database.sqlite`,
   уже сделано в cleanup-волне).
2. Создать `backend/src/db.better.js` параллельно со старым `db.js`.
3. Перенести схему-инициализацию (CREATE TABLE statements) и seed-данные.
4. Перенести миграции (`repairDatabaseEncoding`, `repairVehicleNumbers`,
   `syncRegionDirectory`) — выполнять один раз при старте, не в каждой транзакции.
5. Перенести wrapper для `getDb()`, `saveDatabase()` — сохранить публичный API.
6. Переписать `run`/`get`/`all` маппинг на `better-sqlite3` API.
7. Прогнать все smoke-тесты; зафиксировать latency comparison.
8. Удалить `sql.js` из `backend/package.json` зависимостей.
9. Обновить `docs/launch-checklist.md` и `docs/production-env.md` под новый драйвер.

## Критерии приёмки

- `npm --prefix backend run smoke` проходит.
- `npm --prefix backend run doctor:production` проходит.
- `npm --prefix backend run smoke:backup` + `backup:verify` проходит.
- `ps aux` показывает стабильный RSS backend без роста под нагрузкой.
- README обновлён: `docs/sql-outline.md` указывает `better-sqlite3`.

## Status 2026-06-04

Closed for Variant A (`better-sqlite3`):

- `backend/src/db.js` imports `better-sqlite3`, opens `DATABASE_PATH`
  directly, enables WAL/foreign keys and preserves the existing `getDb()`
  facade for callers.
- `saveDatabase()` is retained as a compatibility no-op because the native
  SQLite driver writes changes directly to disk.
- Active smoke and backup scripts use `better-sqlite3`; `sql.js` was removed
  from active backend dependencies.
- Legacy scripts under `backend/scripts/_legacy/` are archival and are not part
  of the active npm verification surface.

## Effort / Risk

- **Effort:** L (5-7 дней, требует регрессионного тестирования).
- **Risk:** M (затрагивает все DB-операции; требует backup/restore верификации).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.1.
- `CHANGELOG.md` § "Unreleased" → "Audit findings (2026-05-27)" → "Архитектура
  и хранилище данных" (открытый backlog).
