# Epic 3.9: Удаление `DEFAULT_JWT_SECRET` fallback

## Цель

Удалить dev-fallback `DEFAULT_JWT_SECRET = 'audit-secret-key-2024'` из
`backend/src/server.js` после введения распределённого secret store.

## Текущее состояние (подтверждено в коде)

- `backend/src/server.js:37` — `const DEFAULT_JWT_SECRET = 'audit-secret-key-2024'`.
- `backend/src/server.js:38` — `const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET`.
- `backend/src/server.js:142` — `unsafeJwtSecrets = new Set([DEFAULT_JWT_SECRET, 'dev-secret-change-in-production'])`.
- `backend/src/server.js:215` — `if (!isProduction && JWT_SECRET === DEFAULT_JWT_SECRET)` (warning в dev).

## Проблемы

- Любая случайная сборка без `JWT_SECRET` поднимется с предсказуемым
  секретом.
- Guard в production (`assertProductionConfig`) защищает от этого, но
  dev-fallback всё ещё присутствует.

## Подзадачи

1. Ввести `backend/src/services/secretStore.js` (в рамках Epic 3.3) с
   интерфейсом `getSecret(name)`.
2. В dev: `getSecret('JWT_SECRET')` читает из `process.env.JWT_SECRET`
   или из `backend/.env.local` (если есть).
3. В production: `getSecret('JWT_SECRET')` читает из env без fallback.
4. Если `JWT_SECRET` отсутствует — backend отказывается стартовать с
   понятной ошибкой (даже в dev).
5. Удалить `DEFAULT_JWT_SECRET`, `unsafeJwtSecrets` fallback logic.
6. Обновить `backend/.env.example` и `backend/.env.production.example`.

## Критерии приёмки

- `backend/src/server.js` не содержит `DEFAULT_JWT_SECRET`.
- Запуск без `JWT_SECRET` → backend не стартует с понятной ошибкой.
- `npm --prefix backend run smoke` проходит.
- `npm --prefix backend run doctor:production` проходит.

## Effort / Risk

- **Effort:** S (< 1 дня).
- **Risk:** M (затрагивает startup-конфигурацию).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.9.
- `CHANGELOG.md` § "Unreleased" → "Аутентификация, MFA и сессии" → "JWT-секрет
  с дефолтом" (открытый backlog).
