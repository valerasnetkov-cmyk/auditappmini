# Changelog

## Unreleased

### Fixed
- **Безопасность web-зависимостей**: `next` и `eslint-config-next` обновлены до 16.2.6, закрыт high-risk advisory из `npm audit` для Next.js.
- **Изоляция техники по компании**: основные endpoint техники теперь фильтруют список, карточку, дефекты, создание, импорт, редактирование и удаление по `company_id` текущего пользователя.
- **Права администратора**: backend guard для manager-операций теперь также пропускает роль `admin`, чтобы администратор мог управлять справочниками, техникой и компаниями.
- **Защита company API**: `/api/companies` закрыт manager/admin-доступом вместо доступа для любого авторизованного пользователя.
- **Ограничения загрузок**: для `multer` добавлены лимит размера файла и whitelist image MIME-типов; JSON body limit вынесен в `JSON_BODY_LIMIT`.
- **Изоляция осмотров и дефектов**: создание, просмотр, закрытие/переоткрытие, история, фото и аналитика дефектов дополнительно привязаны к компании текущего пользователя.
- **Данные дашборда и уведомлений**: статистика, уведомления и агрегаты аналитики теперь не смешивают технику разных компаний.
- **Изоляция пользователей и MFA**: просмотр, редактирование, удаление пользователей и MFA-операции ограничены компанией текущего manager/admin или самим пользователем.
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
- **Управление регионами**: CRUD операции в Settings для manager/admin. Endpoint `GET/POST/PUT/DELETE /api/regions` с поддержкой слияния регионов при переименовании (техника переносится в целевой регион).

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
- **Production env шаблоны**: добавлены `backend/.env.production.example`, `web/.env.production.example` и `mobile/.env.production.example` с обязательными production-переменными для JWT, CORS, persistent storage, публичных API URL, owner setup и опциональной Directus-интеграции.
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

### Changed
- **Mobile doctor без зависимости от внешней сети**: `mobile/scripts/expo-doctor-safe.mjs` запускает Expo Doctor с `EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS=1` и отключённой React Native Directory network-проверкой; строгий сетевой режим оставлен отдельной командой `npm --prefix mobile run doctor:online`.
- **Launch doctor с явным env-файлом**: `backend/scripts/launch-doctor.mjs` теперь поддерживает `--production`, `--mode`, `--doctor-env-file` и `LAUNCH_ENV_FILE`, показывает `envFileExists` и отлавливает placeholder-значения в JWT, CORS, admin/password и `WEB_APP_URL`.
- **Web launch doctor**: `web/scripts/launch-doctor.mjs` получил `--production`, `--mode`, `--doctor-env-file`, `LAUNCH_ENV_FILE`, проверку placeholder URL и HTTPS-требование для `NEXT_PUBLIC_API_URL` в production.
- **Root launch doctor**: `npm run doctor:launch` и `npm run verify:launch` теперь проверяют backend, web и mobile env-контуры, а не только backend.
- **PM2 production env**: `backend/ecosystem.config.cjs` автоматически подхватывает `backend/.env.production`, если он есть, и пробрасывает production-секреты/лимиты/Directus-настройки в backend-процесс.
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
- **Health-списки SaaS-админа**: `GET /api/admin/saas/stats` теперь возвращает короткие списки компаний без активного владельца и без лимитов, а `/saas-admin` показывает их с понятным действием: создать владельца в `company_owners` или синхронизировать `company_limits`.
- **Smoke-тест SaaS admin**: добавлен `backend/scripts/smoke-saas-admin.mjs` и команда `npm --prefix backend run smoke:saas-admin`; общий backend smoke теперь проверяет admin-доступ к глобальной статистике и отказ manager-роли.
- **Smoke-тест лимитов компаний**: добавлен `backend/scripts/smoke-company-limits.mjs`, который через mocked Directus с integer company id синхронизирует лимиты и проверяет блокировку второй техники/второго пользователя.
- **Smoke-тест feature flags компаний**: добавлен `backend/scripts/smoke-company-features.mjs`, который через mocked Directus отключает OCR/ДТП/аналитику и проверяет backend-блокировки, а также отображение флагов в SaaS admin stats и пользовательском endpoint `GET /api/company/usage`.
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
- **Роль владельца компании**: добавлена роль `owner`; владелец компании и `admin` могут управлять пользователями своей компании, но создавать/назначать через пользовательскую панель можно только роли `manager` и `inspector`.
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
