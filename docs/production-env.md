# Production environment runbook

Этот runbook фиксирует минимальный production-контракт для первого пилотного запуска Auditmini: backend API, web-панель и active Expo mobile client.

Полный порядок релиза описан в `docs/release-runbook.md`.

## 1. Создайте backend production env

Используйте шаблон `backend/.env.production.example`.

```powershell
Copy-Item backend/.env.production.example backend/.env.production
```

Файл `backend/.env.production` не должен попадать в Git. Его можно заменить переменными окружения в PM2/systemd/панели хостинга — главное, чтобы итоговые значения совпадали с контрактом ниже.

## 2. Создайте web production env

Используйте шаблон `web/.env.production.example`.

```powershell
Copy-Item web/.env.production.example web/.env.production
```

Для production web значение должно указывать на публичный backend API:

```dotenv
NEXT_PUBLIC_API_URL=https://api.<project-domain>/api
```

Важно: `NEXT_PUBLIC_API_URL` встраивается в frontend bundle и виден браузеру. Не храните здесь секреты.

## 3. Создайте mobile production env

Используйте шаблон `mobile/.env.production.example`.

```powershell
Copy-Item mobile/.env.production.example mobile/.env.production
```

Для production mobile значение также должно указывать на публичный backend API:

```dotenv
EXPO_PUBLIC_API_URL=https://api.<project-domain>/api
```

Для локальной разработки можно использовать `10.0.2.2`, `localhost` или LAN IP, но production build не должен уходить в emulator/локальную сеть.

## 4. Обязательные backend значения

