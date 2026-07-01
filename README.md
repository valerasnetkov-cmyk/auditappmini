# Аудит техники

Система фотофиксации состояния техники: осмотры, дефекты, ДТП, пробег,
обязательные фото, история изменений и SaaS-ready администрирование компаний.

Проект сейчас находится в состоянии **MVP / pilot-ready SaaS-ready transition**:
основной рабочий сценарий доведён до запуска, а backend/web/mobile уже
разделены по ролям, компаниям и эксплуатационным контурам.

## Текущий стек

| Контур | Текущее состояние |
|---|---|
| Backend | Node.js, Express, `better-sqlite3`, optional Redis rate limit, PM2-ready |
| Web | Next.js 16, React 18, Tailwind/PostCSS, Playwright E2E |
| Mobile | Expo SDK 54, React Native 0.81, Expo Camera/Location/SecureStore |
| Storage | SQLite в `backend/data/database.sqlite`, uploads в `backend/uploads/` |
| Backup | `backup:local` + `backup:verify` с read-only SQLite integrity check |

PostgreSQL/Supabase остаются будущей опцией для более крупного multi-tenant
SaaS. Для контролируемого пилота используется SQLite через `better-sqlite3`.

## Быстрый старт

```powershell
npm install
npm --prefix backend install
npm --prefix web install
npm --prefix mobile install
```

Создайте локальные `.env` из `.env.example` в нужных контурах. Для backend
важные значения по умолчанию:

```txt
DATABASE_PATH=./data/database.sqlite
UPLOAD_DIR=./uploads
BACKUP_DIR=./backups
```

Запуск разработки:

```powershell
npm run dev
```

Или отдельно:

```powershell
npm run dev:backend
npm run dev:web
npm --prefix mobile run start
```

Backend стартует через `backend/src/server.js`, web dev-сервер использует порт
`3002`.

## Проверки

Основные команды:

```powershell
npm run verify:backend
npm run verify:web
npm run verify:mobile
npm run verify:launch
```

Backend:

```powershell
npm --prefix backend run test:unit
npm --prefix backend run smoke
npm --prefix backend run smoke:telegram
npm --prefix backend run doctor:launch
```

Backup:

```powershell
npm run backup:local
npm run backup:verify
```

Release/readiness:

```powershell
npm run release:verify
npm run release:readiness
npm run release:evidence
```

## Архитектура backend

Backend декомпозирован после Epic 3.3:

```txt
backend/src/server.js              # initDatabase, listen, sockets, graceful shutdown
backend/src/app.js                 # Express app factory and route/middleware wiring
backend/src/config.js              # env-derived config and production guard
backend/src/db.js                  # better-sqlite3 wrapper and schema init
backend/src/middleware/            # auth, security, access log, request id, rate limit
backend/src/routes/                # auth, health, vehicles, inspections, defects, photos, admin, users
backend/src/services/              # Redis, rate limiter, company policy, photo upload, users, roles
backend/src/seed/                  # demo-data seed
```

`server.js` намеренно остаётся маленьким. Бизнес-логика должна жить в route,
middleware, service или config modules.

## Основные возможности

- быстрый, плановый и ДТП-осмотр;
- обязательные фото по типам осмотра;
- загрузка фото с MIME/format validation через `sharp`;
- WebP/thumb pipeline для uploads;
- дефекты, история дефектов, закрытие и переоткрытие;
- фото одометра и фиксация пробега;
- распознавание номера и одометра как вспомогательная функция;
- tenant isolation через `company_id`;
- роли `admin`, `owner`, `manager`, `inspector`;
- MFA/TOTP для пользователей;
- httpOnly web session cookie;
- SaaS resource-admin панель без Directus;
- тарифы, лимиты, feature flags и subscription read-only guards;
- Redis-backed rate limit при `REDIS_URL`, in-memory fallback без Redis;
- health/readiness endpoints для launch/monitoring.

## Роли

| Роль | Назначение |
|---|---|
| `admin` | Администратор ресурса: компании, owners, тарифы, лимиты, health-индикаторы. Не получает доступ к tenant-операционным данным. |
| `owner` | Владелец компании: пользователи, настройки, лимиты/usage, операционные данные своей компании. |
| `manager` | Просмотр и управление операционным контуром компании в рамках прав. |
| `inspector` | Проведение осмотров, фотофиксация, дефекты, подтверждение номера и пробега. |

