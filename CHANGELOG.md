# Changelog

## Unreleased

### Changed
- **Epic 3.3.4 backend routes extraction**: auth, MFA, owner setup,
  registration, logout and session routes moved from `backend/src/server.js`
  to `backend/src/routes/auth.js`; `server.js` now wires the route module and
  keeps the existing behavior.
- **Resource admin вместо Directus CMS**: принято архитектурное решение отказаться от Directus как активной части проекта. Управление компаниями, владельцами, тарифами и лимитами переносится во встроенный backend/web контур "Администрирование ресурса".
- **Границы роли `admin`**: администратор ресурса отвечает за весь сервисный уровень проекта, но не является владельцем или менеджером компаний и не получает доступ к технике, осмотрам, дефектам, фото и пользовательскому назначению внутри tenant-контуров.
- **Smoke-gate**: backend smoke больше не содержит Directus service/mock проверки и включает MFA login flow, resource-admin CRUD, tenant isolation и лимиты компаний.

### Added
- **Рабочий roadmap**: добавлен `plan.md` с целями, архитектурным решением, границами ролей, этапами реализации и проверками перед пилотом.
- **Статус roadmap**: `plan.md` дополнен статусом выполненных этапов и оставшимися release-actions перед пилотом.
- **Resource-admin контур**: добавлен встроенный API/UI для компаний, владельцев компаний, тарифов, лимитов, статусов и сервисных health-индикаторов без операционных данных компаний.
- **Управление ресурсом в web-панели**: `/saas-admin` расширен формами создания компаний, назначения владельцев, настройки лимитов/модулей и управления тарифами без перехода в CMS.
- **MFA challenge login**: добавлен `/api/auth/mfa/verify` и web-форма ввода TOTP после password login для пользователей с включенным MFA.

### Removed
- **Directus из целевой архитектуры**: Directus больше не рассматривается как optional CMS для MVP-пилота; удалены Directus runtime routes/services, bootstrap/seed scripts, provisioning sync, endpoints, env-переменные, active docs и каталог `directus/`.

### Security
- **Audit findings security hardening**: закрыты первые критичные замечания из audit findings: `/api/auth/login` больше не различает несуществующий email и неверный пароль, загрузка фото сверяет фактический формат изображения через `sharp` с заявленным MIME-типом, добавлен лимит `MAX_IMAGE_PIXELS` и проверка этого параметра в launch doctor.
- **Web httpOnly session cookie**: web-клиент переведён с постоянного JWT в `localStorage` на httpOnly `audit_session` cookie; `Authorization: Bearer` сохранён для mobile/smoke/API-совместимости, старый web-token удаляется из `localStorage` при первом чтении и обменивается на cookie, unsafe cookie-запросы требуют разрешённый `Origin`.
- **Owner setup invitations**: resource-admin контур получил полноценную выдачу доступа владельцу компании без передачи пароля: setup-ссылки хранят статус `not_sent`/`pending`/`accepted`/`expired`, старые ссылки инвалидируются при повторной выдаче или смене email, добавлен API повторной генерации ссылки, кнопки копирования и mailto-приглашение в реестре/карточке компании.
- **Security headers and safer registration defaults**: закрыты дополнительные замечания audit findings: backend теперь выставляет `Content-Security-Policy`, `Cross-Origin-Opener-Policy` и `Cross-Origin-Resource-Policy`, публичная регистрация отключена по умолчанию и включается только явным `PUBLIC_REGISTRATION_ENABLED=true`; smoke и launch doctor проверяют новые параметры.
- **Production guard runtime boot**: `smoke:production-guard` теперь проверяет не только launch doctor, но и короткий реальный старт backend в `NODE_ENV=production` с валидным env и security headers.
- **Repository hygiene guardrails**: `.gitignore` приведён к единой форме без дублей и явно исключает runtime SQLite, uploads/backups/logs, `.tmp-*`, `.tmp-runtime`, `.tmp-e2e` и release artifacts, сохраняя разрешёнными только env-шаблоны.
- **Audit vulnerabilities**: backend и web зависимости обновлены через `npm audit fix`; backend/web/mobile audit gates возвращают 0 vulnerabilities на уровне `moderate`.
- **Tenant isolation для resource admin**: роль `admin` заблокирована на пользовательских tenant endpoints (`vehicles`, `inspections`, `defects`, `photos`, `users`, dashboard/analytics/company usage и др.) и работает только через resource-admin API.
- **Pre-launch blockers**: перед полноценным стартом обязательны production doctor на реальном pilot env, backup/restore verification и release evidence.

### Fixed
- **Tenant read-only UX для журналов и карточек**: списки и карточки осмотров, техники, дефектов и настройки компании теперь показывают статус тарифа компании и заранее блокируют создание, удаление, закрытие/переоткрытие дефектов, сохранение осмотра, завершение осмотра, загрузку/удаление фото, импорт, справочники и сервисные настройки при `suspended`, отключенной компании или `expired` там, где создается новая операционная запись.
- **Resource-admin KPI dashboard 2.0**: `/saas-admin/dashboard` расширен SaaS-агрегатами для администратора ресурса: activation funnel, health center, limit usage heatmap, churn/upsell candidates, Companies 2.0, фиксация `last_login_at` при входе и smoke-проверки новых агрегатов без доступа к tenant endpoints.
- **Resource-admin dashboard analytics**: дашборд дополнен Product Activity, типами осмотров, фото/storage аналитикой, Potential MRR, OCR service summary, фильтрами Companies 2.0 и action-ссылками health center; backend stats возвращает безопасные activity/storage/ocr агрегаты и smoke проверяет их наличие.
- **Resource-admin responsive layout**: админский layout теперь переключает боковое меню в верхнюю панель на мобильных экранах, чтобы `/saas-admin/dashboard` не сжимался в узкую колонку.
- **Offline payments MVP**: добавлены таблицы `company_payments`, `company_subscriptions`, `company_notifications`, `audit_logs`, API `/api/admin/resource/payments`, ручное добавление/отмена оффлайн-платежей, пересчет подписки/MRR, финансовые агрегаты в stats и страница `/saas-admin/payments`.
- **Resource-admin subscription alerts**: добавлены API `/api/admin/resource/alerts`, ручной/скриптовый сканер сроков подписок `npm --prefix backend run subscriptions:check`, read-status уведомлений и страница `/saas-admin/alerts` для контроля 14/7/3/1 дней до окончания, grace period, просрочки и приостановки.
- **Resource-admin company card**: добавлены API `/api/admin/resource/companies/:id`, audit-события для действий resource-admin и страница `/saas-admin/companies/[id]` с обзором компании, владельцами, тарифом/лимитами, платежами, уведомлениями и журналом действий без перехода к tenant endpoints.
- **Resource-admin section split**: `/saas-admin` превращен в обзор ресурса с KPI, быстрыми действиями, срочными подписками и последними платежами; управление компаниями вынесено в `/saas-admin/companies`, управление тарифами в `/saas-admin/plans`, навигация администратора ресурса обновлена под новую структуру без Directus.
- **Subscription guard**: backend теперь оставляет историю компании доступной для чтения, но при `expired` блокирует новые операционные действия, импорт и OCR, а при `suspended` переводит tenant-контур в read-only; добавлен smoke `npm --prefix backend run smoke:subscription-guard`.
- **Resource-admin stats**: API теперь отдаёт список владельцев компаний и тарифы, но не раскрывает операционные данные tenant-контуров.
- **Частичное обновление тарифов**: `PUT /api/admin/resource/plans/:code` сохраняет существующие лимиты и feature flags, если меняется только статус или название.
- **Resource-admin smoke**: smoke-проверка покрывает CRUD компаний/владельцев/тарифов/лимитов, запрет `admin` на tenant endpoints (`vehicles`, `inspections`, `defects`, `users`, dashboard, analytics, company usage), запрет resource-admin API для `owner`/`manager`/`inspector`, список владельцев и сохранение лимитов при частичном обновлении тарифа.
- **Mobile Directus note**: active mobile README больше не описывает Directus как внешний контур и фиксирует работу только через custom backend.
- **Web role docs**: web-документация больше не относит resource admin к ролям, которые видят технику, осмотры, фото, дефекты или OCR-диагностику внутри компании.
- **Company owner docs**: README, product/data-model/backend/web/MFA/measurement/theme docs обновлены под модель, где tenant-настройки, MFA пользователей компании и единицы пробега администрирует `owner`, а resource admin не участвует в операционной настройке компаний.
- **Launch E2E runner**: `scripts/e2e-local.mjs` теперь собирает web с изолированным `NEXT_PUBLIC_API_URL` и запускает его через `next start`, чтобы `verify:launch` не падал из-за уже открытого локального `next dev` lock или build-time env из `.env.local`.
- **Launch E2E роли**: операционные Playwright-сценарии теперь используют company owner credentials (`E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD`) вместо resource admin, а изолированная E2E SQLite-база автоматически получает owner tenant с лимитами.
- **Launch gate**: локальный `npm run verify:launch` теперь проходит полностью, включая backend smoke, web build, mobile verify/EAS readiness, isolated Chromium E2E, launch doctors и audits.
- **Resource-admin navigation**: для роли `admin` web-layout больше не показывает tenant-разделы компании и поиск техники; в меню остаются только контур "Админ ресурса" и профиль.
- **Resource-admin hydration**: layout больше не читает роль из `localStorage` во время первого рендера, поэтому `/saas-admin` не получает hydration mismatch между SSR и клиентом.
- **Resource-admin dashboard**: `/saas-admin` получил агрегированный дашборд на Chart.js со статистикой компаний, техники, осмотров, ДТП, тарифов и расчётной MRR/ARR без доступа к операционным карточкам tenant-данных.
- **Resource-admin profile**: профиль роли `admin` больше не вызывает tenant endpoints `/company/usage`, `/dashboard/stats` и `/analytics/overview`; вместо 403 показывает сервисную сводку resource-admin контура.
- **Resource-admin UI polish**: страница `/saas-admin` получила отдельный визуальный слой с отступами, мягкими панелями, светлыми границами, hover-состояниями таблиц и более аккуратной иерархией dashboard-блоков.
- **Resource-admin dashboard split**: KPI, Chart.js-графики, тарифная сводка и статистические агрегаты вынесены из `/saas-admin` на отдельную страницу `/saas-admin/dashboard`; `/saas-admin` оставлен для управления компаниями, владельцами, лимитами и тарифами.

- **Tenant subscription visibility**: `/api/company/usage` теперь возвращает безопасный статус подписки, срок тарифа, MRR и предупреждения только для текущей компании; dashboard и настройки компании показывают владельцу/пользователям баннер тарифа при `expiring`, `grace`, `expired`, `suspended` или отключенной компании, без доступа к resource-admin API.
- **Company service notifications**: добавлены поля `service_notifications_enabled`/`service_notification_types`, tenant API `/api/company/service-notification-recipients` и блок настроек для owner; scanner подписок теперь доставляет уведомления не только resource-admin, но и владельцу компании плюс выбранным manager, при этом inspector не получает сервисные уведомления.
- **Tenant read-only UX**: web-контур компании теперь заранее блокирует создание техники, запуск новых осмотров, импорт Excel, генерацию demo-data, редактирование/архивирование техники, управление пользователями и справочник регионов при `suspended` подписке или отключенной компании; при `expired` дополнительно блокируются новые операционные записи. Пользователю показывается причина ограничения до отправки запроса в backend.

### Audit findings (2026-05-27)

Раздел добавлен после ручного аудита проекта (backend, web, mobile, конфигурация). Пункты без отметки "закрыто" остаются backlog-задачами; закрытые пункты описаны в `Unreleased`.

#### Архитектура и хранилище данных
- **SQLite через sql.js (WASM, in-memory)**: backend использует `sql.js` вместо нативного `better-sqlite3`. База держится целиком в памяти Node.js и сериализуется на диск через `db.export()`. Это даёт большой расход RAM на крупных компаниях, отсутствие реальных транзакций и риск потери данных при крэше процесса. Рекомендуется миграция на `better-sqlite3` или внешний RDBMS (Postgres).
- **`saveDatabase()` после каждой записи**: обёртка `getDb()` в `backend/src/db.js` вызывает полную запись всей БД на диск (`fs.writeFileSync`) после каждого `run`/`exec`. С ростом БД операции деградируют до O(N) на каждый insert/update, блокируют event loop и создают повышенный износ диска.
- **Файл БД лежит внутри `backend/src`**: путь по умолчанию `backend/src/database.sqlite` находится в каталоге исходников. Любая ошибка в `.gitignore` приведёт к утечке боевых данных в репозиторий, а `node --watch` может реагировать на изменения файла данных.
- **Монолитный `server.js` (~2 837 строк)**: `backend/src/server.js` содержит конфиг, security middleware, rate limiting, auth, MFA, vehicles, inspections, defects, analytics, seed и dashboard. Это затрудняет ревью, повышает риск регрессий и мешает писать модульные тесты.
- **Тяжёлые миграции на каждом старте**: `repairDatabaseEncoding()`, `repairVehicleNumbers()` и `syncRegionDirectory()` запускаются при каждом `initDatabase()`. На больших таблицах это удлинит холодный старт и readiness probe.
- **`.tmp-*` и `*.log` файлы в корне репозитория**: `backend-dev.log`, `backend-run.log`, `stderr.log`, `stdout.log`, `.tmp-backend-dev.out.log`, `.tmp-e2e`, `.tmp-runtime` и т.п. лежат рядом с исходниками. Они шумят, могут содержать чувствительные данные из stack trace и должны быть выведены в отдельные каталоги вне корня.

#### Аутентификация, MFA и сессии
- **JWT-секрет с дефолтом**: `backend/src/server.js` использует `DEFAULT_JWT_SECRET = 'audit-secret-key-2024'` при отсутствии `JWT_SECRET`. В dev-режиме это удобно, но любая случайная сборка без `.env` поднимется с предсказуемым секретом.
- **MFA login flow был неполным**: исходный аудит выявил, что при `mfa_enabled=1` пользователь не мог завершить вход без уже выданного JWT. В текущей реализации добавлен отдельный login challenge через `/api/auth/mfa/verify` и web-форма ввода TOTP.
- **MFA активируется по первому совпадению TOTP**: `mfa/verify` одновременно подтверждает токен и выставляет `mfa_enabled = 1`. Нет отдельных эндпоинтов `enable` и `challenge`, нет backup-кодов, нет ограничения по времени между `setup` и `verify`, нет окна допустимого дрейфа (`window`).
- **JWT хранится в `localStorage` web-клиента — закрыто в Unreleased**: web-клиент переведен на httpOnly `audit_session` cookie, а legacy token удаляется из `localStorage` при первом чтении; `Authorization: Bearer` оставлен для mobile/smoke/API-совместимости.
- **Срок жизни токена 7 дней без refresh/rotation**: `jwt.sign(... { expiresIn: '7d' })` без revocation list и refresh-токенов. Отзыв скомпрометированного токена возможен только через смену `JWT_SECRET` для всех пользователей.
- **Информативные ошибки логина — закрыто в Unreleased**: `/api/auth/login` больше не различает несуществующий email и неверный пароль.
- **Owner setup-токен повторно используем**: `/api/auth/owner-setup` валидирует `setup_fingerprint` от текущего `user.password`, но не сохраняет одноразовый признак использования — пока пароль не сменён повторно, та же setup-ссылка остаётся валидной.

