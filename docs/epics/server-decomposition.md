# Epic 3.3: Декомпозиция `backend/src/server.js` (3 315 → 81 nonblank строк)

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
- **3.3.3 ✅ Photo upload / multer extraction (2026-06-02):** uploads dir,
  multer instance, upload middleware, protected upload path helpers, cleanup
  helpers и sharp WebP/thumb pipeline вынесены в `services/photoUpload.js`.
  `server.js` уменьшен с 3 026 до 2 878 nonblank строк (−148, нетто).
- **3.3.4 ✅ Routes extraction** (auth, vehicles, inspections, defects, photos,
  analytics, dashboard) — самый крупный чанк.
  - **3.3.4.1 ✅ Auth routes extraction (2026-06-03):** auth, MFA, owner setup,
    public registration, logout and session routes moved to `backend/src/routes/auth.js`.
    `server.js`: 2 878 → 2 590 nonblank lines (−288 net); `routes/auth.js`: 331 nonblank lines.
  - **3.3.4.2 ✅ Regions / vehicles routes extraction (2026-06-03):** region
    CRUD/list and vehicle list/detail, CRUD, import, archive, history and
    vehicle-defect routes moved to `backend/src/routes/regions.js` and
    `backend/src/routes/vehicles.js`. Shared region helpers moved to
    `backend/src/services/regions.js`. `server.js`: 2 590 → 2 071 nonblank
    lines (−519 net); new modules: 97 / 429 / 58 nonblank lines.
  - **3.3.4.3 ✅ Inspections routes extraction (2026-06-03):** core inspection
    list/create/detail/update/delete and vehicle inspection history routes moved
    to `backend/src/routes/inspections.js`. `server.js`: 2 071 → 1 767
    nonblank lines (−304 net); `routes/inspections.js`: 329 nonblank lines.
    Nested defect/photo endpoints stay in `server.js` for the next defect/photo chunks.
  - **3.3.4.4 ✅ Defects routes extraction (2026-06-03):** defect create,
    list/detail, update/delete, close/reopen and history routes moved to
    `backend/src/routes/defects.js`. `server.js`: 1 767 → 1 625 nonblank
    lines (−142 net); `routes/defects.js`: 164 nonblank lines. Defect photo
    upload and photo delete stay in `server.js` for the next photos chunk.
  - **3.3.4.5 ✅ Photos routes extraction (2026-06-03):** inspection photo
    upload, defect photo upload and photo delete routes moved to
    `backend/src/routes/photos.js`. `server.js`: 1 625 → 1 494 nonblank lines
    (−131 net); `routes/photos.js`: 163 nonblank lines.
  - **3.3.4.6 ✅ Dashboard / analytics routes extraction (2026-06-03):**
    notifications, dashboard stats, analytics overview and analytics export
    routes moved to `backend/src/routes/dashboard.js` and
    `backend/src/routes/analytics.js`. `server.js`: 1 494 → 1 287 nonblank
    lines (−207 net); new modules: 63 / 166 nonblank lines.
- **3.3.5 ✅ Seed / demo-data extraction (2026-06-03):** `/api/seed`
  demo-data generation moved to `backend/src/seed/demoData.js`. `server.js`:
  1 287 → 1 158 nonblank lines (−129 net); `seed/demoData.js`: 146 nonblank
  lines.
- **3.3.6 ✅ HTTP server bootstrap extraction (2026-06-04):** Express app
  wiring moved to `backend/src/app.js`; `server.js` now owns `initDatabase()`,
  `app.listen(...)`, socket tracking and graceful shutdown. `server.js`:
  1 158 → 81 nonblank lines; `app.js`: 1 090 nonblank lines.

## Цель

Разделить монолитный `backend/src/server.js` на логические модули:
конфиг, security middleware, rate limit, auth, MFA, vehicles, inspections,
defects, photos, analytics, dashboard, seed, demo-data.

## Текущее состояние (подтверждено в коде)

- `backend/src/server.js` — **81 nonblank строк** (был 3 315, после Epic 3.3.1–3.3.6).
- `backend/src/app.js` — **1 090 nonblank строк**: Express app factory,
  middleware chain wiring, rate limit, protected uploads, users/settings/
  reference routes and all extracted route module registrations.
- Уже вынесены: `routes/auth.js`, `routes/regions.js`, `routes/vehicles.js`,
  `routes/inspections.js`, `routes/defects.js`, `routes/photos.js`,
  `routes/dashboard.js`, `routes/analytics.js`,
  `routes/adminSaas.js`, `routes/audit.js`, `routes/companies.js`,
  `routes/completeInspection.js`, `routes/odometer.js`, `routes/photo-requirements.js`.
