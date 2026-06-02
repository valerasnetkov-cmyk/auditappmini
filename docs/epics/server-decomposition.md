# Epic 3.3: Декомпозиция `backend/src/server.js` (3 315 → 3 026 nonblank строк)

## Статус

- **3.3.1 ✅ Config extraction (2026-06-02):** env-derived exports, env-helpers
  и `assertProductionConfig` вынесены в `backend/src/config.js` +
  `backend/src/utils/env.js` + `backend/src/utils/asserts.js`. `server.js`
  уменьшен с 3 315 до 3 199 nonblank строк (−116, нетто). Verification: `node --check`
  clean, `npm run smoke:health` все checks OK, `npm run test:unit` 41 passed.
- **3.3.2 ✅ Middleware extraction (2026-06-02):** request-id, access-log,
  security headers, CORS и auth/cookie middleware вынесены в
  `backend/src/middleware/`. `server.js` уменьшен с 3 199 до 3 026 nonblank
  строк (−173, нетто). Verification: `node --check` clean для server +
  middleware, smoke auth/security/observability/isolation/shutdown/owner-setup
  проходят.
- **3.3.3 ⏳ Photo upload / multer extraction** в `services/photoUpload.js`.
- **3.3.4 ⏳ Routes extraction** (auth, vehicles, inspections, defects, photos,
  analytics, dashboard) — самый крупный чанк.
- ⏳ 3.3.5 Seed / demo-data вынос в `seed/`.
- ⏳ 3.3.6 HTTP server bootstrap (server.js → ~50 строк) с graceful shutdown.

## Цель

Разделить монолитный `backend/src/server.js` на логические модули:
конфиг, security middleware, rate limit, auth, MFA, vehicles, inspections,
defects, photos, analytics, dashboard, seed, demo-data.

## Текущее состояние (подтверждено в коде)

- `backend/src/server.js` — **3 026 nonblank строк** (был 3 315, после Epic 3.3.1–3.3.2).
- Содержит: middleware chain wiring, rate limit, MFA,
  vehicles, inspections, defects, photos, analytics, dashboard, seed.
- Уже вынесены: `routes/adminSaas.js`, `routes/audit.js`, `routes/companies.js`,
  `routes/completeInspection.js`, `routes/odometer.js`, `routes/photo-requirements.js`.
- Уже вынесены: `utils/transliteration.js`, `utils/env.js`, `utils/asserts.js`,
  `services/secretStore.js`, `services/redisClient.js`, `services/rateLimiter.js`,
  `config.js`, `middleware/requestId.js`, `middleware/accessLog.js`,
  `middleware/security.js`, `middleware/auth.js`.

## Epic 3.3.1: Config extraction (✅ 2026-06-02)

### Что вынесено

**`backend/src/utils/env.js`** (новый, 42 nonblank строки) — pure env-парсеры:
- `hasEnvValue(name)` — truthy-env (не-null, не-пустая строка).
- `parsePositiveIntegerEnv(name, fallback)` — безопасный integer-parsing с
  fallback (использует `hasEnvValue`).
- `parseTrustProxy(value)` — нормализация `TRUST_PROXY` env (`true`/`false`/
  integer-hop-count/raw-string).
- `normalizeHeaderName(value)` — strict header name regex
  (`/^[a-z0-9!#$%&'*+.^_`|~-]+$/`) с fallback на `x-request-id`.
- `parseAccessLogSkipPaths(value)` — comma-separated paths с дедупликацией и
  trailing-slash trim.
- `isValidAccessLogSkipPath(pathname)` — валидатор (length ≤ 256, no whitespace,
  no `..`, начинается с `/`).

**`backend/src/utils/asserts.js`** (новый, 10 nonblank строк) — pure assertion helpers:
- `assertPositiveInteger(value, name)` — throw если не positive int.
- `assertOneOf(value, allowedValues, name)` — throw если value не в списке.

**`backend/src/config.js`** (новый, 112 nonblank строк) — все env-derived exports +
`assertProductionConfig()` + его вызов на module-load:

- 27 named exports: `isProduction`, `JWT_SECRET`, `PUBLIC_REGISTRATION_ENABLED`,
  `TRUST_PROXY`, `SECURITY_HSTS_ENABLED`, `SECURITY_HSTS_MAX_AGE`, `SECURITY_CSP`,
  `SECURITY_CROSS_ORIGIN_OPENER_POLICY`, `SECURITY_CROSS_ORIGIN_RESOURCE_POLICY`,
  `SENSITIVE_RATE_LIMIT_WINDOW_MS`, `SENSITIVE_RATE_LIMIT_MAX`,
  `AUTH_ACCOUNT_RATE_LIMIT_MAX`, `MFA_LOGIN_TOKEN_TTL`, `AUTH_COOKIE_NAME`,
  `AUTH_COOKIE_MAX_AGE_SECONDS`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAME_SITE`,
  `MAX_FILE_SIZE`, `MAX_IMAGE_PIXELS`, `JSON_BODY_LIMIT`,
  `GRACEFUL_SHUTDOWN_TIMEOUT_MS`, `REQUEST_ID_HEADER`, `ACCESS_LOG_FORMAT`,
  `ACCESS_LOG_SLOW_MS`, `ACCESS_LOG_SKIP_PATHS`, `corsOrigins`,
  `allowAllCorsOrigins`.