#### Безопасность приложения
- **CORS по умолчанию открыт на множество dev-портов**: список `http://localhost:3000,3002,8083,8081,8082` зашит как fallback. В non-production средах с публичным URL это легко проглядеть. Стоит требовать явный `CORS_ORIGINS` даже в dev.
- **Rate limit только in-memory**: `createRateLimiter` в `backend/src/server.js` использует локальную `Map`. При запуске нескольких реплик (PM2 cluster, blue/green) лимит обходится переключением воркера. Нужен распределённый счётчик (Redis) для production.
- **`PUBLIC_REGISTRATION_ENABLED` зависит от `NODE_ENV` по умолчанию — закрыто в Unreleased**: публичная регистрация отключена по умолчанию и включается только явным opt-in.
- **Загрузка фотографий — закрыто в Unreleased**: загрузка фото проверяет фактический формат через `sharp`, сверяет его с заявленным MIME-типом и ограничивает декодирование через `MAX_IMAGE_PIXELS`.
- **Пути загрузок**: `resolveUploadPath` корректно блокирует traversal, но `buildUploadUrl` строит URL из имени файла без подписи. Кэширование на CDN/прокси возможно только при добавлении подписанных URL.
- **Заголовки безопасности минимальны — закрыто в Unreleased**: backend теперь выставляет `Content-Security-Policy`, `Cross-Origin-Resource-Policy` и `Cross-Origin-Opener-Policy`.
- **Speakeasy зашит в зависимости web-клиента**: `web/package.json` содержит `speakeasy` в `dependencies`. Серверная TOTP-библиотека в SSR/CSR-бандле не нужна и потенциально может попасть в клиентский bundle.

#### Качество кода и поддержка
- **N+1 запросы в списке техники**: `GET /api/vehicles` после основного запроса делает `lastInspection` и `defectsCount` по каждому ряду в `.map` отдельными `db.prepare(...).get(...)`. На больших парках это даст линейное замедление.
- **Толстые страницы web-клиента**: `web/src/app/inspections/[id]/page.tsx` (922 строки), `web/src/app/vehicles/page.tsx` (714), `web/src/app/page.tsx` (548), `web/src/app/vehicles/[id]/page.tsx` (541) — монолитные client-компоненты с большим числом состояний. Рекомендуется выделить хуки данных и презентационные компоненты, перевести часть на серверные компоненты Next 16.
- **Mojibake-словари в `backend/src/db.js`**: жёстко зашитые карты исправления повреждённых русских строк. Это исторический технический долг и индикатор того, что когда-то БД писалась в неправильной кодировке. Нужно зафиксировать корневую причину (import-скрипт/драйвер) и удалить миграцию после очистки данных.
- **Тесты разрозненные**: в `backend/tests` собраны `debug-*`, `fix-*`, `reset-db`, `add-test-vehicle` и подобные одноразовые скрипты вперемешку с `role-tests.js`, `integration.resolve-number.test.mjs`, `transliteration.test.mjs`. Нет единого test runner, нет coverage. Smoke-скрипты заменяют unit/integration-тесты.
- **Mobile `App.tsx` 944 строки**: один файл содержит `Login`, `CompanySelect`, `InspectionFlow` и StyleSheet (~793 строк стилей). Разнести по `src/screens/*` и `src/styles`.
- **`mobile/src` почти пустой**: только `api.ts`, `CameraCapture.tsx`, `types.ts`, `theme.tsx`. Вся бизнес-логика осталась в `App.tsx`.
- **Документация раздроблена**: в корне лежат `backend.md`, `web.md`, `mobile.md`, `data-model.md`, `product.md`, `eb-first_SystemAdmin.md`, `codex-vehicle-inspection-photo-webp.md`, `workflow-reference-dark-theme-transfer.md`, плюс `docs/`. Стоит свести в единое содержание `docs/README.md`.

#### Конфигурация и репозиторий
- **`.env.local` лежит в рабочей копии**: файл присутствует на диске (содержит публичный Supabase anon-key и URL-плейсхолдер). В `git ls-files` его нет, но он по-прежнему рискует попасть в коммит — стоит хранить только в `.env.example`.
- **`backend/.env.example` содержит небезопасные dev-дефолты**: `JWT_SECRET=dev-secret-change-in-production` и `ADMIN_PASSWORD=admin123`. Это шаблон, но dev может скопировать его в `.env` и так уйти в продакшн; Directus-переменные из шаблона удалены.
- **Дублирующиеся записи в `.gitignore`**: `.env`, `.next/`, `*.log` встречаются дважды. Файл стоит привести к канонической форме.
- **`package-lock.json` в корне почти пуст (139 байт)**: при наличии независимых `package-lock.json` в `backend`, `web`, `mobile` корневой lock-файл бесполезен и вводит в заблуждение.
- **Нерелевантные артефакты в рабочей копии**: логи (`backend-run.log` ~140 КБ, `backend-dev.log` ~32 КБ) и временные каталоги. Следует исключить из истории и не публиковать.

#### CI/CD и эксплуатация
- **Production guard зависит от `NODE_ENV`**: `assertProductionConfig()` срабатывает только при `NODE_ENV=production`. Случайный запуск backend без переменной в production-окружении не выкинет ошибок про слабый JWT или `CORS_ORIGINS=*`.
- **`pm2-logrotate` настраивается вручную**: скрипт `pm2:logrotate:configure` живёт в `backend/package.json`. Без него логи могут забить диск; стоит включить в установочный runbook.
- **Большое количество smoke-скриптов выполняется последовательно**: `npm --prefix backend run smoke` запускает 16+ subprocess. Это медленно и затрудняет параллелизацию в CI.
- **Нет lint-команды для backend и mobile на верхнем уровне**: `web` имеет `eslint`, остальные проекты не имеют статического анализа JS. Стоит добавить минимум `eslint` + `prettier` единым правилом для всех воркспейсов.
- **Отсутствует `SECURITY.md` и `CODEOWNERS`**: для проекта с MFA, multi-tenant и фотодоказательствами стоит зафиксировать процесс ответственного раскрытия уязвимостей и владельцев критичных модулей.


### Audit findings (2026-06-02)

Read-only обследование ресурса. Полный отчёт — `docs/audit-2026-06-02.md`. Пункты без отметки "закрыто" остаются backlog-задачами; закрытые пункты в этом аудите описаны в `Unreleased`/отмечены ниже.

#### Закрыто в этом аудите (pre-pilot cleanup)
- **Удалён каталог `directus/`**: остался только файл `directus/.env` с dev-ключами Directus/Postgres; runtime-кода, scripts, env-переменных в `backend`/`web`/`scripts` нет, поэтому каталог удалён целиком. Закрывает остаточный артефакт после CHANGELOG §Removed «Directus из целевой архитектуры».
- **Перенесён корневой `.env.local`**: `NEXT_PUBLIC_SUPABASE_URL` + anon-key перенесены в `web/.env.local` с пометкой «currently unused» (supabase-зависимости в `web/package.json` есть, но в коде `web/src` не используются). Корневой `.env.local` удалён.
- **Удалены runtime-логи в корне (13 файлов)**: `backend-run.log` (144 КБ), `backend-dev.log` (33 КБ), `backend.log`, `backend-foreground.log`, `backend-error.log`, `backend-dev.err.log`, `stderr.log`, `stdout.log`, `web-start.log`, `web-start.err.log`, `.tmp-{backend,web}-dev.{err,out}.log`. Все уже были исключены `.gitignore`-ом, но физически присутствовали в рабочей копии.
- **Сгенерирован release-evidence manifest**: `npm run release:evidence` → `release-evidence/release-evidence-2026-06-01T21-10-12-937Z.json` (готов к приложению к release-нотам).
- **`npm run doctor:production` прогнан на трёх контурах**: backend/web/mobile все корректно отвергают placeholder-значения (`app.example.com`, `admin@example.com`) в production-режиме и возвращают понятные ошибки. Доктор работает.

#### Подтверждено кодом (без изменений)
- **Directus полностью убран из исходников**: ни одного импорта/ссылки в `backend/src`, `web/src`, `scripts`. Единственное упоминание — текстовое «без Directus» в `web/src/app/saas-admin/page.tsx:69`.
- **Resource-admin API собран** в `backend/src/routes/adminSaas.js` (83 830 байт) со всеми заявленными endpoint'ами `/api/admin/resource/{stats,companies,owners,plans,limits,payments,alerts}` + alias'ы `/api/admin/saas/*`.
- **Web `/saas-admin` декомпозирован**: `dashboard`, `companies`, `companies/[id]`, `plans`, `payments`, `alerts` + обзор в `saas-admin/page.tsx`.
- **Security headers (CSP/COOP/CORP)**, rate limiter (`createRateLimiter` server.js:375), JWT-secret guard, MFA, httpOnly cookie (`audit_session`), `MAX_IMAGE_PIXELS`, owner setup-ссылки, `PUBLIC_REGISTRATION_ENABLED=false` по умолчанию, health/readiness endpoints — все на месте.

#### Расхождения / остаточные артефакты
- **`web/web/package-lock.json`**: фантомный вложенный lock-файл вне workspace-границ (не игнорируется явно). Запланировано к удалению в cleanup-волне.
- **`package-lock.json` (корень)**: 139 байт, пустые `packages`. Запланировано к удалению в cleanup-волне.
- **`backend/src/database.sqlite` (790 КБ)**: runtime-БД лежит внутри `src/`. Запланирован перенос дефолта `DATABASE_PATH` в `backend/data/` и удаление старой БД в cleanup-волне.
- **Документация в корне**: 8 doc-файлов в корне (`backend.md`, `web.md`, `mobile.md`, `data-model.md`, `product.md`, `eb-first_SystemAdmin.md`, `codex-vehicle-inspection-photo-webp.md`, `workflow-reference-dark-theme-transfer.md`) + 28 в `docs/`. Запланировано объединение в `docs/README.md` в cleanup-волне.