- Уже вынесены: `utils/transliteration.js`, `utils/env.js`, `utils/asserts.js`,
  `services/secretStore.js`, `services/redisClient.js`, `services/rateLimiter.js`,
  `services/photoUpload.js`,
  `config.js`, `middleware/requestId.js`, `middleware/accessLog.js`,
  `middleware/security.js`, `middleware/auth.js`, `seed/demoData.js`,
  `app.js`.

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

## Epic 3.3.3: Photo upload / multer extraction (✅ 2026-06-02)

### Что вынесено

**`backend/src/services/photoUpload.js`** (новый, 167 nonblank строк):
- `uploadsDir` resolution + directory creation.
- `upload` — shared multer instance with image MIME filter and file-size limit.
- `uploadPhoto(req, res, next)` — wrapped `upload.single('photo')` with existing
  413/400 responses.
- `isUploadMiddlewareError(err)` — adapter for the global error handler.
- `getMimeType`, `buildUploadUrl`, `resolveUploadPath`.
- `removeFileIfExists`, `removePhotoFiles`, `removePhotoFilesForRows`.
- `processUploadedPhoto(...)` — sharp metadata validation, original storage,
  main WebP, thumb WebP, size/hash metadata.

### Изменения в `server.js`

- Удалены direct imports `multer`, `sharp`, `fileURLToPath`, `MAX_FILE_SIZE`,
  `MAX_IMAGE_PIXELS` из `server.js`.
- Protected `/uploads/*`, inspection photo upload, defect photo upload,
  odometer/vehicle-number OCR routes и cleanup paths используют exports из
  `services/photoUpload.js`.
- Global error handler проверяет multer errors через `isUploadMiddlewareError`.
- `server.js`: 3 026 → **2 878 nonblank строк** (−148, нетто).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/services/photoUpload.js` — clean.
- `npm run smoke` — full backend smoke suite OK.
- `npm run test:unit` — 41 passed, 0 failed.

## Epic 3.3.4.1: Auth routes extraction (✅ 2026-06-03)

### What moved

**`backend/src/routes/auth.js`** (new, 331 nonblank lines):
- `/api/auth/login`
- `/api/auth/mfa/verify`
- `/api/auth/owner-setup`
- `/api/users/:id/mfa/setup`
- `/api/users/:id/mfa/verify`
- `/api/auth/register`
- `/api/auth/logout`
- `/api/auth/me`
- auth session token helpers, MFA login token helpers and owner setup invitation factory.

### Changes in `server.js`

- Removed direct imports of `speakeasy`, `jsonwebtoken`, `crypto`,
  `setAuthCookie`, `clearAuthCookie`, `JWT_SECRET`, `PUBLIC_REGISTRATION_ENABLED`
  and `MFA_LOGIN_TOKEN_TTL` from `server.js`.
- `registerAuthRoutes(...)` wires existing auth dependencies from `server.js`.
- `createOwnerSetupInvitationFactory({ db })` keeps the existing SaaS admin owner setup integration.
- `server.js`: 2 878 → **2 590 nonblank lines** (−288 net).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/routes/auth.js` — clean.

## Epic 3.3.4.2: Regions / vehicles routes extraction (✅ 2026-06-03)

### What moved

**`backend/src/routes/regions.js`** (new, 97 nonblank lines):
- `/api/regions` list/create/update/delete routes.

**`backend/src/routes/vehicles.js`** (new, 429 nonblank lines):
- `/api/vehicles` list/create/update/archive/delete routes.
- `/api/vehicles/list`
- `/api/vehicles/import`
- `/api/vehicles/:id`
- `/api/vehicles/:id/history`
- `/api/vehicles/:id/defects`
- vehicle payload validation, duplicate checks and archive helpers.

**`backend/src/services/regions.js`** (new, 58 nonblank lines):
- region name normalization, region lookup/list/count helpers and mutation helpers.

### Changes in `server.js`