- `assertProductionConfig()` экспортируется для unit-тестов, но вызывается
  один раз на module-load (side-effect import) — fail-fast в production.
- Константы для internal use вынесены в module-private:
  `UNSAFE_JWT_SECRETS`, `ALLOWED_ACCESS_LOG_FORMATS`, `ALLOWED_COOP_VALUES`,
  `ALLOWED_CORP_VALUES`, `ALLOWED_COOKIE_SAME_SITE`, `SAFE_OWNER_DEFAULT_PASSWORD`.

### Изменения в `server.js`

- 175 строк удалено (constants block + helper functions + `assertProductionConfig`).
- 28 строк добавлено (named imports из `./config.js`).
- Удалены устаревший `getSecret` import и избыточный side-effect-only `import './config.js'`; named import уже выполняет module-load validation.
- **Net: −116 nonblank строк** (было 3 315, стало 3 199).
- Сохранён `let isShuttingDown = false` как runtime-state (не конфиг).
- Сохранён `const PORT = process.env.PORT || 3001` (per-process binding, не env-derived config).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/config.js` — clean.
- `node --check backend/src/utils/env.js` — clean.
- `node --check backend/src/utils/asserts.js` — clean.
- `npm run smoke:health` — все checks OK (`{ok: true, redis: true, ready: true}`).
- `npm run test:unit` — **41 passed, 0 failed** (все pre-existing suites:
  license-plate, rate-limiter, redis-client, secret-store, transliteration).
- `npm run test:integration` — pre-existing issue: `serverAvailable` capture
  happens at module-load до `before` hook, поэтому skip-логика не срабатывает
  при отсутствии запущенного backend. Не связано с Epic 3.3.1.

## Epic 3.3.2: Middleware extraction (✅ 2026-06-02)

### Что вынесено

- **`backend/src/middleware/requestId.js`** (новый, 19 nonblank строк) —
  `createRequestIdMiddleware({ headerName })`, request-id sanitization и
  `crypto.randomUUID()`/`uuidv4()` fallback.
- **`backend/src/middleware/accessLog.js`** (новый, 42 nonblank строки) —
  `createAccessLogMiddleware({ format, slowMs, skipPaths })`, JSON/text access
  log formatting, skip-path matching и slow flag.
- **`backend/src/middleware/security.js`** (новый, 38 nonblank строк) —
  `createSecurityHeadersMiddleware(...)` для security headers/HSTS и
  `createCorsMiddleware(...)` для CORS policy.
- **`backend/src/middleware/auth.js`** (новый, 138 nonblank строк) —
  `createAuthenticateMiddleware(...)`, cookie helpers (`setAuthCookie`,
  `clearAuthCookie`) и `createRequireRoleMiddleware(...)`.

### Изменения в `server.js`

- Inline request-id/access-log/security/CORS/auth/cookie helpers удалены из
  `server.js`; файл теперь только подключает middleware factories.
- `authenticate` создаётся через callbacks `getDb: () => db` и
  `getApiMessages: () => API_MESSAGES`, чтобы сохранить существующий порядок
  объявления `db`/`API_MESSAGES` и регистрации protected routes.
- Порядок middleware сохранён: request-id → access-log → security headers →
  CORS → JSON body parser.
- `server.js`: 3 199 → **3 026 nonblank строк** (−173, нетто).
- Backend-spawning smoke-скрипты переведены на 32-byte hex `JWT_SECRET`,
  чтобы соответствовать `secretStore` min-length guard и не зависеть от
  локального `.env`.

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/middleware/{requestId,accessLog,security,auth}.js` — clean.
- `node --check backend/scripts/smoke-*.mjs` — clean.
- `npm run smoke` — full backend smoke suite OK.
- `npm run test:unit` — 41 passed, 0 failed.