#### Открытый архитектурный долг (epic'и)
- **`sql.js` → `better-sqlite3` (или Postgres)**: `sql.js` (WASM, in-memory) даёт большой расход RAM, отсутствие реальных транзакций и O(N) `saveDatabase()` после каждой записи (`db.js:985, 1002, 1033`).
- **Распределённый rate limit (Redis)**: `createRateLimiter` (server.js:375) использует локальную `Map`; обходится при multi-replica. ✅ **Закрыто**: добавлен `ioredis@^5.4.1` в `backend/package.json`. Создан `backend/src/services/redisClient.js` (lazy connect, throttled error log, `pingRedis`, `getRedisStatus`, `shutdownRedis`, `resetRedisForTests`). Создан `backend/src/services/rateLimiter.js` — новый `createRateLimiter` с двумя стратегиями: (1) Redis-путь: atomic Lua-скрипт `INCR + PEXPIRE` (ключ `rl:<name>:<keyGen>`); (2) in-memory fallback (прежняя логика, выделена в `createInMemoryLimiter`) — активируется при отсутствии `REDIS_URL` или при сбое Redis; warning логируется один раз на процесс. Старая inline-функция `createRateLimiter` (≈42 строки) удалена из `server.js`. Добавлен Redis health-check в `/api/health/ready` (503 при заданном `REDIS_URL` + недоступном Redis). Добавлен `shutdownRedis` в graceful shutdown. `REDIS_URL=` (пустой) добавлен в `backend/.env.example` с пояснением. `docs/production-env.md` и `docs/launch-checklist.md` обновлены: Redis помечен как **рекомендуемая** prod-dependency для multi-replica. Smoke-скрипты `smoke-security` и `smoke-health` получили автоматическую генерацию `JWT_SECRET=crypto.randomBytes(32).toString('hex')` (без этого срабатывал 31-символьный `dev-secret-change-in-production` в `.env`, который теперь в `unsafeJwtSecrets` Set после Epic 3.9). **Tests:** 8 новых unit-тестов для `rateLimiter` (in-memory path) + 9 для `redisClient` (no-REDIS_URL + unreachable URL paths) = 41 passed, 0 failed. `smoke:health` теперь возвращает `redis: true`; `smoke:security` и `smoke:production-guard` проходят.
- **Декомпозиция `backend/src/server.js` (3 367 строк)**: вырос с 2 837; монолит включает middleware, rate-limit, auth, MFA, vehicles, inspections, defects, analytics, dashboard, seed.
- **Декомпозиция `mobile/App.tsx` (944 строки)**: Login/CompanySelect/InspectionFlow + ~793 строк стилей в одном файле. ✅ **Закрыто**: `App.tsx` уменьшен с 944 до **73 строк** (−92%, под целевой ≤ 100). Декомпозиция на 28 новых файлов в `mobile/src/`: **`src/styles/`** (3 файла, 268 строк) — `tokens.ts` 48 (spacing/radii/fontSize/fontWeight/iconSize/layout), `components.ts` 218 (StyleSheet: `container`/`fullScreen`/`card`/`title`/`subtitle`/`input`/`button`/`photoGrid`/`checklistCard` и др.), `index.ts` (re-exports); **`src/components/`** (7 файлов, 207 строк) — `Button.tsx` 58 (Button + Card, variant `primary|secondary`, `loading`, `inactiveColor`), `ScreenContainer.tsx` 44 (ScreenContainer/Title/Subtitle/Label/SubLabel/ErrorText), `FormField.tsx` 25 (`variant: 'input'|'comment'`), `PhotoThumb.tsx` 54 (с optional remove button), `YesNoButton.tsx` 29, `TypeButton.tsx` 38, `index.ts` 18 (re-exports + `componentStyles` alias для обратной совместимости); **`src/hooks/`** (5 файлов, 396 строк) — `useAuth.ts` 41 (auto-`getMe` + session-handler rebind через `setAuthSessionHandler`), `useCompanies.ts` 36 (load + autoSelect single-company), `useInspectionFlow.ts` 245 (FlowStep state machine: home/number/type/accident/photos/odometer/checklist/complete, accident fields, checklist, photo set, defect draft, `getChecklistTitles` helper), `useAccidentLocation.ts` 41 (expo-location permission + `formatCoordinates` + optional `onResolved` callback), `useCameraFlow.ts` 32 (`CameraTarget` discriminated union `'plate_ocr' | { kind: 'inspection'; photoType: string } | { kind: 'defect'; title: string }` + open/close), `useLogin.ts` 33; **`src/screens/`** (12 файлов, 768 строк) — `LoadingScreen.tsx` 22, `LoginScreen.tsx` 71, `NoCompanyScreen.tsx` 36, `CompanySelectScreen.tsx` 54, `InspectionFlowScreen.tsx` 202 (тонкий orchestrator: использует все hooks, рендерит шаг по `state.step`, обрабатывает `Modal + CameraCapture`-обёртку), `inspection-steps/HomeStep.tsx` 11, `NumberStep.tsx` 48, `TypeStep.tsx` 35, `AccidentStep.tsx` 75, `PhotosStep.tsx` 75, `OdometerStep.tsx` 22, `ChecklistStep.tsx` 95, `CompleteStep.tsx` 27. Архитектурные решения: (a) `currentLocation` (expo-location) изолирован в `useAccidentLocation` — не загрязняет `useInspectionFlow`; (b) `useCameraFlow` принимает discriminated `CameraTarget` union; (c) `InspectionFlowScreen` — единая точка обработки `Modal + CameraCapture` (без prop-drilling camera state в steps); (d) `useInspectionFlow.createInspection` принимает optional `accidentData` параметр; (e) `useInspectionFlow.finishInspection` принимает `distanceUnit` снаружи — упрощает dependency injection. `App.tsx` — тонкий orchestrator (73 строки): `App` (ThemeProvider wrapper, 6 строк) + `Main` (67 строк — auth check + route switching: LoadingScreen → LoginScreen → NoCompanyScreen → CompanySelectScreen → InspectionFlowScreen). Verification: `npm run typecheck` (0 ошибок), `npm run install:check` (только 2 pre-existing patch-version warnings: `expo@54.0.34` vs `~54.0.35`, `expo-file-system@19.0.22` vs `~19.0.23` — не относятся к рефакторингу), `npm run doctor` (15/16 passed, 1 failed — тот же patch-version check), `npm run eas:readiness` (`Status: ready`, EAS config + Android `com.vsnetkov.mobile` + iOS `com.vsnetkov.mobile` + preview+production profiles ok).
- **Декомпозиция `web/src/app/inspections/[id]/page.tsx` (1 143 строк)**: вырос с 922 → 1 020 → 1 143; монолит с большим числом состояний. ✅ **Закрыто**: `page.tsx` уменьшен с 1 143 до **235 строк** (−79%, под целевой ≤ 400). Декомпозиция на 22 новых файла в приватных каталогах `web/src/app/inspections/[id]/_lib/`, `_hooks/`, `_components/` (согласно Next.js 16 — `_folderName` префикс отключает каталог от роутинга, см. `web/node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:259-281`): **2 lib-файла** (`checklist.ts` 143 строки — константы, helpers, типы; `printIncidentCard.ts` 61 строка — вынесенная функция печати карточки ДТП); **6 hooks** (`useStatus` 13, `useInspection` 59, `useChecklist` 31, `useAccidentFields` 30, `useOdometer` 29, `usePhotoUpload` 152 — каждый изолирует домен состояния + auto-sync из inspection через `useEffect`); **11 components** (`InspectionDetailBody` 193, `NewInspectionForm` 169, `DefectItem` 139, `PhotoRequirementsSection` 89, `ChecklistSection` 72, `DefectsList` 58, `AccidentCard` 48, `OdometerCard` 39, `InspectionHeader` 38, `InspectionStats` 27, `StatusBanner` 16, `WarningsBanner` 14 — все client components с `'use client'` директивой, `InspectionDetailBody` инкапсулирует warnings-логику + actions-footer). `page.tsx` теперь — тонкий orchestrator (235 строк), только связки: useState ↔ hooks ↔ handlers ↔ `InspectionDetailBody` / `NewInspectionForm`. Все компоненты — `'use client'` (props включают function-callbacks, не serializable через server boundary). Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run build` (Next.js 16.2.6 / Turbopack, 25 routes, ✓ Compiled successfully in 17.8s), `npm run lint` (0 errors, 3 pre-existing warnings о `<img>` vs `next/image` — паттерн унаследован от оригинала, который явно глушил правило `/* eslint-disable @next/next/no-img-element */`), `npm --prefix backend run smoke:health` (`redis: true`, все checks OK).
- **Монолитные web-страницы**: `vehicles/page.tsx` 714, `page.tsx` 581. ✅ **Epic 3.8.1 (vehicles decomposition) закрыт**: `web/src/app/vehicles/page.tsx` 869 → **388 строк** (−55%, под целевой ≤ 400). Декомпозиция на 8 новых файлов в приватных каталогах `web/src/app/vehicles/_lib/`, `_hooks/`, `_components/` (Next.js 16 `_folderName` opt-out от routing): **`_lib/vehicles.ts`** 55 строк (types `VehicleFormData`/`SortableVehicleKey`/`SortConfig`/`ColumnConfig`, константы `ITEMS_PER_BATCH`/`INITIAL_FORM`/`COLUMNS`, helpers `getStatusLabel`/`getStatusBadgeClass`/`getSortMarker`); **`_hooks/useVehiclesList.ts`** 159 строк (data fetch через `api.getVehicles`+`api.getRegions`, filter state `searchQuery`/`statusFilter`/`regionFilter`, sort `sortConfig`, batched pagination, module-level `loadData` helper — `useEffect` deps `[searchQuery, statusFilter]` без `eslint-disable` так как `loadData` принимает `setState`-функции явно); **`_components/VehiclesFilters.tsx`** 83 строки, **`VehiclesTable.tsx`** 97 строк, **`VehicleRow.tsx`** 82 строки, **`VehicleModal.tsx`** 27 строк, **`VehicleForm.tsx`** 96 строк. `page.tsx` стал тонким orchestrator (388 строк): связки `useVehiclesList` + `useCompanyUsage` + UI state ↔ handlers ↔ sub-components ↔ `NewInspectionModal`. Архитектурные решения: (a) `loadData` как module-level function (не `useCallback`) — `useEffect` deps валидны без `eslint-disable`; (b) `useEffect` для URL `searchParams` sync через `setSearchQuery`/`setStatusFilter` — флаги `setRegionFilter` и `setSearchQuery` раздельно передаются из hook; (c) `useMemo` для `selectedVehicleIdsSet` и `selectableVisibleVehicleIds` дериваций. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings о `<img>` vs `next/image` в `inspections/[id]/_components/*` — те же что после Epic 3.5), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 16.3s, 26 routes), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- **Тест-инфраструктура**: 27 файлов в `backend/tests/` (включая `debug-*`, `fix-*`, `diag*.mjs`, `reset-db`, `add-test-vehicle`, `check-user-*`); нет единого runner, нет coverage. ✅ **Закрыто**: 27 legacy-скриптов вынесены в `backend/scripts/_legacy/`; созданы `backend/tests/unit/{transliteration,license-plate,secret-store}.test.mjs` (24 unit-теста, все проходят) и `backend/tests/integration/auth-and-resolve.test.mjs` (с `SKIP_INTEGRATION_TESTS=1`); добавлены npm-скрипты `test`, `test:unit`, `test:integration`, `test:all`, `test:coverage` через `node --test` (zero-dependency). `verify:backend` теперь стартует с `test:unit` перед smoke.
- **Mojibake-словари в `db.js`**: остаточная миграция (упоминание в `db.js:136`); требует фиксации корневой причины UTF-8. ✅ **Закрыто**: `TEXT_REPLACEMENTS` Map удалён из `backend/src/db.js:18-47`; `repairTextValue`/`repairTableColumn`/`repairDatabaseEncoding` функции удалены; вызов `repairDatabaseEncoding()` на init убран; `repairMojibakeRussian` импорт убран. Создан one-shot `backend/scripts/fix-mojibake-once.mjs` (с `--dry-run`) — идемпотентный, прогоняется один раз на существующей БД после Epic 3.1. `db.js`: 1 046 → 975 строк (−71, −6.8%). `repairMojibakeRussian` оставлен в `utils/transliteration.js` — используется как defensive parsing для пользовательского ввода (license plates).
- **Документация раздроблена**: 5 root-stub'ов (`backend.md`, `web.md`, `mobile.md`, `data-model.md`, `product.md`) дублировали `docs/` версии. ✅ **Закрыто**: 5 root-stub'ов удалены; в корне остаются только `README.md`, `CHANGELOG.md`, `plan.md`. Удалён черновик `docs/readmee.md` (1 372 строки, опечатка в имени, draft chat). Добавлены `docs/SECURITY.md` (security policy, runtime-модель, disclosure-контакты) и корневой `CODEOWNERS` (назначение ревьюеров по 6 командам: backend / web / mobile / ops / security / docs / audit). `docs/README.md` обновлён. Объединён `docs/dark-theme-color-tokens-changes.md` (902 строки) + `docs/theme.md` (260 строк) в единый `docs/theme.md` (846 строк) с разделителем «Приложение A: Историческая справка»; старая спецификация сохранена внутри, помечена как «выполнено» со ссылками на текущие файлы `tokens.css`, `globals.css`, `statusColors.ts`.
- **`DEFAULT_JWT_SECRET` fallback** в server.js:37 — оставлен с guard в production; удалить после введения secret store. ✅ **Закрыто**: создан `backend/src/services/secretStore.js` (`getSecret` с `allowRandomFallback` + `minLength: 32`); после Epic 3.3.1 `backend/src/config.js` импортирует `getSecret`, а `server.js` получает `JWT_SECRET` через config exports; `DEFAULT_JWT_SECRET` удалён; `assertProductionConfig` использует hardcoded unsafe JWT secrets Set; dev без `JWT_SECRET` генерирует random fallback (96 hex chars) с warning; production требует strong secret. `backend/.env.example:5-9` обновлён (`JWT_SECRET=` пустой).

#### Pre-pilot checklist
- `npm run doctor:production` на реальном production/staging env → ожидается `ok: true`.
- `npm run backup:local` + `npm run backup:verify` → приложить manifest.
- `npm run release:evidence` → приложить JSON к release-нотам.
- `npm run release:first-start` → read-only checklist первого production-старта.
- EAS environment variables настроены → `npm run mobile:eas:production`.

#### Cleanup-волна (выполнена в этом аудите)
- **Удалены фантомные lock-файлы**: `web/web/package-lock.json`, корневой `package-lock.json` (139 байт, пустые `packages`).
- **Перенесён runtime-БД дефолт**: `backend/src/db.js:9-15` теперь читает дефолт из `backend/data/database.sqlite`; `backend/.env.example:13` обновлён. Старый `backend/src/database.sqlite` (790 КБ) удалён.
- **Сведены разрозненные `.md` в `docs/`**: `codex-vehicle-inspection-photo-webp.md` → `docs/inspection-photo-pipeline.md`, `eb-first_SystemAdmin.md` → `docs/first-system-admin.md`, `saas-admin-kpi-dashboard-changes.md` → `docs/saas-admin-kpi-dashboard-changes.md`, `saas-admin-without-directus-offline-payments.md` → `docs/saas-admin-without-directus-offline-payments.md`. Дубль `workflow-reference-dark-theme-transfer.md` (root) удалён в пользу `docs/dark-theme-color-tokens-changes.md`.
- **Создан `docs/README.md`** — оглавление всей документации (4 тематические группы + контекстные changelog-документы).

#### Epic-документы (track-only)
- Создан `docs/epics/README.md` со сводным index архитектурного долга.
- `docs/epics/sqlite-driver-migration.md` — Epic 3.1: переход с `sql.js` на `better-sqlite3`/RDBMS.
- `docs/epics/rate-limit-redis.md` — Epic 3.2: распределённый rate limit (Redis).
- `docs/epics/server-decomposition.md` — Epic 3.3.1 ✅ (2026-06-02, config extraction): вынесены 27 env-derived exports + `assertProductionConfig()` в `backend/src/config.js` (112 nonblank строк) + pure helpers в `backend/src/utils/env.js` (42 nonblank строки, `hasEnvValue`/`parsePositiveIntegerEnv`/`parseTrustProxy`/`normalizeHeaderName`/`parseAccessLogSkipPaths`/`isValidAccessLogSkipPath`) + assertion helpers в `backend/src/utils/asserts.js` (10 nonblank строк, `assertPositiveInteger`/`assertOneOf`). `server.js` уменьшен с 3 315 до 3 199 nonblank строк (−116 нетто). Verification: `node --check` clean для всех 4 файлов, `npm run smoke:health` все checks OK, `npm run test:unit` 41 passed, 0 failed. `assertProductionConfig()` вызывается на module-load через named import из `./config.js` — fail-fast в production. Фундамент для Epic 3.3.2 (middleware extraction), 3.3.3 (photo upload), 3.3.4 (routes), 3.3.5 (seed), 3.3.6 (HTTP server bootstrap).
- `docs/epics/server-decomposition.md` — Epic 3.3.2 ✅ (2026-06-02, middleware extraction): вынесены request-id, access-log, security headers, CORS и auth/cookie middleware в `backend/src/middleware/`: `requestId.js` (19 nonblank), `accessLog.js` (42), `security.js` (38), `auth.js` (138). `server.js` уменьшен с 3 199 до 3 026 nonblank строк (−173 нетто). Порядок middleware сохранён: request-id → access-log → security headers → CORS → JSON body parser; `authenticate` создаётся через callbacks `getDb`/`getApiMessages`, чтобы не менять порядок объявления `db` и `API_MESSAGES`. Backend-spawning smoke-скрипты обновлены на 32-byte hex `JWT_SECRET` под текущий `secretStore` guard. Verification: `node --check` clean для `server.js`, всех 4 middleware-файлов и `backend/scripts/smoke-*.mjs`; `npm run smoke` full backend suite OK; `test:unit` 41 passed. Следующий шаг: Epic 3.3.3 photo upload / multer extraction.
- `docs/epics/server-decomposition.md` — Epic 3.3.3 ✅ (2026-06-02, photo upload / multer extraction): вынесены uploads dir, shared multer instance, `uploadPhoto`, protected upload path helpers, cleanup helpers и sharp WebP/thumb pipeline в `backend/src/services/photoUpload.js` (167 nonblank строк). `server.js` уменьшен с 3 026 до 2 878 nonblank строк (−148 нетто). Protected `/uploads/*`, inspection/defect photo upload, OCR upload routes и cleanup paths используют exports из `services/photoUpload.js`; global error handler проверяет multer errors через `isUploadMiddlewareError`. Verification: `node --check` clean для `server.js` и `services/photoUpload.js`; `npm run smoke` full backend suite OK; `test:unit` 41 passed. Следующий шаг: Epic 3.3.4 routes extraction.
- `docs/epics/mobile-decomposition.md` — Epic 3.4: декомпозиция `mobile/App.tsx` (944 строки, ✅ закрыт).
- **Epic 3.8.2 (settings decomposition) закрыт**: `web/src/app/settings/page.tsx` 826 → **194 строки** (−76%, под целевой ≤ 200). Декомпозирован на 9 новых файлов в каталогах `web/src/app/settings/_lib/`, `_hooks/`, `_components/`: **`_lib/settings.ts`** 89 строк (types `ImportResult`/`StatusMessage`/`ParsedVehicle`, константа `COMPANY_USAGE_STALE_BACKEND_ERROR`, helpers `formatCompanyUsageError`/`getRegionVehicleCount`/`parseToken`/`normalizePlateValue`/`isRussianPlateLike`/`formatNumber`/`formatPlanCode`/`formatUsageValue`/`getUsageBarWidth`/`getUsageTone`/`getUsageHint`/`getFeatureLabel`/`getFeatureClassName`/`recipientRoleLabel` + `buildWriteBlockedMessage`/`pickRestriction` для orchestrator), **`_lib/excelParser.ts`** ~50 строк (`parseVehiclesExcel(buffer)` через `ExcelJS.Workbook` — firstRow detection по headers, number/name/regionIdx поиск, фильтр `isRussianPlateLike` или non-empty name/region); **`_hooks/useCompanyUsagePanel.ts`** (обёртка с auto-clear stale-backend error), **`useRegions.ts`** (CRUD + edit-mode state), **`useServiceRecipients.ts`** (load+toggle with optimistic update), **`useVehicleImport.ts`** (parse+import через `api.importVehicles`); **`_components/CompanyUsagePanel.tsx`** (с `ResourceUsageCard`+`FeatureStatusCard`), **`ServiceNotificationRecipientsPanel.tsx`**, **`ImportPanel.tsx`** (Excel `file input` + result display), **`RegionsPanel.tsx`** (CRUD modal). `page.tsx` стал чистым orchestrator: auth check → role-gate → hook wiring → section render. Ключевые архитектурные решения: (a) `useRef` для hook callbacks внутри `useEffect` — actions object пересоздаётся каждый render, без ref был бы infinite loop; (b) `getBlock: () => BlockInfo` callback в `useRegions.addRegion` (а не прямая BlockInfo) — чтобы не зависеть от closure при concurrent renders; (c) `Dispatch<SetStateAction<StatusMessage | null>>` в hook signatures — поддерживает функциональный `setStatus((current) => ...)` для auto-clear stale errors. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings вне settings), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 11.0s, 26 routes включая `/settings`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- **Epic 3.8.3 (page dashboard decomposition) закрыт**: `web/src/app/page.tsx` 646 → **192 строки** (−70%, под целевой ≤ 200). Декомпозирован на 10 новых файлов в каталогах `web/src/app/_lib/`, `_hooks/`, `_components/`: **`_lib/dashboard.ts`** 90 строк (types `DateRange`/`ProgressTone`/`ToastTone`/`ToastMessage`, константы `RANGE_LABELS`/`TOAST_CLASS_NAME`/`STAT_TONE_CLASS_NAME`, helpers `getAnalyticsParams`/`getRangeStart`/`makeCsv`/`buildExportFilename`/`getChartTitleToneClassName`); **`_hooks/useDashboard.ts`** 177 строк (`useDashboard` — 6 state slots, parallel fetch stats+notif+me+usage, conditional analytics load, error/auth-expired handling; `useDashboardExport` — `exportData(type)` для CSV через `URL.createObjectURL` + `anchor.click` + cleanup, `seedData` с role/restriction guard + `window.confirm` + auto-reload dashboard on success); **`_hooks/useToast.ts`** 17 строк (toast state + 3-sec auto-dismiss через `window.setTimeout`); **`_components/DashboardFilters.tsx`** 80 строк (period select + custom range inputs + CSV export buttons), **`DashboardLoading.tsx`** 10 строк (spinner), **`EmptyDashboard.tsx`** 36 строк (canSeed/disabled/restrictionMessage), **`StatCard.tsx`** 21 строка (tone-mapped color), **`AccidentCard.tsx`** 36 строк (ДТП stats + recent list), **`ChartCard.tsx`** 13 строк (title + tone className), **`NotificationsCard.tsx`** 45 строк (overdue/warning list + slice(0,3)). `page.tsx` стал чистым orchestrator: state setup → hook composition → role/restriction derivation → `triggerLoad` через `useRef` (как Epic 3.8.2 — actions не попадают в `useEffect` deps) → handlers → render. Ключевые архитектурные решения: (a) `triggerLoad` через `useRef(dashboard.load)` + sync в `useEffect` — функция `load` пересоздаётся каждый render (с пустым deps в `useCallback`), но ref всегда указывает на актуальную версию, `useEffect` deps `[router, showToast, dateRange, customFrom, customTo]` остаются стабильными; (b) `useDashboard` принимает deps object `{ router, showToast, dateRange, customFrom, customTo }` — не hooks params, а runtime-args, что упрощает test-ability; (c) `analyticsEnabled` computed inline в orchestrator (не stored) — derived value, не source of truth. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 17.3s, 26 routes включая `/`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- **Epic 3.8.4 (saas-admin dashboard decomposition) закрыт**: `web/src/app/saas-admin/dashboard/page.tsx` 564 → **179 строк** (−68%, под целевой ≤ 200). Декомпозирован на 13 новых файлов в каталогах `web/src/app/saas-admin/dashboard/_lib/`, `_hooks/`, `_components/`: **`_lib/resourceDashboard.ts`** 63 строки (formatters `formatNumber`/`formatCurrency`/`formatPercent`/`formatLimit`/`formatDate`/`formatBytes`, severity helpers `severityClass`/`riskLabel`/`moduleLabel`); **`_hooks/useResourceAdminStats.ts`** 78 строк (`useResourceAdminStats` — fetch + cancelled flag pattern; `useCompaniesFilter` — search/plan/status state + `useMemo` для `planOptions` и `filteredCompanies` с 6-статус filter (all/active/inactive/no-owner/no-limits/near-limit/churn/upsell)); **`_components/EmptyState.tsx`** 9 строк, **`MetricCard.tsx`** 19 строк, **`SectionHeader.tsx`** 10 строк, **`ActivationFunnel.tsx`** 32 строки (7-step funnel mapping), **`HealthItemCard.tsx`** 25 строк, **`CompaniesTable.tsx`** 103 строки (11-column table с status badges + per-row action link), **`LimitsTable.tsx`** 57 строк (6-column limits table), **`ChurnList.tsx`** 29 строк (slice(0,6) + reasons + last activity), **`UpsellList.tsx`** 31 строка (slice(0,6) + potential MRR badge), **`StorageMetrics.tsx`** 20 строк (3-card storage summary), **`CompaniesFilters.tsx`** 46 строк (search input + plan select + status select). `page.tsx` стал чистым orchestrator: state setup → hook composition → derived values (companies/limitUsage/healthItems/riskCenter) → render (Layout + hero + error + loading/loaded sections). Ключевые архитектурные решения: (a) типы `SaasLimitUsageCompany`/`SaasChurnRiskCompany`/`SaasUpsellCandidate` импортированы из существующего `@/lib/types` (а не дублированы); (b) `CompaniesTable` принимает `totalCount` prop — различает "не созданы" vs "не найдены по фильтру" empty states; (c) `useCompaniesFilter` инкапсулирует filter state + `useMemo` derivations в одном hook, возвращает `{state, actions, planOptions, filteredCompanies}` API. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 11.4s, 26 routes включая `/saas-admin/dashboard`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- **Epic 3.8.5 (users page decomposition) закрыт**: `web/src/app/users/page.tsx` 547 → **181 строка** (−67%, под целевой ≤ 200). Декомпозирован на 6 новых файлов в каталогах `web/src/app/users/_lib/`, `_hooks/`, `_components/`: **`_lib/users.ts`** 50 строк (types `UserFormData`/`SortableUserKey`/`SortConfig`/`MessageTone`, константа `EMPTY_FORM`/`PANEL_MANAGED_ROLES`/`USER_COLUMNS`, helpers `getRoleLabel`/`getRoleBadgeClass`/`canManagePanelUser`); **`_hooks/useUsers.ts`** 155 строк (`useUsersList` — users state + loading + statusMessage + sortConfig + `loadUsers` + `showStatus` + `handleSort`, `useUsersFilter` — `useMemo` с search/roleFilter/sortConfig, `useUserForm` — modal state + form state + `openCreateModal`/`openEditModal`/`closeCreateModal`/`closeEditModal`/`resetForm`, `useCreateUser`/`useUpdateUser`/`useDeleteUser` — API wrappers с trim+password-trim); **`_components/UsersFilters.tsx`** 65 строк (search input + role select + column visibility menu), **`UsersTable.tsx`** 99 строк (`SortableHeader` helper + hidden column checks + action buttons with `canManagePanelUser` guard), **`UserFormModal.tsx`** 65 строк (reusable create/edit modal with formError + writeRestrictionMessage disabled). `page.tsx` стал чистым orchestrator: state setup → hook composition → filter+sort → `useEffect` для auto-load (с `eslint-disable` для `list.loadUsers` deps — `useUsersList` возвращает новый `loadUsers` каждый render) → handlers (`handleCreate`/`handleUpdate`/`handleDelete` с loading/restriction guards) → render. Ключевые архитектурные решения: (a) `useUsersList` возвращает `{users, loading, statusMessage, statusTone, sortConfig, loadUsers, showStatus, handleSort, setUsers}` — единый hook для всего list state, не три отдельных; (b) `useUserForm` инкапсулирует modal+form state с shared `formData` между create/edit modes; (c) `useCreateUser`/`useUpdateUser`/`useDeleteUser` — pure API wrappers, не hooks с state, для простоты test-ability; (d) `hiddenColumns` lifted в orchestrator (а не в `UsersFilters`) — нужно для `UsersTable` тоже. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 18.7s, 26 routes включая `/users`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- **Epic 3.8.6 (saas-admin/companies page decomposition) закрыт**: `web/src/app/saas-admin/companies/page.tsx` 450 → **113 строк** (−75%, под целевой ≤ 200). Декомпозирован на 10 новых файлов в каталогах `web/src/app/saas-admin/companies/_lib/`, `_hooks/`, `_components/`: **`_lib/companies.ts`** 118 строк (types `CompanyForm`/`OwnerForm`/`LimitForm`, константы `emptyCompanyForm`/`emptyOwnerForm`/`emptyLimitForm`, helpers `numberOrNull`/`displayLimit`/`formatNumber`/`formatCurrency`/`formatDate`/`setupStatusLabel`/`setupStatusClass`/`ownerInviteMailto`/`companyLimitForm` + pure `filterCompanies(companies, search, statusFilter)`); **`_hooks/useCompaniesList.ts`** 81 строка (`useCompaniesList` — stats + loading + saving + error + message + ownerSetupLinks + `loadStats`/`withSave`/`showMessage`/`showError`/`setSetupLink`/`clearSetupLink` + derived `companies`/`plans`); **`_hooks/useCompanyForms.ts`** 24 строки (`useCompanyFormState`/`useOwnerFormState`/`useLimitFormState` — три отдельных form-state hooks с initial-companyId); **`_hooks/useCompanyActions.ts`** 147 строк (7 factory-hooks: `useCreateCompany`/`useCreateOwner`/`useSaveLimits`/`useToggleCompanyStatus`/`useDeactivateOwner`/`useIssueOwnerSetupLink`/`useCopySetupLink`, каждый принимает минимум deps из `CompaniesList` API, callback принимает form-data args + onSuccess callback); **`_components/CreateCompanyForm.tsx`** 43 строки, **`CreateOwnerForm.tsx`** 52 строки, **`LimitsForm.tsx`** 108 строк (4 numeric inputs + 4 module checkboxes), **`CompaniesTable.tsx`** 61 строка (header + render-rows + empty-state), **`CompanyTableRow.tsx`** 129 строк (8-column row + inline actions + `OwnerCell` sub-component для setup-link + status badge), **`CompaniesRegistry.tsx`** 66 строк (section wrapper + filters + sort + table). `page.tsx` стал чистым orchestrator: 4 hooks → 7 actions → 3 callbacks (`onCreateCompany`/`onCreateOwner`/`onEditLimits`) → `useEffect` для auto-load (с `eslint-disable`) → render (Layout + hero + error/message + loading/loaded с тремя формами и registry). Ключевые архитектурные решения: (a) `useCompaniesList` — single source of truth для всего list state (stats/loading/saving/error/message/setupLinks), не разделён на 2-3 hooks; (b) `useCompanyActions` — factory-hooks возвращают stable-shape callbacks принимающие form-data args, не замыкающие на form state — это позволило отделить form-state от action-logic; (c) `useCompanyForms` — три отдельных hooks для трёх форм с разной initial-state логикой (`useOwnerFormState`/`useLimitFormState` принимают `companies` для initial-companyId); (d) `CompanyTableRow` инкапсулирует inline `OwnerCell` sub-component — setup-link copy/mailto + status badge логика не утекает наружу; (e) `filterCompanies` как pure function в `_lib` — тестируемо без React; (f) `setForm` prop type `Dispatch<SetStateAction<T>>` — стандартный React pattern, корректно типизирован для setter calls. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 16.4s, 26 routes включая `/saas-admin/companies`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- **Epic 3.8.7 (vehicles/[id] page decomposition) закрыт**: `web/src/app/vehicles/[id]/page.tsx` 669 → **176 строк** (−74%, под целевой ≤ 200). Декомпозирован на 10 новых файлов в каталогах `web/src/app/vehicles/[id]/_lib/`, `_hooks/`, `_components/`: **`_lib/vehicleDetail.ts`** 65 строк (type `DefectHistoryEntry`, helpers `getPhotoThumbUrl`/`getInspectionTypeLabel`/`getInspectionTypeStyle`/`getVehicleStatusLabel`/`getVehicleStatusBadgeClass`/`formatDateTime`, type `StatTone`, константа `statusOptions`); **`_hooks/useVehicleDetailData.ts`** 87 строк (`useVehicleDetailData` — vehicle/inspections/history/defects/loading/error state + `loadData` + `reloadDefects` + `reloadHistory` + auto-load effect с `requireAuthToken` guard); **`_hooks/useToast.ts`** 12 строк (toast state + auto-clear timeout); **`_hooks/useDefectActions.ts`** 87 строк (defectHistories/defectHistoriesVisible state + `closeDefect`/`reopenDefect`/`toggleDefectHistory` + guard pattern с `companyUsageLoading` + `writeRestriction` checks); **`_hooks/useStatusModal.ts`** 95 строк (status modal state + `openStatusModal`/`closeStatusModal`/`handleStatusChange` с `api.updateVehicle` + history reload); **`_components/StatCard.tsx`** 22 строки, **`VehicleInfoCard.tsx`** 33 строки (с inline `InfoItem` sub-component), **`InspectionsHistory.tsx`** 71 строка (table + empty state + `OdometerHistory` integration), **`DefectsSection.tsx`** 158 строк (section + inline `DefectCard` sub-component с photos grid + history toggle), **`StatusHistory.tsx`** 43 строки, **`StatusModal.tsx`** 86 строк (2 status buttons через `statusOptions.map` + reason textarea + save/cancel). `page.tsx` стал чистым orchestrator: 4 hooks (data/toast/defects/modal) → derived values (totalInspections/accidentCount/totalDefects) → loading/error early returns → render (Layout + header + banner + 4 StatCards + InfoCard + InspectionsHistory + DefectsSection + StatusHistory + conditional StatusModal). Ключевые архитектурные решения: (a) `useVehicleDetailData` — single source of truth для page data с auto-load в `useEffect` + `requireAuthToken` guard; (b) `useDefectActions` принимает `Guard` object как runtime-args (loading/restrictionTitle/restrictionMessage/setError) — позволяет переиспользовать guard pattern; (c) `closeDefect`/`reopenDefect` callbacks в orchestrator bind `data.reloadDefects` + `showToast` к hook методам (defect actions hook не знает о `reloadDefects`); (d) `useStatusModal.handleStatusChange` callback в orchestrator bind `(vehicle, vehicleId, showToast, setVehicle, reloadHistory)` — modal hook не зависит от page-specific state; (e) `eslint-disable` для `<img>` перенесён в `DefectsSection.tsx` (где живёт `<img>`), удалён из `page.tsx` (больше не используется); (f) `setForm` prop type `Dispatch<SetStateAction<T>>` — стандартный React pattern. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 10.6s, 26 routes включая `/vehicles/[id]`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- **Epic 3.8.8 (saas-admin/companies/[id] page decomposition) закрыт**: `web/src/app/saas-admin/companies/[id]/page.tsx` 445 → **168 строк** (−62%, под целевой ≤ 200). Декомпозирован на 9 новых файлов в каталогах `web/src/app/saas-admin/companies/[id]/_lib/`, `_hooks/`, `_components/`: **`_lib/companyDetail.ts`** 115 строк (types `CompanyEditForm`/`OwnerForm`/`LimitForm`, helpers `numberOrNull`/`formatNumber`/`formatCurrency`/`formatDate`/`formatDateTime`/`statusTone`/`setupStatusLabel`/`setupStatusClass`/`ownerInviteMailto` + form mappers `limitFormFromData`/`companyFormFromData`); **`_hooks/useCompanyDetails.ts`** 95 строк (`useCompanyDetails` — data + companyForm + limitForm + ownerForm + loading + saving + error + message + ownerSetupLinks + `loadData` + `withSave` + `showMessage`/`showError`/`setSetupLink` + auto-load effect); **`_components/CompanyHeader.tsx`** 73 строки (header + status badge + `MetricCard` exported + `CompanyMetrics` exported); **`_components/CompanyEditForm.tsx`** 67 строк (5 inputs + status select + save button); **`_components/OwnersSection.tsx`** 138 строк (list + inline `OwnerCard` sub-component с setup-link copy/mailto + create form); **`_components/LimitsForm.tsx`** 95 строк (plan select + 3 numeric inputs + 4 module checkboxes + save); **`_components/PaymentsList.tsx`** 56 строк (table + link to /saas-admin/payments); **`_components/AlertsList.tsx`** 47 строк (alerts list + link to /saas-admin/alerts); **`_components/AuditLogs.tsx`** 50 строк (4-column table с action/entity/actor). `page.tsx` стал чистым orchestrator: 1 hook (useCompanyDetails) → 6 handlers (handleCompanySave/handleLimitsSave/handleOwnerCreate/handleOwnerDeactivate/handleIssueOwnerSetupLink/handleCopySetupLink) → derived (subscriptionStatus) → render (Layout + Header + error/message + loading/loaded с metrics + 2-col grid с CompanyEditForm + OwnersSection + LimitsForm + 2-col Payments + Alerts + AuditLogs). Ключевые архитектурные решения: (a) `useCompanyDetails` — single source of truth для всего data + forms + setup links + saving + error/message; (b) 6 handlers определены в orchestrator, не в hook — handlers используют `details.withSave`/`details.showMessage`/`details.showError`/`details.setSetupLink` (стабильные из-за `useCallback`); (c) `CompanyEditForm` принимает `Dispatch<SetStateAction<CompanyEditForm | null>>` с null-safe update pattern (`setForm((prev) => prev ? {...} : prev)`) — компонент рендерится только когда `details.companyForm` non-null; (d) `OwnersSection` инкапсулирует inline `OwnerCard` sub-component — setup-link copy/mailto логика не утекает наружу; (e) `MetricCard`/`CompanyMetrics` экспортированы из `CompanyHeader.tsx` — логически связаны с company display; (f) `PaymentsList`/`AlertsList`/`AuditLogs` — pure display components, получают только data + ничего не знают про hook. Verification: `npx tsc --noEmit` (только pre-existing 2 ошибки в `e2e/tests/*` по `speakeasy@types`, не в нашем коде), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 12.6s, 26 routes включая `/saas-admin/companies/[id]`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).
- `docs/epics/web-inspections-decomposition.md` — Epic 3.5: декомпозиция `web/.../inspections/[id]/page.tsx` (1 143 → 235 строк, ✅ закрыт).
- `docs/epics/test-runner.md` — Epic 3.6: единый test runner + coverage; вынос debug/legacy скриптов.
- `docs/epics/mojibake-cleanup.md` — Epic 3.7: удаление mojibake-словарей в `db.js`.
- `docs/epics/web-decomposition.md` — Epic 3.8: декомпозиция монолитных web-страниц (vehicles 714, page 581, saas-admin 406/518).
- `docs/epics/jwt-secret-store.md` — Epic 3.9: удаление `DEFAULT_JWT_SECRET` fallback.
- `docs/epics/documentation-consolidation.md` — Epic 3.10: декодирование mojibake в `docs/`, объединение дубликатов, `docs/SECURITY.md`, `CODEOWNERS`.


### Fixed
- **Безопасность web-зависимостей**: `next` и `eslint-config-next` обновлены до 16.2.6, закрыт high-risk advisory из `npm audit` для Next.js.
- **Изоляция техники по компании**: основные endpoint техники теперь фильтруют список, карточку, дефекты, создание, импорт, редактирование и удаление по `company_id` текущего пользователя.
- **Права администратора ресурса**: прежний доступ `admin` к manager-операциям заменён отдельным resource-admin контуром; администратор ресурса больше не управляет техникой, справочниками и пользователями внутри компаний.
- **Защита company API**: `/api/companies` и tenant-level company endpoints исключены из resource-admin доступа; компании администрируются через `/api/admin/resource/*`.
- **Ограничения загрузок**: для `multer` добавлены лимит размера файла и whitelist image MIME-типов; JSON body limit вынесен в `JSON_BODY_LIMIT`.
- **Изоляция осмотров и дефектов**: создание, просмотр, закрытие/переоткрытие, история, фото и аналитика дефектов дополнительно привязаны к компании текущего пользователя.
- **Данные дашборда и уведомлений**: статистика, уведомления и агрегаты аналитики теперь не смешивают технику разных компаний.
- **Изоляция пользователей и MFA**: просмотр, редактирование, удаление пользователей и MFA-операции ограничены компанией текущего owner или самим пользователем; resource admin не назначает пользователей внутри компаний.
- **Регионы в multi-company режиме**: счётчики, переименование и удаление регионов теперь затрагивают только технику компании текущего пользователя и не ломают регионы, используемые другими компаниями.
- **Оdometer/номер по компании**: запись одометра и поиск техники по номеру дополнительно проверяют `company_id`, чтобы нельзя было обратиться к чужому осмотру или авто.

### Added
- **Smoke-тест изоляции компаний**: добавлен `backend/scripts/smoke-isolation.mjs` и команда `npm --prefix backend run smoke:isolation`; общий backend smoke теперь проверяет, что другая компания не видит и не меняет чужие авто, пользователей, регионы, одометр и company API.
- **Launch readiness**: добавлены `npm run verify:launch`, high-level audit для web, backend audit, CI workflow `.github/workflows/launch-verify.yml` и чеклист `docs/launch-checklist.md` для пилотного запуска.
- **Локальный backup MVP**: добавлен `npm --prefix backend run backup:local`, который сохраняет SQLite и uploads в timestamp-папку с manifest-файлом.
- **Launch doctor**: добавлен `npm run doctor:launch` / `npm --prefix backend run doctor:launch` для проверки production env перед стартом сервиса.

### Fixed
- **UPLOAD_DIR в backend**: сервер теперь уважает `UPLOAD_DIR` из окружения вместо жёсткого пути `backend/uploads`.
- **PM2 production config**: `backend/ecosystem.config.cjs` стал переносимым, без локального Windows `cwd` и без placeholder `JWT_SECRET` внутри репозитория.
- **Production config guard**: backend теперь отказывается стартовать в `NODE_ENV=production`, если используются слабый `JWT_SECRET`, wildcard CORS, отсутствуют persistent paths для БД/uploads/backups или задан demo admin password.
- **axios CVE-2026-42035**: обновлен `axios` в mobile-app до 1.15.4 (CRLF Injection, Prototype Pollution, HTTP Response Splitting)
- **axios CVE-2026-42039**: обновлен `axios` в mobile-app до 1.16.0 (Uncontrolled Recursion)
- **@xmldom/xmldom CVE-2026-41673** (SNYK-JS-XMLDOMXMLDOM-16134530): обновлен до 0.9.10 через npm overrides (Uncontrolled Recursion, XML Injection)
- **semver CVE-2022-25883** (SNYK-JS-SEMVER-3247795): обновлен до 7.7.4 через npm overrides (ReDoS)

### Added
- **Импорт техники из Excel**: массовый импорт vehicle с авто-созданием регионов. Endpoint `POST /api/vehicles/import` принимает массив `{number, name, region}` и автоматически создаёт отсутствующие регионы в справочнике перед импортом.
- **Управление регионами**: CRUD операции в Settings для owner/manager внутри компании. Endpoint `GET/POST/PUT/DELETE /api/regions` с поддержкой слияния регионов при переименовании (техника переносится в целевой регион).

### Changed
- **Seed регионов**: добавлены 76 основных российских регионов (Москва, Санкт-Петербург, Сахалинская область и др.) при инициализации пустой базы.

### Fixed
- **Hydration mismatch**: стабилизированы menu items в Layout — используется статический массив без динамической фильтрации по роли при рендере.

---

## 2026-05-22

### Added
- **EAS build-контур для active mobile**: добавлен `mobile/eas.json`, скрипт `mobile/scripts/eas-readiness.mjs`, команды `npm run mobile:eas:readiness`, `npm run mobile:eas:preview:android` и `npm run mobile:eas:production`; `mobile/` теперь имеет проверяемый preview/production EAS build-профиль, а runbook фиксирует, что `EXPO_PUBLIC_API_URL` для облачных сборок нужно задавать в EAS environment variables.
- **Изолированный launch E2E runner**: добавлен `scripts/e2e-local.mjs`, который сам поднимает backend и web на свободных локальных портах, использует временную SQLite-БД/uploads, пробрасывает `CORS_ORIGINS`, запускает Chromium Playwright и очищает временные данные после проверки.
- **E2E в launch gate**: root-команда `npm run verify:launch` теперь включает `npm run verify:e2e`, а GitHub Actions workflow устанавливает Playwright Chromium перед запуском launch-проверки.
- **Web E2E helper-команды**: в web-пакет добавлены `prepare:e2e:chromium` и `test:e2e:chromium` для явного запуска/подготовки Chromium-проверок.
- **Production env шаблоны**: добавлены `backend/.env.production.example`, `web/.env.production.example` и `mobile/.env.production.example` с обязательными production-переменными для JWT, CORS, persistent storage, публичных API URL и owner setup; Directus-переменные удалены из активных шаблонов.
- **Production runbook**: добавлен `docs/production-env.md` с порядком подготовки секретов, persistent storage, проверки `doctor:production`, запуска backend/PM2, web build и mobile production build.
- **Production doctor команда**: добавлен root/backend/web/mobile script `doctor:production`, который проверяет отдельные `.env.production` в строгом production-режиме.
- **Mobile launch doctor**: добавлен `mobile/scripts/launch-doctor.mjs`, который проверяет `EXPO_PUBLIC_API_URL` и запрещает localhost/emulator/LAN/placeholder URL в production.
- **Backup verification**: добавлен `backend/scripts/verify-local-backup.mjs` и команды `npm run backup:verify` / `npm --prefix backend run backup:verify` для read-only проверки последнего или указанного backup.
- **Backup smoke gate**: добавлен `backend/scripts/smoke-backup.mjs` и `npm --prefix backend run smoke:backup`; общий backend smoke теперь проверяет создание backup, SQLite `PRAGMA integrity_check`, counts ключевых таблиц и копирование uploads.
- **Backup recovery runbook**: добавлен `docs/backup-restore.md` с порядком создания, проверки и ручного восстановления backup перед пилотной миграцией.
- **Release runbook**: добавлен `docs/release-runbook.md` с единым порядком выкладки: code gate, production env gate, backup gate, build/start, post-release UAT, rollback и release evidence.
- **Release scripts**: добавлены root-команды `release:verify`, `release:production-check` и `release:check` для предрелизной проверки, production env/backup gate и полного релизного gate.
- **Release evidence manifest**: добавлен `scripts/collect-release-evidence.mjs` и root-команда `npm run release:evidence`; генератор создаёт локальный JSON-манифест релиза без значений production-секретов и фиксирует git commit/status, production env presence, backup manifest, обязательные gate-команды и PM2 log-retention настройки.
- **First production start checklist**: добавлен `scripts/first-production-start.mjs`, root-команда `npm run release:first-start` и документ `docs/first-production-start.md`; checklist выводит read-only порядок первого production/staging запуска без раскрытия секретов.
- **Launch readiness report**: добавлен `scripts/launch-readiness-report.mjs` и root-команда `npm run release:readiness`; отчёт показывает structural blockers, обязательные release-actions, accepted pilot risks, final gate commands и audit-команды для evidence без запуска destructive-операций.
- **Production server commands**: добавлен `docs/production-server-commands.md` с короткой серверной шпаргалкой `doctor -> verify -> backup -> PM2 logrotate -> pm2:start -> web build/start -> health -> evidence`.
- **mobile-app retirement note**: добавлен `docs/mobile-app-retirement.md`, а `mobile-app/README.md` помечен как legacy; активным мобильным production-контуром зафиксирован `mobile/`.
- **Mobile contour status report**: добавлен `scripts/mobile-contour-report.mjs` и root-команда `npm run mobile:status`; release readiness/evidence теперь явно показывают, что `mobile/` является рабочим production-контуром, а `mobile-app/` остается исключенным legacy-каталогом до удаления или отдельного upgrade.
- **Backend health/readiness endpoints**: добавлены unauthenticated endpoints `/health`, `/api/health`, `/api/health/live` и `/api/health/ready`; readiness проверяет SQLite query и возможность записи во временный файл внутри `UPLOAD_DIR`.
- **Health smoke gate**: добавлен `backend/scripts/smoke-health.mjs` и `npm --prefix backend run smoke:health`; общий backend smoke теперь начинается с проверки liveness/readiness endpoint.
- **Backend security smoke gate**: добавлен `backend/scripts/smoke-security.mjs` и `npm --prefix backend run smoke:security`; общий backend smoke теперь проверяет security headers, отключённый `X-Powered-By`, `Cache-Control: no-store` для auth и `429` на sensitive endpoint rate limit.
- **Backend observability smoke gate**: добавлен `backend/scripts/smoke-observability.mjs` и `npm --prefix backend run smoke:observability`; общий backend smoke теперь проверяет echo `X-Request-Id` и JSON access log с тем же request id.
- **Backend graceful shutdown smoke gate**: добавлен `backend/scripts/smoke-shutdown.mjs` и `npm --prefix backend run smoke:shutdown`; общий backend smoke теперь проверяет контролируемую остановку HTTP-сервера через тот же graceful shutdown path, который используется для `SIGTERM`/`SIGINT`.
- **Production guard smoke**: добавлен `backend/scripts/smoke-production-guard.mjs` и `npm --prefix backend run smoke:production-guard`; общий backend smoke теперь проверяет, что production doctor запрещает публичную регистрацию.

### Removed
- **Legacy mobile-app contour**: удалён каталог `mobile-app/` вместе с устаревшим Expo/React Native кодом и ignored-хвостами; production mobile-контур окончательно закреплён за `mobile/`, а release/readiness-документы обновлены под состояние “legacy удалён”.

### Changed
- **Mobile doctor без зависимости от внешней сети**: `mobile/scripts/expo-doctor-safe.mjs` запускает Expo Doctor с `EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS=1` и отключённой React Native Directory network-проверкой; строгий сетевой режим оставлен отдельной командой `npm --prefix mobile run doctor:online`.
- **Launch doctor с явным env-файлом**: `backend/scripts/launch-doctor.mjs` теперь поддерживает `--production`, `--mode`, `--doctor-env-file` и `LAUNCH_ENV_FILE`, показывает `envFileExists` и отлавливает placeholder-значения в JWT, CORS, admin/password и `WEB_APP_URL`.
- **Web launch doctor**: `web/scripts/launch-doctor.mjs` получил `--production`, `--mode`, `--doctor-env-file`, `LAUNCH_ENV_FILE`, проверку placeholder URL и HTTPS-требование для `NEXT_PUBLIC_API_URL` в production.
- **Root launch doctor**: `npm run doctor:launch` и `npm run verify:launch` теперь проверяют backend, web и mobile env-контуры, а не только backend.
- **PM2 production env**: `backend/ecosystem.config.cjs` автоматически подхватывает `backend/.env.production`, если он есть, и пробрасывает production-секреты, лимиты и runtime-настройки custom backend без Directus-контура.
- **Launch checklist и README**: `docs/launch-checklist.md`, `web/README.md` и `mobile/README.md` теперь описывают production env для backend/web/mobile и обязательную проверку `npm run doctor:production` перед релизом.
- **Backup manifest**: `backend/scripts/backup-local-data.mjs` теперь дополняет manifest размером и SHA-256 SQLite-файла, статистикой uploads и структурированными `database`/`uploads` блоками, сохраняя старые поля `databaseCopied`/`uploadsCopied`.
- **Launch/production docs**: `docs/launch-checklist.md` и `docs/production-env.md` теперь требуют запуск `backup:verify` после каждого pilot backup.
- **Связка launch docs**: `docs/launch-checklist.md`, `docs/production-env.md` и `docs/backup-restore.md` теперь ссылаются на единый release runbook, чтобы порядок выкладки не расходился между документами.
- **Deployment docs**: `docs/deployment.md` и `docs/release-runbook.md` теперь описывают `/api/health/ready` как основной endpoint для reverse proxy/monitoring readiness, а `/health` как лёгкую liveness-проверку.
- **SaaS registration model**: публичный `/api/auth/register` оставлен только для local/dev-сценариев и отключается через `PUBLIC_REGISTRATION_ENABLED=false`; в production backend и doctor запрещают включать саморегистрацию, потому что компании создаёт админ ресурса, а менеджеров/инспекторов — владелец компании.
- **Company features smoke stability**: `backend/scripts/smoke-company-features.mjs` теперь выбирает свободные локальные порты и ждёт `/api/health/ready`, чтобы launch gate не падал случайно из-за занятого порта или чужого HTTP-сервиса.
- **Backend dependency security**: `uuid` в backend обновлён до `^11.1.1`, чтобы закрыть moderate advisory `uuid <11.1.1` без `npm audit fix --force`.
- **Web/mobile dependency security**: для web и active Expo mobile добавлен npm override `uuid@^11.1.1`, закрывающий транзитивный advisory через `exceljs` и Expo `xcode` без breaking `npm audit fix --force`.
- **Backend security perimeter**: Express теперь отключает `X-Powered-By`, задаёт `TRUST_PROXY`, добавляет базовые security headers/HSTS и ограничивает sensitive auth/setup/MFA endpoint через `SENSITIVE_RATE_LIMIT_*` / `AUTH_ACCOUNT_RATE_LIMIT_MAX`.
- **Backend request tracing**: backend теперь принимает/создаёт `X-Request-Id`, возвращает его в каждом ответе, добавляет header в CORS exposed headers и пишет request id в access logs; `ACCESS_LOG_FORMAT=json` включает структурированные JSON-логи для production.
- **Backend access log noise control**: добавлен `ACCESS_LOG_SKIP_PATHS` для исключения частых health-check путей из access log; production example, PM2 config, launch doctor и observability smoke учитывают новую настройку.
- **PM2 log retention**: добавлены backend-команды `pm2:logrotate:install` и `pm2:logrotate:configure`; production/deployment/release docs теперь описывают ротацию PM2-логов без timestamp prefix поверх JSON access-log.
- **Launch risks cleanup**: `docs/launch-checklist.md` больше не содержит устаревший web PostCSS-риск; вместо этого checklist требует audit evidence для active `web`/`mobile` и явно оставляет legacy `mobile-app` вне production до upgrade/retire.
- **Readiness docs coverage**: `release:first-start` и `release:readiness` теперь ссылаются на production server commands и mobile-app retirement path, чтобы оператор видел статус legacy mobile-каталога перед запуском.
- **Generated E2E artifacts cleanup**: `web/test-results/` добавлен в web ignore, чтобы Playwright `.last-run.json` не попадал в merge/commit после launch-проверок.
- **Backend graceful shutdown**: backend теперь обрабатывает `SIGTERM`/`SIGINT`, переводит readiness в `503`, перестаёт принимать новые соединения, закрывает idle keep-alive и форсирует выход только после `GRACEFUL_SHUTDOWN_TIMEOUT_MS`.

### Verified
- `node --check backend/src/server.js`
- `node --check backend/scripts/smoke-health.mjs`
- `node --check backend/scripts/smoke-security.mjs`
- `node --check backend/scripts/smoke-observability.mjs`
- `node --check backend/scripts/smoke-shutdown.mjs`
- `node --check backend/scripts/smoke-production-guard.mjs`
- `node --check backend/scripts/smoke-company-features.mjs`
- `node --check scripts/collect-release-evidence.mjs`
- `node --check scripts/first-production-start.mjs`
- `node --check scripts/launch-readiness-report.mjs`
- `node --check scripts/mobile-contour-report.mjs`
- `npm run mobile:status`
- `npm run mobile:status -- --json`
- `npm run release:evidence -- --dry-run`
- `npm run release:first-start`
- `npm run release:first-start -- --json`
- `npm run release:readiness`
- `npm run release:readiness -- --json`
- `npm --prefix web audit --audit-level=moderate`
- `npm --prefix mobile audit --audit-level=moderate`
- `npm --prefix mobile-app audit --audit-level=moderate` *(expected legacy advisory output; `mobile-app` remains excluded from production)*
- `npm --prefix backend run smoke:security`
- `npm --prefix backend run smoke:observability`
- `npm --prefix backend run smoke:shutdown`
- `npm --prefix backend run smoke:production-guard`
- `npm --prefix backend run smoke:company-features`
- `npm --prefix backend audit --audit-level=moderate`
- `npm --prefix web audit --audit-level=high`
- `npm --prefix mobile run audit:moderate`
- `npm --prefix backend run smoke:health`
- `npm --prefix backend run smoke`
- `npm run verify:launch`
- `node -e "<package release scripts check>"`
- `npm run release:verify`
- `node --check backend/scripts/backup-local-data.mjs`
- `node --check backend/scripts/verify-local-backup.mjs`
- `node --check backend/scripts/smoke-backup.mjs`
- `npm --prefix backend run smoke:backup`
- `npm --prefix backend run backup:verify`
- `npm --prefix backend run smoke`
- `node --check backend/scripts/launch-doctor.mjs`
- `node --check web/scripts/launch-doctor.mjs`
- `node --check mobile/scripts/launch-doctor.mjs`
- `node --check backend/ecosystem.config.cjs`
- `npm --prefix backend run doctor:launch`
- `npm --prefix web run doctor:launch`
- `npm --prefix mobile run doctor:launch`
- `npm run doctor:launch`
- `node backend/scripts/launch-doctor.mjs --production --doctor-env-file <temporary-valid-env>`
- `node backend/scripts/launch-doctor.mjs --production --doctor-env-file .env.production.example` — ожидаемо падает, пока placeholder-значения не заменены.
- `node web/scripts/launch-doctor.mjs --production --doctor-env-file <temporary-valid-env>`
- `node mobile/scripts/launch-doctor.mjs --production --doctor-env-file <temporary-valid-env>`
- `node web/scripts/launch-doctor.mjs --production --doctor-env-file .env.production.example` — ожидаемо падает, пока placeholder API URL не заменён.
- `node mobile/scripts/launch-doctor.mjs --production --doctor-env-file .env.production.example` — ожидаемо падает, пока placeholder API URL не заменён.
- `node --check scripts/e2e-local.mjs`
- `node --check mobile/scripts/expo-doctor-safe.mjs`
- `npm --prefix mobile run verify`
- `npm --prefix web run lint`
- `npm run verify:e2e`
- `npm run verify:launch`

## 2026-05-21

### Fixed
- **Launch E2E gate для дефектов и MFA**: Playwright-тесты обновлены под текущий контракт backend/UI — API-запросы идут в backend на 3001, тестовые госномера генерируются в валидном российском формате, дефекты создаются через актуальный endpoint `/api/inspections/:id/defects`, а MFA verify отправляет поле `token`.
- **Статус дефекта в детальной карточке**: endpoint `GET /api/defects/:id` теперь возвращает `status` и `closed_at`, поэтому после закрытия дефекта detail-страница переключается на действие «Вернуть в работу» и не остаётся в устаревшем состоянии.
- **Селекторы формы входа для E2E**: поля email/password получили стабильные `name` и `data-testid`, чтобы тесты и автоматизация не зависели от текста интерфейса.

### Changed
- **E2E helper-слой**: добавлен общий `web/e2e/tests/helpers.ts` для авторизации, создания тестовой техники, осмотров, дефектов, пользователей MFA и безопасной cleanup-архивации тестовых записей.
- **Toast переоткрытия дефекта**: в детальной карточке дефекта сообщение приведено к единому тексту «Дефект повторно открыт», как в карточке техники.

### Verified
- `node --check backend/src/server.js`
- `node --check backend/scripts/smoke-inspections.mjs`
- `npm --prefix backend run smoke:inspections`
- `npm --prefix web run lint`
- `npm --prefix web run build`
- `npm --prefix web run test:e2e -- --project=Chromium`
- `npm run verify:launch`

### Added
- **Фильтр дефектов по технике из осмотра**: страница «Дефекты» теперь читает параметр `vehicle` из URL, загружает дефекты выбранной техники и показывает активный фильтр с возможностью вернуться к общему журналу.
- **Контекст осмотра в журнале дефектов**: список дефектов теперь получает `inspection_id` из backend API, чтобы переход обратно в карточку осмотра был доступен из отфильтрованного списка.
- **Множественная архивация техники**: на вкладке техники добавлен выбор строк чекбоксами, панель выбранных элементов и действие «В архив» для массового переноса техники без физического удаления данных.
- **Backend API архивации техники**: добавлены tenant-safe endpoints `POST /api/vehicles/archive` и `POST /api/vehicles/:id/archive` со статусной историей перехода в `archived`; `DELETE /api/vehicles/:id` теперь также выполняет мягкую архивацию вместо физического удаления.

### Changed
- **Статус техники `archived`**: схема SQLite расширена для архивного статуса; основной список и справочник выбора техники по умолчанию скрывают архивные записи, а фильтр «Архив» позволяет просмотреть их отдельно.
- **Действие удаления на вкладке техники**: одиночное действие в строке теперь переносит технику в архив вместо физического удаления из базы.

### Verified
- `node --check backend/src/server.js`
- `node --check backend/scripts/smoke-inspections.mjs`
- `npm --prefix backend run smoke:inspections`
- `npm --prefix web run lint`
- `npm --prefix web run build`
- `node --check backend/src/server.js`
- `node --check backend/src/db.js`
- `node --check backend/scripts/smoke-vehicles.mjs`
- `npm --prefix backend run smoke:vehicles`
- `npm --prefix backend run smoke`
- `npm --prefix web run lint`
- `npm --prefix web run build`

### Fixed
- **Закрытие дефекта в карточке техники**: endpoint `/api/vehicles/:id/defects` теперь возвращает `status` и `closed_at`, поэтому после нажатия «Закрыть дефект» карточка техники обновляет бейдж на «Закрыт» и показывает действие возврата в работу.
- **Photo file lifecycle cleanup**: deleting photos, defects or inspections now removes the related `original_url`, `webp_url`, `thumb_url` and legacy `url` files from the protected uploads directory, while repeated inspection edits continue preserving existing defect photos unless the defect/photo record is actually removed.
- **Tenant-safe photo deletion queries**: bulk photo deletions for inspections and defects now include `company_id` and collect photo rows before deleting DB records, so filesystem cleanup follows the same tenant boundary as the API.

### Changed
- **Inspection smoke uploads isolation**: `smoke-inspections` now runs with an isolated temporary `UPLOAD_DIR`, asserts generated WebP/original files exist after upload, and verifies files are removed after deleting an inspection.

### Verified
- `node --check backend/src/server.js`
- `node --check backend/scripts/smoke-inspections.mjs`
- `npm --prefix backend run smoke:inspections`
- `npm --prefix backend run smoke`

## 2026-05-20

### Changed
- **Mobile defect photo preview**: checklist defect rows now show the selected local defect photo preview before completion, with a success marker and a replace action, so inspectors can verify the attached evidence before the defect is uploaded.

### Verified
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run install:check`

### Changed
- **Mobile photo preview tiles**: required inspection photo tiles now show the locally captured image preview with a success checkmark and photo-type label after the backend upload succeeds, while still storing the server-returned WebP/thumbnail URL as the canonical uploaded reference.

### Verified
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run install:check`

### Changed
- **Mobile photo upload contract**: Expo mobile client now types upload responses as `UploadPhotoResponse`/`PhotoRecord` with `original_url`, `webp_url`, `thumb_url`, dimensions, file sizes and hash, matching the backend WebP pipeline.
- **Mobile multipart MIME detection**: mobile upload helper now sends JPG/JPEG, PNG or WebP MIME/name based on the captured file URI, while defaulting camera captures to JPEG for compatibility with the server whitelist.
- **Mobile inspection photo state**: after uploading a required inspection photo, the app stores the server-returned `thumb_url || webp_url || url` instead of only the local file URI, so the mobile flow follows the canonical backend photo contract.

### Verified
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run install:check`
- `node --check backend/src/server.js`
- `node --check backend/src/db.js`
- `npm --prefix backend run smoke:inspections`

### Added
- **Inspection/defect photo WebP pipeline**: backend now accepts only JPG/JPEG, PNG and WebP up to 15 MB, preserves the original evidence file in `original_url`, generates `main.webp` up to 2048px and `thumb.webp` up to 480px with `sharp`, and stores dimensions, MIME, original filename, file sizes and SHA-256 hash.
- **Protected nested photo storage**: new uploads are stored under `/uploads/inspections/{inspectionId}/photos/{photoId}/original.{ext|main.webp|thumb.webp}`; protected uploads check tenant ownership against `url/original_url/webp_url/thumb_url` and support nested paths.

### Changed
- **Web photo rendering**: cards and galleries use `thumb_url` for thumbnails and `webp_url` for preview, with fallback to legacy `url` so existing rows continue to work.
- **Photo smoke tests**: inspection/isolation smoke scripts now upload a valid PNG fixture and assert that `main.webp`, `thumb.webp` and the preserved original are returned.

### Verified
- `node --check backend/src/server.js`
- `node --check backend/src/db.js`
- `node --check backend/scripts/smoke-inspections.mjs`
- `node --check backend/scripts/smoke-isolation.mjs`
- `npm --prefix backend run smoke:inspections`
- `npm --prefix backend run smoke:isolation`
- `npm --prefix backend run smoke`
- `npm --prefix web run lint`
- `npm --prefix web run build`

### Fixed
- **Проверка активных JWT по базе**: `authenticate` теперь после валидации JWT перечитывает пользователя из SQLite, отклоняет удаленных и `inactive` пользователей, не принимает setup-token как обычный auth-token и использует актуальные `role`/`company_id` из базы вместо устаревшего payload.
- **Provisioning integer ID из Directus**: backend-нормализация `companies.id`, `company_owners.company_id` и `company_limits.company_id` теперь принимает integer primary keys Directus 11 и сохраняет их как строковый tenant id в SQLite, поэтому компании, владельцы и лимиты из CMS не отбрасываются при sync.
- **Кодировка страницы SaaS-админа**: `/saas-admin` переписан с нормальными русскими подписями вместо mojibake-строк в заголовках, health-блоке, таблице компаний и сообщениях доступа.
- **Web UX отозванной сессии**: frontend API-клиент теперь централизованно завершает сессию и переводит пользователя на `/login` при `401` или backend-ответе `User is inactive`, включая multipart-загрузки фото.
- **Mobile UX отозванной сессии**: Expo API-клиент теперь очищает сохраненный secure-token и возвращает пользователя на экран входа при `401` или backend-ответе `User is inactive`, включая multipart-загрузки фото осмотра и дефектов.
- **Hydration mismatch в меню**: `Layout` больше не читает роль пользователя из `localStorage` во время первого рендера; SSR и первый client-render теперь совпадают, а пункты меню по роли применяются после монтирования.
- **Липкая шапка больших таблиц**: общие таблицы переведены на `table-card`/`table-scroll` без вертикального clipping, а основной `main` больше не создает лишний scroll-контейнер; заголовки таблиц теперь фиксируются у верхней границы окна при прокрутке длинных списков.
- **Скругление sticky-шапки таблиц**: крайние ячейки заголовка таблицы получили верхние радиусы, чтобы фон sticky-header не торчал прямоугольником за скругленные углы карточки.
- **Сообщение о старом backend в настройках**: если `/api/company/usage` возвращает `HTTP 404`, экран настроек теперь показывает понятную подсказку о необходимости перезапустить backend вместо сырого кода ошибки и очищает сообщение после успешной загрузки тарифа.

### Changed
- **Directus как SaaS backoffice (Plan B)**: активная CMS-схема ограничена уровнем администратора ресурса (`companies`, `company_owners`, `plans`, `company_limits`, `saas_metric_snapshots`); техника, осмотры, дефекты, ДТП, фото, OCR и antifraud исключены из активного bootstrap и остаются в custom backend/панели компаний.
- **Документация CMS-границы**: README, `docs/directus-cms.md`, `docs/Directus.md`, `directus/README.md`, `directus/schema/collections.md` и `directus/schema/seed.md` обновлены под модель, где Directus доступен только администратору ресурса, а владельцы компаний работают без CMS.
- **Directus status endpoint**: `/api/integrations/directus/status` теперь возвращает активные SaaS-коллекции отдельно от legacy sync-коллекций, чтобы пользовательская и административная границы не смешивались.
- **Directus Studio menu для Plan B**: bootstrap активной SaaS-схемы теперь обновляет метаданные коллекций в Directus: `companies`, `company_owners`, `plans`, `company_limits` и `saas_metric_snapshots` остаются видимыми, а legacy operational-коллекции `vehicles`, `accident_cases`, `accident_participants`, `damages`, `photos`, `odometer_recognitions`, `plate_recognitions` и `fraud_checks` скрываются из меню Studio через `hidden: true` без удаления таблиц и данных.
- **Русская админская часть Directus**: активные SaaS-коллекции и поля Directus получили русские `translations`, подсказки, иконки, display templates и русские labels для dropdown-значений; bootstrap теперь обновляет метаданные уже существующих полей, а не только создает новые.
- **Seed тарифов и лимитов Directus**: добавлен repeatable seed `directus/scripts/seed-saas-data.mjs` и npm-команды `directus:seed:saas:dry`/`directus:seed:saas`; скрипт создает тарифы `pilot`, `standard`, `enterprise`, выдает Administrator policy CRUD-доступ к активным SaaS-коллекциям и создает `company_limits` только для существующих компаний без сиротских записей.
- **Relations тарифов и лимитов Directus**: bootstrap активной SaaS-схемы теперь приводит `company_owners.company_id` и `company_limits.company_id` к integer-связям на `companies.id`, автоматически создает Directus relations и безопасно пересоздает ошибочные пустые uuid-поля без удаления пользовательских данных.
- **Синхронизация тарифа компании в Directus seed**: если у существующей компании пустой `companies.plan_code`, `directus:seed:saas` проставляет `pilot`, чтобы карточка компании и `company_limits` были согласованы.
- **Лимиты компаний из CMS**: provisioning sync теперь подтягивает `company_limits` из Directus в локальную SQLite-таблицу `company_limits`; незаданные лимиты считаются безлимитными.
- **Enforcement SaaS-лимитов**: backend применяет `max_vehicles` к созданию/импорту техники и `max_users` к созданию пользователей компании; при превышении лимита возвращается `409` с понятным сообщением.
- **Enforcement feature flags тарифов**: backend применяет `ocr_enabled`, `accident_module_enabled` и `analytics_enabled` из `company_limits`: OCR endpoints, создание новых ДТП-осмотров, пользовательская аналитика и экспорт аналитики теперь возвращают `403`, если модуль отключен тарифом компании.
- **Лимиты в пользовательской панели**: добавлен `GET /api/company/usage` и блок "Тариф и доступные модули" в настройках компании; владельцы/менеджеры видят текущий тариф, остатки по технике/пользователям и доступность OCR, ДТП-осмотров и аналитики без упоминания CMS.
- **Feature flags в пользовательском UI**: добавлен общий frontend-хук для `GET /api/company/usage`; создание ДТП-осмотров блокируется в модальном запуске и форме нового осмотра при отключённом `accident_module_enabled`, а дашборд и профиль не запрашивают расширенную аналитику/экспорт при отключённом `analytics_enabled` и показывают понятное тарифное сообщение.
- **Стабильность backend smoke**: startup-timeout smoke-скриптов увеличен до 30 секунд, чтобы полный `npm --prefix backend run smoke` не падал флейком на медленном старте локального Node-сервера.
- **Smoke-тесты auth/isolation без фиктивных пользователей**: тесты, которые раньше подписывали JWT для несуществующих пользователей, переведены на реальные записи в test SQLite или admin-token, чтобы новый DB-backed auth guard оставался проверяемым.
- **Актуальная роль в web-меню**: `Layout` после загрузки сверяет текущего пользователя через `/auth/me`, чтобы меню не зависело только от устаревшего JWT payload; logout теперь ведет на `/login` без перезагрузки страницы.
- **Страница входа**: login-экран показывает понятную причину возврата (`expired`/`inactive`) и после повторного входа возвращает пользователя на исходную страницу через безопасный `next` path.
- **Экран входа mobile**: экран входа принимает сообщение о завершенной/отозванной сессии от глобального обработчика и показывает его пользователю перед повторным входом.

### Added
- **SaaS admin статистика**: добавлен admin-only endpoint `GET /api/admin/saas/stats` с глобальными агрегатами по всем компаниям: компании, владельцы, пользователи, техника, осмотры, дефекты, ДТП, фото, активность за 7 дней и health-индикаторы записей без владельца/company_id.
- **Страница `/saas-admin`**: добавлена web-страница администратора ресурса с карточками глобальных метрик, Chart.js-графиком активности компаний и таблицей breakdown по tenant-компаниям; пункт меню видит только роль `admin`.
- **Health-списки resource-admin**: `GET /api/admin/resource/stats` возвращает короткие списки компаний без активного владельца и без лимитов, а `/saas-admin` показывает их как сервисные health-индикаторы без перехода к операционным данным компаний.
- **Smoke-тест SaaS admin**: добавлен `backend/scripts/smoke-saas-admin.mjs` и команда `npm --prefix backend run smoke:saas-admin`; общий backend smoke теперь проверяет admin-доступ к глобальной статистике и отказ manager-роли.
- **Smoke-тест лимитов компаний**: `backend/scripts/smoke-company-limits.mjs` проверяет лимиты из встроенной таблицы `company_limits` и блокировку второй техники/второго пользователя без Directus sync.
- **Smoke-тест feature flags компаний**: `backend/scripts/smoke-company-features.mjs` проверяет backend-блокировки OCR/ДТП/аналитики и отображение флагов в resource-admin stats и пользовательском endpoint `GET /api/company/usage` без Directus sync.
- **Legacy operational schema Directus**: старый вариант operational-коллекций сохранен в `directus/schema/legacy-operational-schema.json` как историческая справка, но не используется активным bootstrap.

### Verified
- `node --check backend/src/routes/adminSaas.js`
- `node --check backend/src/routes/directus.js`
- `node --check backend/src/routes/odometer.js`
- `node --check backend/src/server.js`
- `node --check backend/scripts/smoke-saas-admin.mjs`
- `node --check backend/scripts/smoke-company-limits.mjs`
- `node --check backend/scripts/smoke-company-features.mjs`
- `node --check backend/scripts/smoke-directus-service.mjs`
- `node directus/scripts/bootstrap-schema.mjs --dry-run`
- `node directus/scripts/bootstrap-schema.mjs`
- Directus API check: active SaaS-коллекции видимы, legacy operational-коллекции имеют `meta.hidden === true`.
- Directus API check: active SaaS-коллекции и поля имеют русские `ru-RU`/`en-US` translations, а dropdown `companies.type` и `companies.status` показывает русские значения.
- `node --check directus/scripts/seed-saas-data.mjs`
- `npm run directus:seed:saas:dry`
- `npm run directus:seed:saas`
- Directus API check: `company_owners.company_id` и `company_limits.company_id` имеют тип `integer`, interface `select-dropdown-m2o` и relations на `companies.id`.
- Directus API check: dropdown `companies.plan_code` и `company_limits.plan_code` показывает нормальные русские значения `Пилот`, `Стандарт`, `Enterprise` без mojibake и placeholder-символов.
- Directus API check: `plans` содержит `pilot`, `standard`, `enterprise`; для компании `treelees`/`Трилис` создан `company_limits` по тарифу `pilot`, а `companies.plan_code` синхронизирован с `pilot`.
- Live backend provisioning check: `POST /api/integrations/directus/provisioning/sync` создал локальную компанию `1` / `Трилис` и подтянул `company_limits` по тарифу `pilot`; `GET /api/admin/saas/stats` показывает для нее лимиты `10` техники, `3` пользователя, OCR/ДТП включены, аналитика/API отключены.
- Live backend SaaS health check: `GET /api/admin/saas/stats` возвращает `companiesWithoutOwnerList` с компаниями `default` и `Трилис`, поэтому ресурсный админ видит, что владельцы ещё не назначены.
- `node --check backend/scripts/smoke-auth.mjs`
- `node --check backend/scripts/smoke-isolation.mjs`
- `node --check backend/scripts/smoke-owner-setup.mjs`
- `node --check backend/scripts/smoke-*.mjs`
- `npm --prefix backend run smoke:auth`
- `npm --prefix backend run smoke:isolation`
- `npm --prefix backend run smoke:owner-setup`
- `npm --prefix backend run smoke:saas-admin`
- `npm --prefix backend run smoke:company-limits`
- `npm --prefix backend run smoke:company-features`
- `npm --prefix backend run smoke:directus:service`
- `npm --prefix backend run smoke:directus`
- `npm --prefix backend run smoke`
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run verify`
- `npm --prefix web run lint`
- `npm --prefix web run build`
- Повторно после UI feature flags: `npm --prefix web run lint`
- Повторно после UI feature flags: `npm --prefix web run build`
- Повторно после UI feature flags: `npm --prefix backend run smoke:company-features`
- Повторно после сообщения о старом backend: `npm --prefix web run lint`
- Повторно после сообщения о старом backend: `npm --prefix web run build`
- Локальная проверка backend restart: `GET http://localhost:3001/api/company/usage` без токена теперь возвращает `401`, а не `404`.
- Runtime smoke: страница `/` открыта в Chrome через Playwright с JWT-role в `localStorage`; hydration errors не обнаружены.
- Runtime smoke: `/vehicles` открыт в Chrome с 100+ строками; после прокрутки `thead th` остается `position: sticky` на `y=0`, верхний элемент в viewport — `TH`, console errors отсутствуют.
- `npm run verify:launch`

---

## 2026-05-19

### Changed
- **Граница CMS и пользовательской панели**: Directus/CMS закреплен как внутренний инструмент администратора ресурса; из web-панели удалены навигация и экран управления компаниями, а настройки больше не показывают CMS/Directus-статус пользователям компаний.
- **Роль владельца компании**: добавлена роль `owner`; владелец компании управляет пользователями своей компании, а resource admin работает в отдельном сервисном контуре.
- **Жизненный цикл компаний вне user panel**: `POST/PUT/DELETE /api/companies` теперь возвращают `403`, чтобы компании создавались/удалялись только во внутреннем административном контуре, а не в пользовательской панели.
- **Directus-схема владельцев компаний**: MVP-схема Directus дополнена `company_owners` и `companies.slug`; документация ролей обновлена под модель `Resource Admin` + `Service Token` без доступа компаний к Directus Studio.
- **Provisioning владельцев из CMS**: добавлен admin-only endpoint `POST /api/integrations/directus/provisioning/sync`, который синхронизирует `companies`/`company_owners` из Directus в локальную auth-базу и выдает setup-ссылки владельцам компаний без хранения пароля в CMS.
- **Активация владельца компании**: добавлен пользовательский маршрут `/owner-setup`, где владелец компании задает пароль по setup-token и затем попадает в панель управления пользователями своей компании.
- **Одноразовые setup-ссылки владельца**: owner setup-token теперь подписывается отпечатком текущего password hash; после успешной установки пароля повторный POST /api/auth/owner-setup с тем же token отклоняется.

### Fixed
- **Tenant владельца после входа**: login теперь возвращает фактический `company_id` пользователя, чтобы владелец компании после `/owner-setup` попадал в свою компанию, а не в `default`.
- **Mobile P0 OCR + Expo**: активный Expo-клиент `mobile/` приведен к согласованным SDK 54 зависимостям, OCR-контракт номера/одометра описан через multipart-поле `photo` и существующие backend-ручки, а Android fallback API URL настроен на `10.0.2.2` вместо локального `localhost`.
- **Bootstrap Directus CMS**: `directus/scripts/bootstrap-schema.mjs` теперь преобразует тип `datetime` в `dateTime` для Directus 11, поэтому `npm run directus:bootstrap` корректно создает MVP-коллекции в новой локальной CMS.
- **Launch-аудит web-зависимостей**: запуск `npm --prefix web audit fix` убрал устаревшие уязвимые зависимости, для `postcss` добавлен npm `overrides`, а Next.js оставлен на совместимой версии без принудительного downgrade через `npm audit fix --force`; web/backend audit возвращает `found 0 vulnerabilities`.
- **Кодировка карточки осмотра**: восстановлены русские подписи, сообщения, чек-листы, печатная карточка ДТП и форма нового осмотра на странице `web/src/app/inspections/[id]/page.tsx`; также очищен общий словарь `web/src/lib/i18n.ts` от mojibake-строк и битых fallback-переводов.
- **Чистый web lint**: устранены оставшиеся предупреждения ESLint в web: удалены неиспользуемые импорты/переменные, очищены подписи `OdometerHistory`, зафиксированы намеренные one-shot загрузки данных и raw `<img>` для защищённых/внешних изображений.

### Added
- **Mobile runbook + trust gates**: добавлены `mobile/.env.example`, `mobile/README.md`, permissions для камеры/медиа/геолокации, mobile scripts `typecheck`, `install:check`, `doctor`, `audit:moderate`, `verify`; корневые `verify`/`verify:launch` и CI теперь учитывают проверки mobile-приложения.

### Verified
- `npm --prefix backend run smoke`
- `npm --prefix backend run smoke:owner-setup`
- `npm --prefix mobile run audit:moderate`
- `npm --prefix mobile run verify`
- Локальная проверка `GET /api/integrations/directus/status` вернула `configured: true`
- `npm run directus:bootstrap:dry`
- `npm run directus:bootstrap`
- `npm --prefix web audit --audit-level=moderate`
- `npm run verify:launch`
- `npm run verify`
- `npm --prefix web run lint`
- `npm --prefix web run build`

---

## 2026-05-18

### Added
- **Защищённая выдача фото осмотров**: загруженные изображения теперь отдаются через авторизованный backend endpoint с проверкой принадлежности к компании вместо публичной раздачи файлов.
- **Обязательные фото осмотра**: добавлены типы фото осмотра, backend-проверка обязательных снимков перед завершением и web-интерфейс для загрузки/удаления таких фото.
- **Smoke-покрытие критических сценариев**: backend smoke дополнен проверками обязательных фото, tenant-isolation для компаний и недоступности чужих/анонимных фото.

### Changed
- **Модель доступа к компаниям**: добавлена роль `admin`; обычный manager теперь работает только в рамках своей компании, а создание/редактирование/удаление компаний доступно только администратору.
- **Мобильный поток осмотра**: активный Expo-клиент `mobile/` переведён с локального mock-сценария на реальный backend-flow: создание осмотра, загрузка обязательных фото по требованиям API, ввод ДТП-данных до старта осмотра, сохранение чек-листа, загрузка фото дефектов и явное завершение через backend.
- **Графики дашборда**: web-дашборд переведён на `Chart.js`: добавлены график динамики осмотров по дням, donut-диаграмма техники по статусу, bar-chart осмотров по типу и горизонтальные bar charts для региональной аналитики техники, осмотров и дефектов с поддержкой светлой/тёмной темы через существующие design tokens.

### Fixed
- **Повторное сохранение осмотра**: дефекты чек-листа больше не пересоздаются при каждом сохранении, поэтому уже прикреплённые фото, история и идентификатор дефекта сохраняются при повторном редактировании.
- **Фото в mobile**: клиент больше не держит собственный устаревший список обязательных фото, загружает снимки по фактическим backend-требованиям и передаёт реальные `uri` файлов в multipart-upload вместо data URI.
- **Кодировка вкладки компаний**: восстановлены русские подписи страницы компаний, формы и действий, которые отображались mojibake-строками вместо нормального текста.
- **Фиксация левого меню**: сайдбар web-интерфейса теперь остаётся на месте при прокрутке страниц и занимает всю высоту окна.
- **Загрузка списка техники**: вместо перехода между страницами список техники теперь постепенно раскрывается кнопкой `Загрузить ещё`, сохраняя уже показанные записи на экране.
- **Липкие заголовки таблиц**: на страницах со списками заголовки таблиц теперь надёжно остаются у верхней границы окна после прокрутки до них, а строки продолжают прокручиваться дальше.

### Verified
- `npm --prefix backend run smoke`
- `.\mobile\node_modules\.bin\tsc.cmd -p .\mobile\tsconfig.json --noEmit`
- `npm --prefix web run lint`
- `npm --prefix web run build`

---

## 2026-05-07

### Changed
- **Directus accident case upsert**: повторный `/api/integrations/directus/inspections/:id/sync` теперь ищет `accident_cases` по стабильному `case_number = inspection-<id>` и обновляет существующую карточку, а не всегда создает новую. Дочерние `damages` и `photos` остаются append-only до введения стабильных внешних ключей.
- **Directus child upsert**: в MVP-схему и sync payload добавлены `source_inspection_id`, `source_defect_id` и `source_photo_id`; повторный sync теперь обновляет `damages` и `photos` по стабильным source-ключам вместо append-only дублей.
- **Directus service smoke**: добавлен offline smoke `backend/scripts/smoke-directus-service.mjs` с mocked `fetch`, который проверяет create/update ветки upsert для `accident_cases`, `damages` и `photos` без запущенного Directus.
- **Directus только через backend**: удален неиспользуемый frontend Directus SDK-клиент и `NEXT_PUBLIC_DIRECTUS_URL` из web env-примера. Web продолжает показывать статус CMS через backend endpoint, без прямого доступа к Directus и без service token во frontend bundle.
- **Импорт техники из Excel**: уязвимый `xlsx` заменен на `exceljs`; импорт `.xlsx/.xls` в настройках сохранен, а high-risk SheetJS dependency удалена из web dependency tree.

### Fixed
- **Изоляция smoke-тестов SQLite**: backend теперь уважает `DATABASE_PATH`, а smoke-скрипты запускают сервер на временных `.tmp-smoke/*.sqlite` базах и удаляют их после проверки. Повторные smoke-запуски больше не загрязняют основную `backend/src/database.sqlite`.
- **CORS env example**: `backend/.env.example` приведен к фактическому имени переменной `CORS_ORIGINS` и включает стандартный web-порт `3002`.
- **Web lint blockers**: исправлены блокирующие ESLint errors перед запуском: `next.config` переведен на ESM, убраны `any` в API/e2e местах, устранены sync `setState` в эффектах темы/локали и неэкранированные JSX-кавычки.

### Verified
- `node --check backend/src/services/directus.js`
- `node --check backend/src/routes/directus.js`
- `node --check backend/src/db.js`
- `node --check backend/scripts/smoke-*.mjs`
- `npm --prefix backend run smoke:directus:service`
- `npm --prefix backend run smoke:directus`
- `npm --prefix backend run smoke`
- `npm --prefix web run lint` (остаются warnings, без errors)
- `npm --prefix web run build`
- `npm --prefix web audit --audit-level=moderate` (остается только moderate advisory `postcss` внутри текущего `next`; `npm audit fix --force` предлагает несовместимый downgrade Next)
- `npm run verify`

---

## 2026-05-06

### Changed
- **Directus CMS/Data Studio слой**: добавлена изолированная папка `directus/` с Docker Compose для Directus + PostgreSQL, env-примером, описанием коллекций, ролей и стартовых статусов. Directus подключается как отдельный CMS/Data Studio слой рядом с текущим backend, без замены Express + SQLite API.
- **Directus integration helpers**: добавлен backend helper `backend/src/services/directus.js` для server-to-server REST-запросов в Directus и web helper `web/src/lib/directus.ts` на `@directus/sdk` для чтения `companies`, `vehicles` и `accident_cases`.
- **Directus sync endpoints**: добавлены опциональные backend endpoints `/api/integrations/directus/status`, `/preview` и `/sync` для безопасной проверки payload и ручной синхронизации ДТП-осмотра в Directus без автоматического вмешательства в основной поток.
- **Directus smoke coverage**: добавлен `backend/scripts/smoke-directus.mjs` и npm script `smoke:directus`; общий backend smoke теперь проверяет status/preview Directus-интеграции без требования запущенного Directus.
- **Directus status в настройках**: в web-настройки добавлена карточка Directus CMS для менеджера/администратора с состоянием backend-интеграции, URL и списком ожидаемых коллекций без передачи service token во frontend.
- **Directus schema bootstrap**: добавлены `directus/schema/mvp-schema.json` и `directus/scripts/bootstrap-schema.mjs` для создания MVP-коллекций и полей после первого запуска Directus без удаления существующих данных.
- **Directus bootstrap dry-run**: bootstrap-схема получила `--dry-run`/`--check` режим локальной валидации manifest без подключения к Directus; в корень проекта добавлены команды `directus:config`, `directus:bootstrap` и `directus:bootstrap:dry`.
- **Документация Directus**: добавлен `docs/directus-cms.md`, обновлены env-примеры backend/web и README с инструкциями запуска `cd directus && docker compose up -d`.
- **Идентификация техники по госномеру**: QR-код техники удален из UI и API-потока. Колонка QR-кода убрана из списка техники и настроек столбцов, поле удалено из форм добавления/редактирования и карточки техники, backend больше не принимает и не записывает `qr_code` при создании/обновлении техники.
- **SQLite-схема техники**: добавлена миграция старой базы, которая физически удаляет legacy-колонку `vehicles.qr_code` с сохранением номеро��, названий, статусов, регионов и дат техники.
- **Карточка осмотра в web**: страница `web/src/app/inspections/[id]/page.tsx` приведена к читаемому русскому UI. Разделены блоки времени осмотра, данных ДТП, одометра, чек-листа, фото дефектов и сводки дефектов.
- **Темная тема и цветовые токены web**: добавлен единый файл `web/src/styles/tokens.css` с semantic design tokens, совместимостью со старыми переменными и базовыми helper-классами для card/button/input/badge/alert/progress. `Layout` и `ThemeSwitcher` переведены на токены вместо разрозненных прямых цветов.
- **Настройки регионов техники**: блок регионов в `web/src/app/settings/page.tsx` переработан без внутренней прокрутки. В списке отображаются только регионы с привязанной техникой, добавление идет в справочник, редактирование переименовывает регион у связанной техники, удаление отвязывает технику от региона.
- **Слияние регионов при редактировании**: если регион переименовывают в уже существующий, например `Moscow` в `Москва`, техника переносится в целевой регион, а исходный регион удаляется.
- **Дашборд web**: первая страница переписана без битой кодировки, с русскими подписями, токенизированными карточками, progress bar, уведомлениями, экспортом CSV и состояниями загрузки/ошибки.
- **Журнал осмотров web**: список осмотров переписан без битой кодировки, с русскими фильтрами, токенизированной таблицей, статусами типов осмотров, датами ДТП и действиями перехода в осмотр/дефекты.
- **Список техники web**: экран техники переведен на semantic-токены, нормальные русские подписи и единые статусы. Сохранены поиск, фильтры по статусу/региону, настройка столбцов, добавление/редактирование, удаление и быстрый запуск осмотра.
- **Карточка техники web**: страница `web/src/app/vehicles/[id]/page.tsx` приведена к единому русскому UI на токенах. Сохранены сводные метрики, история осмотров, одометр, дефекты с фото, история статуса и модальное изменение статуса техники.
- **Раздел дефектов web**: список дефектов и карточка дефекта переведены на общие semantic-токены. Сохранены фильтры по региону, типу осмотра, фото/описанию, связи с осмотром и техникой, ДТП-контекст, фото и история статуса.
- **Создание техники web**: форма `web/src/app/vehicles/new/page.tsx` переведена на общие токены, добавлена явная подсказка по разрешенным буквам российских госномеров, предпросмотр кириллической нормализации и выбор региона только ��з справочника.

### Fixed
- **Проваливание в дефекты из осмотра**: для выявленных дефектов добавлены ссылки на карточку дефекта, отображение времени фиксации, фото и контекст ДТП.
- **Данные ДТП в осмотре**: для ДТП-осмотров явно отображаются и сохраняются время ДТП, место ДТП и время самого осмотра; добавлена печатная карточка ДТП.
- **API регионов**: `/api/regions` возвращает только используемые регионы по умолчанию и поддерживает `includeEmpty=1` для выпадающих списков выбора региона в карточках техники.
- **История дефектов в карточке техники**: загрузка истории дефекта теперь идет через backend base URL, а не относительный frontend-путь `/api/...`, поэтому просмотр истории работает при отдельном порте API.
- **Редактирование регионов в настройках**: frontend передает старое имя региона при сох��анении, а backend умеет восстановить регион по этому имени, если id из UI устарел или отсутствует в таблице `regions`. Это убирает 404 при `PUT /api/regions/:id` и сохраняет перенос техники при переименовании/слиянии.
- **Список регионов в модалках техники**: раздел `Техника` больше не запрашивает `includeEmpty=1` для фильтра и форм добавления/редактирования, поэтому в выпадающих списках показываются только текущие используемые регионы из настроек, а не весь расширенный справочник.

### Verified
- `docker compose -f directus/docker-compose.yml --env-file directus/.env.example config`
- Directus backend endpoints checked with a local spawned server: `/api/integrations/directus/status` and `/api/integrations/directus/inspections/:id/preview`
- `node --check directus/scripts/bootstrap-schema.mjs`
- `npm run directus:bootstrap:dry`
- `npm --prefix backend run smoke:directus`
- `npm --prefix web run build`
- `npm run verify`

---

## [1.0.0] - 2024-05-XX

### Added
- Initial release of Audit Tech application.
- Vehicle inspection and defect tracking system.
- QR code based vehicle identification.
- Multi-role user support.
- Photo documentation for inspections and defects.
- Odometer tracking.
- Analytics dashboard.
