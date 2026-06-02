# Epic 3.3: Декомпозиция `backend/src/server.js` (3 367 строк)

## Цель

Разделить монолитный `backend/src/server.js` на логические модули:
конфиг, security middleware, rate limit, auth, MFA, vehicles, inspections,
defects, photos, analytics, dashboard, seed, demo-data.

## Текущее состояние (подтверждено в коде)

- `backend/src/server.js` — **3 367 строк** (вырос с 2 837 по audit findings).
- Содержит: middleware chain, security headers, rate limit, auth, MFA,
  vehicles, inspections, defects, photos, analytics, dashboard, seed.
- Уже вынесены: `routes/adminSaas.js`, `routes/audit.js`, `routes/companies.js`,
  `routes/completeInspection.js`, `routes/odometer.js`, `routes/photo-requirements.js`.
- Уже вынесен: `utils/transliteration.js`.

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

1. Создать `app.js` factory — собирает Express app из middleware и routes.
2. Вынести security headers (`helmet`-аналог на `res.setHeader`) в `middleware/security.js`.
3. Вынести rate limit в `middleware/rateLimit.js` (см. Epic 3.2).
4. Вынести auth middleware (`authenticate`, `requireRole`) в `middleware/auth.js`.
5. Перенести обработчики auth, MFA, owner-setup из `server.js` в `routes/auth.js`.
6. Перенести обработчики vehicles / inspections / defects / photos из `server.js`
   в соответствующие `routes/*.js`.
7. Перенести analytics, dashboard в `routes/analytics.js` и `routes/dashboard.js`.
8. Перенести seed-логику (regions, demo-data, admin) в `seed/`.
9. Сохранить `server.js` как ~50 строк: читает config, вызывает `app.listen(...)`,
   регистрирует graceful shutdown (`SIGTERM`/`SIGINT`).
10. Прогнать все smoke-тесты и `verify:launch`.

## Критерии приёмки

- `server.js` ≤ 100 строк.
- Ни один `*.js` в `backend/src` не превышает 500 строк (кроме legacy/seed).
- `npm --prefix backend run smoke` проходит без изменений.
- `npm run verify:launch` проходит.
- `docs/backend.md` обновлён под новую структуру.

## Effort / Risk

- **Effort:** L (5-7 дней, требует осторожного переноса и регрессионного
  тестирования).
- **Risk:** M (затрагивает все API-контракты; требует полного smoke).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.3.
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Монолитный
  `server.js`" (открытый backlog).