- Removed inline region and vehicle route handlers.
- Removed vehicle-only validation/mutation helpers from `server.js`.
- `server.js` now wires `registerRegionRoutes(...)` and `registerVehicleRoutes(...)`.
- `getVehicleById(...)` stays in `server.js` for remaining inspections/photos/dashboard blocks.
- `server.js`: 2 590 → **2 071 nonblank lines** (−519 net).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/routes/regions.js` — clean.
- `node --check backend/src/routes/vehicles.js` — clean.
- `node --check backend/src/services/regions.js` — clean.

## Epic 3.3.4.3: Inspections routes extraction (✅ 2026-06-03)

### What moved

**`backend/src/routes/inspections.js`** (new, 329 nonblank lines):
- `/api/inspections` list/create routes.
- `/api/vehicles/:vehicleId/inspections`.
- `/api/inspections/:id` detail/update/delete routes.
- inspection accident validation and inspection detail aggregation helpers.

### Changes in `server.js`

- Removed core inspection route handlers from `server.js`.
- Removed inspection-only helpers `validateAccidentDetails`, `getInspectionPhotos`
  and `getDefectsWithPhotos` from `server.js`.
- `server.js` now wires `registerInspectionRoutes(...)`.
- Nested `/api/inspections/:id/defects` and `/api/inspections/:id/photos` stay
  in `server.js` for the next defect/photo extraction chunks.
- `server.js`: 2 071 → **1 767 nonblank lines** (−304 net).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/routes/inspections.js` — clean.

## Epic 3.3.4.4: Defects routes extraction (✅ 2026-06-03)

### What moved

**`backend/src/routes/defects.js`** (new, 164 nonblank lines):
- `/api/inspections/:id/defects`
- `/api/defects` list route.
- `/api/defects/:id` detail/update/delete routes.
- `/api/defects/:id/close`
- `/api/defects/:id/reopen`
- `/api/defects/:id/history`

### Changes in `server.js`

- Removed core defect route handlers from `server.js`.
- `server.js` now wires `registerDefectRoutes(...)`.
- Defect photo upload and photo delete routes stay in `server.js` for the next
  photos extraction chunk.
- `server.js`: 1 767 → **1 625 nonblank lines** (−142 net).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/routes/defects.js` — clean.

## Epic 3.3.4.5: Photos routes extraction (✅ 2026-06-03)

### What moved

**`backend/src/routes/photos.js`** (new, 163 nonblank lines):
- `/api/inspections/:id/photos`
- `/api/defects/:id/photos`
- `/api/photos/:id`
- allowed inspection photo type validation and upload cleanup.

### Changes in `server.js`

- Removed photo upload/delete route handlers from `server.js`.
- `server.js` now wires `registerPhotoRoutes(...)`.
- `photoRequirements` stay imported in `server.js` for complete-inspection and
  photo-requirements reference routes.
- `server.js`: 1 625 → **1 494 nonblank lines** (−131 net).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/routes/photos.js` — clean.

## Epic 3.3.4.6: Dashboard / analytics routes extraction (✅ 2026-06-03)

### What moved

**`backend/src/routes/dashboard.js`** (new, 63 nonblank lines):
- `/api/notifications`
- `/api/dashboard/stats`

**`backend/src/routes/analytics.js`** (new, 166 nonblank lines):
- `/api/analytics/overview`
- `/api/analytics/export/excel`

### Changes in `server.js`

- Removed notification, dashboard stats and analytics route handlers from
  `server.js`.
- `server.js` now wires `registerDashboardRoutes(...)` and
  `registerAnalyticsRoutes(...)`.
- `readSettings`, `API_MESSAGES` and `ensureCompanyFeatureEnabled` stay wired
  from `server.js` to preserve existing runtime behavior.
- `server.js`: 1 494 → **1 287 nonblank lines** (−207 net).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/routes/dashboard.js` — clean.
- `node --check backend/src/routes/analytics.js` — clean.

## Epic 3.3.5: Seed / demo-data extraction (✅ 2026-06-03)

### What moved

**`backend/src/seed/demoData.js`** (new, 146 nonblank lines):
- `/api/seed`
- demo company bootstrap for empty databases.
- demo users, vehicles, inspections, checklist items and defects generation.
- demo vehicle number and random date/item helpers.

### Changes in `server.js`

- Removed inline seed route handler and demo-data helper functions from
  `server.js`.
- Removed `LICENSE_PLATE_ALLOWED_CYRILLIC` import from `server.js`; demo vehicle
  number generation now lives in `seed/demoData.js`.
- `server.js` now wires `registerDemoDataSeedRoutes(...)` with existing
  auth/user helpers to preserve behavior.
- `server.js`: 1 287 → **1 158 nonblank lines** (−129 net).

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/seed/demoData.js` — clean.

## Epic 3.3.6: HTTP server bootstrap extraction (✅ 2026-06-04)

### What moved

**`backend/src/app.js`** (new, 1 090 nonblank lines):
- `createApp({ getIsShuttingDown })` Express app factory.
- middleware chain, security headers, CORS, body parser and rate limit wiring.
- liveness/readiness endpoints and shutdown-aware 503 guard.
- protected uploads, users/settings/reference routes and extracted route module
  registrations.