## Продуктовые правила MVP

- QR-коды не используются.
- Ручной ввод номера остаётся основным сценарием.
- Для российских номеров используются латинские визуальные аналоги кириллицы:
  `A B E K M H O P C T Y X`.
- OCR/ANPR не начинает осмотр автоматически и требует подтверждения инспектора.
- Осмотр нельзя завершить без обязательных фото.
- Фото и осмотр сохраняют дату, время и доступные геоданные.
- Любой ответ `НЕТ` в чек-листе создаёт дефект.
- ДТП-осмотр требует место и время ДТП; время создания осмотра их не заменяет.
- Пробег сохраняется вместе с единицей измерения (`km` / `mi`).

## Важные API-группы

| Группа | Примеры endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, MFA endpoints |
| Health | `GET /health`, `GET /api/health/live`, `GET /api/health/ready` |
| Vehicles | `GET/POST /api/vehicles`, `PUT /api/vehicles/:id`, import/archive/history |
| Inspections | `GET/POST /api/inspections`, `GET /api/inspections/:id`, complete |
| Defects | defect CRUD, close/reopen/history |
| Photos/uploads | inspection/defect photos, protected `/uploads/*` |
| Users/settings | tenant users, settings, company usage |
| Resource admin | `/api/admin/resource/*` |
| Analytics | dashboard stats, analytics overview/export |

Подробности: [`docs/backend.md`](./docs/backend.md).

## Структура проекта

```txt
auditappmini/
├── backend/                 # Express API, SQLite storage, smoke/tests/scripts
├── web/                     # Next.js 16 web client and Playwright tests
├── mobile/                  # Expo SDK 54 app
├── scripts/                 # root verification/release helpers
├── docs/                    # product, architecture, operations, audit, epics
├── CODEOWNERS
├── CHANGELOG.md
├── plan.md
└── README.md
```

## Эксплуатация и безопасность

- Секреты не коммитятся; используйте `.env` / `.env.production`.
- Production guard блокирует небезопасные значения `JWT_SECRET`, CORS,
  public registration, storage paths, rate-limit settings и demo admin password.
- `REDIS_URL` рекомендуется для multi-replica/blue-green deployments.
- `backup:local` копирует SQLite и uploads, `backup:verify` проверяет последний
  backup read-only через `better-sqlite3`.
- `SECURITY.md` описывает публичный disclosure process, а
  `docs/SECURITY.md` — подробные runtime-контроли и security backlog.
- `CODEOWNERS` назначает reviewers по backend/web/mobile/ops/security контурам.

## Документация

Основные точки входа:

- [`docs/README.md`](./docs/README.md) — каталог документации;
- [`CHANGELOG.md`](./CHANGELOG.md) — журнал изменений и audit findings;
- [`plan.md`](./plan.md) — рабочий roadmap;
- [`docs/launch-checklist.md`](./docs/launch-checklist.md) — pilot launch checklist;
- [`docs/production-env.md`](./docs/production-env.md) — production env;
- [`docs/deploy-vps.md`](./docs/deploy-vps.md) — VPS deploy runbook and 502 diagnostics;
- [`docs/backup-restore.md`](./docs/backup-restore.md) — backup/restore runbook;
- [`docs/reliable-evidence-inspection.md`](./docs/reliable-evidence-inspection.md) — P0 доказательный осмотр, readiness и PDF;
- [`docs/billing-and-tariffs.md`](./docs/billing-and-tariffs.md) — тарифы,
  лимиты, ручные оплаты и billing statuses;
- [`docs/epics/README.md`](./docs/epics/README.md) — статус Epic 3.1–3.10;
- [`docs/audit-2026-06-05.md`](./docs/audit-2026-06-05.md) — последние docs-sync изменения.

## Текущий статус epics

Закрыты и синхронизированы:

- Epic 3.1: `sql.js` → `better-sqlite3` Variant A;
- Epic 3.2: Redis-backed rate limit;
- Epic 3.3: backend decomposition;
- Epic 3.4–3.10: mobile/web/test/docs/security cleanup chunks по audit 2026-06-02.

См. [`docs/epics/README.md`](./docs/epics/README.md).

## Лицензия

Проект находится в разработке. Лицензия будет определена позже.
