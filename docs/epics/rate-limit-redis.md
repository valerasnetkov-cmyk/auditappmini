# Epic 3.2: Распределённый rate limit (Redis)

## Цель

Заменить in-memory `Map`-based rate limiter (`createRateLimiter` в
`backend/src/server.js:375`) на Redis-счётчик, чтобы лимиты корректно
работали при нескольких репликах backend (PM2 cluster, blue/green deployment).

## Текущее состояние (подтверждено в коде)

- `backend/src/services/rateLimiter.js` — `createRateLimiter(...)`.
- `backend/src/middleware/authRateLimit.js` создаёт sensitive IP/account
  limiters для auth-sensitive endpoints.
- Если `REDIS_URL` задан и Redis доступен, limiter использует atomic
  `INCR` + `PEXPIRE` через Lua script и общий bucket для всех backend replicas.
- Если Redis не сконфигурирован или недоступен, limiter деградирует в
  in-memory mode с warning; без Redis лимит остаётся per-replica.
- `/api/health/ready` проверяет Redis при заданном `REDIS_URL` и возвращает
  `503`, если Redis недоступен.

## Проблемы

- При запуске нескольких реплик (PM2 cluster) лимит обходится переключением
  воркера.
- При blue/green deployment момент переключения имеет окно с удвоенным
  лимитом.
- При рестарте процесса счётчики сбрасываются.

## Подзадачи

1. ✅ Добавить `ioredis` (или `redis`) в `backend/package.json`.
2. ✅ Ввести `REDIS_URL` в `backend/.env.example` и `backend/.env.production.example`.
3. ✅ Реализовать `createRateLimiter` поверх Redis (Lua-скрипт для atomic
   `INCR` + `EXPIRE`).
4. ✅ Добавить fallback на in-memory при недоступности Redis (с предупреждением
   в лог).
5. ✅ Прогнать `smoke:security` и `smoke:production-guard`.
6. ✅ Обновить `docs/production-env.md` (Redis как production recommendation
   для multi-replica).
7. ✅ Обновить `docs/launch-checklist.md` (проверка Redis-инстанса).
8. ✅ Добавить health-check Redis в `/api/health/ready`.

## Status 2026-06-05

Closed for current pilot architecture. Redis is optional for single-replica
development/pilot mode and recommended for multi-replica or blue/green
deployments; readiness fails when `REDIS_URL` is configured but Redis is
unavailable.

## Альтернативы

- **Upstash Redis** (managed) — без эксплуатационных затрат.
- **Self-hosted Redis** в PM2-окружении.
- **Cloud-native rate limiter** (Cloudflare Workers Rate Limiting, AWS API Gateway) — для
  edge-решений.

## Критерии приёмки

- `npm --prefix backend run smoke:security` проходит.
- `npm --prefix backend run smoke:production-guard` проходит.
- Запуск с двумя PM2-воркерами: лимит на `/api/auth/login` остаётся одинаковым
  при обращении к разным воркерам.
- `/api/health/ready` возвращает `503` при недоступном Redis (с явной ошибкой
  в JSON).

## Effort / Risk

- **Effort:** M (2-3 дня).
- **Risk:** M (новый runtime-зависимый компонент; требует health-check).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.2.
- `CHANGELOG.md` § "Unreleased" → "Безопасность приложения" → "Rate limit
  только in-memory" (открытый backlog).