## Целевая структура

```txt
backend/src/
├── app.js                    # Express app factory (новый)
├── server.js                 # HTTP server bootstrap (~50 строк)
├── db.js                     # DB wrapper (см. Epic 3.1)
├── config/
│   ├── env.js                # читает .env, валидирует, экспортирует config
│   └── security.js           # security headers, CSP, CORS
├── middleware/
│   ├── auth.js               # authenticate, requireRole
│   ├── rateLimit.js          # см. Epic 3.2
│   ├── requestId.js          # X-Request-Id
│   └── accessLog.js          # ACCESS_LOG_FORMAT=json
├── routes/                   # уже существует
│   ├── auth.js               # login, me, mfa/verify, owner-setup
│   ├── vehicles.js
│   ├── inspections.js
│   ├── defects.js
│   ├── photos.js
│   ├── analytics.js
│   ├── dashboard.js
│   ├── companies.js          # уже есть
│   └── adminSaas.js          # уже есть
├── services/
│   ├── odometerOcr.js
│   ├── vehicleNumberOcr.js
│   ├── photoPipeline.js
│   └── subscription.js
└── seed/
    ├── regions.js
    ├── demoData.js
    └── admin.js
```

## Подзадачи

1. ✅ **3.3.1 (2026-06-02):** Config extraction — `config.js` + `utils/env.js` +
   `utils/asserts.js`. `server.js` −116 nonblank строк.
2. ✅ **3.3.2 (2026-06-02):** Middleware extraction — `middleware/requestId.js`,
   `middleware/accessLog.js`, `middleware/security.js` (security headers,
   CORS), `middleware/auth.js` (`authenticate`, cookie helpers, `requireRole`).
3. **3.3.3 ⏳:** Photo upload / multer extraction — `services/photoUpload.js`
   (multer disk storage, `ALLOWED_UPLOAD_MIME_TYPES`, sharp pipeline,
   EXIF stripping, geo-tagging, thumbnail).
4. **3.3.4 ⏳:** Routes extraction — `routes/auth.js` (login, MFA, owner-setup),
   `routes/vehicles.js`, `routes/inspections.js`, `routes/defects.js`,
   `routes/photos.js`, `routes/analytics.js`, `routes/dashboard.js`.
5. **3.3.5 ⏳:** Seed extraction — `seed/regions.js`, `seed/admin.js`,
   `seed/demoData.js`.
6. **3.3.6 ⏳:** HTTP server bootstrap — `app.js` factory, `server.js` ~50 строк
   (читает config, вызывает `app.listen(...)`, регистрирует graceful shutdown
   `SIGTERM`/`SIGINT`).
7. **3.3.7 ⏳:** Прогнать все smoke-тесты и `verify:launch` после каждой
   mini-epic.

## Критерии приёмки

- `server.js` ≤ 100 строк (после 3.3.6).
- Ни один `*.js` в `backend/src` не превышает 500 строк (кроме legacy/seed).
- `npm --prefix backend run smoke` проходит без изменений.
- `npm run verify:launch` проходит.
- `docs/backend.md` обновлён под новую структуру.

## Прогресс

- **2026-06-02:** Epic 3.3.1 ✅ — config extraction. `server.js` 3 315 → 3 199
  nonblank строк. 3 новых файла (`config.js` 112, `utils/env.js` 42, `utils/asserts.js` 10 nonblank строк).
- **2026-06-02:** Epic 3.3.2 ✅ — middleware extraction. `server.js` 3 199 → 3 026
  nonblank строк. 4 новых файла (`middleware/requestId.js` 19, `accessLog.js` 42,
  `security.js` 38, `auth.js` 138 nonblank строк). Сохранён порядок middleware:
  request-id → access-log → security headers → CORS → JSON body. Backend-spawning
  smoke-скрипты обновлены под текущий `secretStore` guard.

## Effort / Risk

- **Effort:** L (5-7 дней, требует осторожного переноса и регрессионного
  тестирования).
- **Risk:** M (затрагивает все API-контракты; требует полного smoke).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.3.
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Монолитный
  `server.js`" (открытый backlog).