- global upload/body error adapter.

### Changes in `server.js`

- `server.js` now owns only process/runtime concerns:
  `initDatabase()`, `createApp(...)`, `app.listen(...)`, socket tracking,
  signal/IPC handlers and Redis-aware graceful shutdown.
- `server.js`: 1 158 → **81 nonblank lines**.
- `app.js`: **1 090 nonblank lines**.

### Verification

- `node --check backend/src/server.js` — clean.
- `node --check backend/src/app.js` — clean.

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
3. ✅ **3.3.3 (2026-06-02):** Photo upload / multer extraction — `services/photoUpload.js`
   (multer disk storage, `ALLOWED_UPLOAD_MIME_TYPES`, sharp pipeline,
   EXIF stripping, geo-tagging, thumbnail).
4. ✅ **3.3.4 (2026-06-03):** Routes extraction — `routes/auth.js` (login, MFA, owner-setup) ✅,
   `routes/regions.js` ✅, `routes/vehicles.js` ✅, `routes/inspections.js` ✅, `routes/defects.js` ✅,
   `routes/photos.js` ✅, `routes/analytics.js` ✅, `routes/dashboard.js` ✅.
5. ✅ **3.3.5 (2026-06-03):** Seed extraction — `seed/demoData.js`.
6. ✅ **3.3.6 (2026-06-04):** HTTP server bootstrap — `app.js` factory, `server.js` 81 строк
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
- **2026-06-02:** Epic 3.3.3 ✅ — photo upload extraction. `server.js` 3 026 →
  2 878 nonblank строк. Новый `services/photoUpload.js` (167 nonblank строк)
  содержит multer setup, upload middleware, protected upload path helpers,
  cleanup helpers и sharp WebP/thumb pipeline.
- **2026-06-03:** Epic 3.3.4.1 ✅ — auth routes extraction. `server.js` 2 878 →
  2 590 nonblank строк. Новый `routes/auth.js` (331 nonblank строка)
  содержит login/session, MFA, owner setup, public registration, logout and `/me` routes.
- **2026-06-03:** Epic 3.3.4.2 ✅ — regions / vehicles routes extraction.
  `server.js` 2 590 → 2 071 nonblank строк. Новые модули:
  `routes/regions.js` 97, `routes/vehicles.js` 429, `services/regions.js` 58
  nonblank строк.
- **2026-06-03:** Epic 3.3.4.3 ✅ — inspections routes extraction.
  `server.js` 2 071 → 1 767 nonblank строк. Новый `routes/inspections.js`
  (329 nonblank строк) содержит core inspection routes.
- **2026-06-03:** Epic 3.3.4.4 ✅ — defects routes extraction.
  `server.js` 1 767 → 1 625 nonblank строк. Новый `routes/defects.js`
  (164 nonblank строк) содержит core defect routes.
- **2026-06-03:** Epic 3.3.4.5 ✅ — photos routes extraction.
  `server.js` 1 625 → 1 494 nonblank строк. Новый `routes/photos.js`
  (163 nonblank строк) содержит inspection/defect photo upload and photo delete routes.
- **2026-06-03:** Epic 3.3.4.6 ✅ — dashboard / analytics routes extraction.
  `server.js` 1 494 → 1 287 nonblank строк. Новые модули:
  `routes/dashboard.js` 63, `routes/analytics.js` 166 nonblank строк
  содержат notifications, dashboard stats, analytics overview and analytics export.
- **2026-06-03:** Epic 3.3.5 ✅ — seed / demo-data extraction.
  `server.js` 1 287 → 1 158 nonblank строк. Новый модуль `seed/demoData.js`
  (146 nonblank строк) содержит `/api/seed` и генерацию demo company/users/
  vehicles/inspections/checklists/defects.
- **2026-06-04:** Epic 3.3.6 ✅ — HTTP server bootstrap extraction.
  `server.js` 1 158 → 81 nonblank строк. Новый `app.js` (1 090 nonblank строк)
  содержит `createApp(...)`, Express middleware/routes wiring and readiness
  endpoints; `server.js` оставлен для init/listen/socket tracking/graceful shutdown.

## Effort / Risk

- **Effort:** L (5-7 дней, требует осторожного переноса и регрессионного
  тестирования).
- **Risk:** M (затрагивает все API-контракты; требует полного smoke).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.3.
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Монолитный
  `server.js`" (открытый backlog).