| Переменная | Назначение |
| --- | --- |
| `NODE_ENV=production` | Включает production-guard backend. |
| `TRUST_PROXY` | Явно задаёт доверенный reverse proxy для корректного `req.ip` и rate limit; обычно `1` за одним HTTPS proxy. |
| `SECURITY_HSTS_ENABLED` / `SECURITY_HSTS_MAX_AGE` | Включает HSTS-заголовок для production API. |
| `GRACEFUL_SHUTDOWN_TIMEOUT_MS` | Таймаут корректного завершения HTTP-сервера при `SIGTERM`/`SIGINT` перед принудительным закрытием соединений. |
| `REQUEST_ID_HEADER` | Header для request id, по умолчанию `x-request-id`; backend возвращает его в каждом ответе. |
| `ACCESS_LOG_FORMAT` / `ACCESS_LOG_SLOW_MS` / `ACCESS_LOG_SKIP_PATHS` | Формат access logs (`json`, `text`, `off`), порог slow request и comma-separated список путей, которые не нужно писать в access log. Для production рекомендуется `json` и пропуск частых health-check путей. |
| `JWT_SECRET` | Длинный уникальный секрет JWT, минимум 32 символа. |
| `PUBLIC_REGISTRATION_ENABLED=false` | Запрещает публичную саморегистрацию; пользователей компании создаёт владелец компании. |
| `CORS_ORIGINS` | Реальный origin web-приложения, без `*`. |
| `DATABASE_PATH` | Постоянный путь к SQLite базе для пилота. |
| `STORAGE_DRIVER=local` | Текущий storage driver для пилота. S3-compatible drivers добавляются позже без смены URL/tenant contracts. |
| `UPLOAD_DIR` | Постоянный каталог фото, не внутри временной release-папки. |
| `MAX_IMAGE_PIXELS` | Максимальное число пикселей в исходном фото; защищает обработку изображений от слишком больших файлов. |
| `BACKUP_DIR` | Постоянный каталог локальных backup-снимков. |
| `OCR_ODOMETER_PROVIDER` | Провайдер OCR одометра: `mock` сохраняет manual-confirmation placeholder, `tesseract-cli` включает локальный Tesseract CLI. |
| `TESSERACT_CMD` / `TESSERACT_TIMEOUT_MS` | Команда Tesseract и timeout распознавания. Проверяются production doctor только при `OCR_ODOMETER_PROVIDER=tesseract-cli`. |
| `SECURITY_CSP` | CSP для API-ответов; по умолчанию запрещает загрузку ресурсов, формы и встраивание во фрейм. |
| `SECURITY_CROSS_ORIGIN_OPENER_POLICY` | COOP-заголовок, по умолчанию `same-origin`. |
| `SECURITY_CROSS_ORIGIN_RESOURCE_POLICY` | CORP-заголовок, по умолчанию `same-site`. |
| `AUTH_COOKIE_NAME` / `AUTH_COOKIE_MAX_AGE_SECONDS` | Имя и срок жизни httpOnly session-cookie для web-клиента. |
| `AUTH_COOKIE_SECURE` / `AUTH_COOKIE_SAME_SITE` | Атрибуты auth-cookie; в production `AUTH_COOKIE_SECURE=true`, для `SameSite=None` secure обязателен. |
| `SENSITIVE_RATE_LIMIT_WINDOW_MS` / `SENSITIVE_RATE_LIMIT_MAX` | Общий лимит на чувствительные endpoint входа/setup. |
| `AUTH_ACCOUNT_RATE_LIMIT_MAX` | Дополнительный лимит на попытки входа/setup по конкретному аккаунту/идентификатору. |
| `PILOT_REQUEST_RATE_LIMIT_WINDOW_MS` / `PILOT_REQUEST_RATE_LIMIT_MAX` | Отдельный IP-лимит публичной формы заявки на пилот; по умолчанию 5 отправок за 30 минут. |
| `REDIS_URL` | **Рекомендуется для production** (Epic 3.2). Формат `redis://[:password@]host:port[/db]`. Без `REDIS_URL` rate-limit работает только в in-memory режиме (per-replica, обходится при multi-replica). С заданным `REDIS_URL` rate-limit становится распределённым (atomic INCR+EXPIRE в Lua-скрипте). В production при заданном `REDIS_URL` endpoint `/api/health/ready` возвращает `503`, если Redis недоступен. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Первичный админ SaaS, если нужен автосид при первом старте. `ADMIN_PASSWORD=admin123` допустим только локально; production doctor блокирует demo/placeholder значения. |
| `PUBLIC_DEMO_ENABLED` / `PUBLIC_DEMO_PASSWORD` | Публичный read-only demo contour для `/demo`. Для `auditavto.ru` должен быть включён: `PUBLIC_DEMO_ENABLED=true`, пароль не короче 12 символов. Backend при старте provision-ит тестовую компанию `demo`. |
| `WEB_APP_URL` | Публичный HTTPS URL web-приложения для owner setup ссылок и QR-проверки PDF-отчётов. В production не должен быть localhost/LAN/dev-host. |
| `PUBLIC_REPORT_TOKEN_TTL_DAYS` | Срок жизни публичной ссылки проверки отчёта в днях; по умолчанию `30`, значение `0` делает ссылку бессрочной. Полный PDF публично не отдаётся без явного opt-in. |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | Optional backend Sentry-ready placeholders. Пустые значения допустимы; runtime и smoke не должны падать без Sentry. |
| `TELEGRAM_ALERTS_ENABLED` / `TELEGRAM_ALERTS_DRY_RUN` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ALERT_CHAT_ID` | Optional Telegram alerts. Перед включением live-отправки выполните `npm --prefix backend run alerts:dry-run`; секреты не фиксируются в release evidence. |

Сгенерировать `JWT_SECRET` можно так:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 5. Подготовьте persistent storage

Для Windows-пилота пример может выглядеть так:

```powershell
New-Item -ItemType Directory -Force C:\Auditmini\data, C:\Auditmini\uploads, C:\Auditmini\backups
```

После этого укажите абсолютные пути:

```dotenv
DATABASE_PATH=C:\Auditmini\data\database.sqlite
UPLOAD_DIR=C:\Auditmini\uploads
BACKUP_DIR=C:\Auditmini\backups
```

Если включаете OCR одометра через Tesseract, установите Tesseract 5.x и
traineddata на backend host и проверьте бинарь до старта:

```powershell
tesseract --version
npm --prefix backend run smoke:ocr:tesseract
```

Production env:

```dotenv
OCR_ODOMETER_PROVIDER=tesseract-cli
TESSERACT_CMD=tesseract
TESSERACT_TIMEOUT_MS=10000
```

Если Tesseract не готов на pilot/staging, оставьте `OCR_ODOMETER_PROVIDER=mock`:
endpoint продолжит требовать ручное подтверждение без автоматического значения.

## 6. Проверьте production env до старта

Если используются стандартные файлы `backend/.env.production`, `web/.env.production` и `mobile/.env.production`:

```powershell
npm run doctor:production
```

Если production-переменные лежат в другом файле:

```powershell
node backend/scripts/launch-doctor.mjs --production --doctor-env-file C:\Auditmini\secrets\backend.env
```

Web/mobile env можно проверить отдельно:

```powershell
npm --prefix web run doctor:production
npm --prefix mobile run doctor:production
```

Команда должна завершиться без `errors`. `warnings` допустимы только если вы сознательно проверяете ещё не созданные каталоги, но перед реальным стартом каталоги лучше создать заранее.

## 7. Запуск backend

Предпочтительно передавать production-переменные через процесс-менеджер или секретное хранилище хостинга.

Для локальной проверки с `.env.production` можно запустить backend так:

```powershell
cd backend
node -r dotenv/config src/server.js dotenv_config_path=.env.production
```

Для PM2 положите секреты в `backend/.env.production` или убедитесь, что production-переменные доступны процессу PM2. `backend/ecosystem.config.cjs` автоматически подхватывает `backend/.env.production`, если файл существует.

```powershell
npm --prefix backend run pm2:start
```

Для хранения журналов PM2 включите ротацию перед длительным пилотом:

```powershell
npm --prefix backend run pm2:logrotate:install
npm --prefix backend run pm2:logrotate:configure
pm2 conf pm2-logrotate
```

Рекомендуемые значения в script: размер файла `20M`, хранение `14` архивов и сжатие старых логов. Backend access-log уже содержит `timestamp` и `requestId`, поэтому PM2 timestamp prefix включать не нужно — он может мешать парсингу JSON-логов.

## 8. Запуск web

Перед build убедитесь, что production `NEXT_PUBLIC_API_URL` уже задан, потому что Next.js встраивает public env в сборку:

```powershell
npm --prefix web run doctor:production
npm --prefix web run build
npm --prefix web run start
```

## 9. Mobile production build

Перед production build мобильного приложения убедитесь, что `EXPO_PUBLIC_API_URL` указывает на публичный HTTPS API:

```powershell
npm --prefix mobile run doctor:production
npm --prefix mobile run verify
npm --prefix mobile run eas:readiness
```

Для EAS cloud build настройте `EXPO_PUBLIC_API_URL` в EAS environment variables. Локальный `mobile/.env.production` остаётся обязательным для `doctor:production`, но облачная сборка должна получить тот же URL через EAS.

```powershell
npm run mobile:eas:preview:android
# или
npm run mobile:eas:production
```

После изменения `mobile/.env.production` production build нужно пересобрать, потому что `EXPO_PUBLIC_*` значения попадают в bundle.

## 10. Launch gate

Перед публикацией новой версии:

```powershell
npm run verify:launch
npm run doctor:production
```

`verify:launch` проверяет backend smoke, web build, mobile verify, изолированный Chromium E2E, launch doctor для backend/web/mobile и audit-проверки. `doctor:production` отдельно валидирует реальные production-секреты, persistent paths и публичные API URL.

Перед пилотным deploy также проверьте observability dry-run:

```powershell
npm --prefix backend run alerts:dry-run
```

## 11. Backup gate

Перед миграцией пилотных данных и сразу после неё:

```powershell
npm run backup:local
npm run backup:verify
```

`backup:verify` открывает SQLite из последнего backup, запускает `PRAGMA integrity_check`, считает ключевые таблицы и проверяет uploads. Подробный порядок восстановления описан в `docs/backup-restore.md`.
