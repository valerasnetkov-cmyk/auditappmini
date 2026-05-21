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
| `UPLOAD_DIR` | Постоянный каталог фото, не внутри временной release-папки. |
| `BACKUP_DIR` | Постоянный каталог локальных backup-снимков. |
| `SENSITIVE_RATE_LIMIT_WINDOW_MS` / `SENSITIVE_RATE_LIMIT_MAX` | Общий лимит на чувствительные endpoint входа/setup. |
| `AUTH_ACCOUNT_RATE_LIMIT_MAX` | Дополнительный лимит на попытки входа/setup по конкретному аккаунту/идентификатору. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Первичный админ SaaS, если нужен автосид при первом старте. |
| `WEB_APP_URL` | Публичный URL web-приложения для owner setup ссылок. |

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
```

После изменения `mobile/.env.production` production build нужно пересобрать, потому что `EXPO_PUBLIC_*` значения попадают в bundle.

## 10. Launch gate

Перед публикацией новой версии:

```powershell
npm run verify:launch
npm run doctor:production
```

`verify:launch` проверяет backend smoke, web build, mobile verify, изолированный Chromium E2E, launch doctor для backend/web/mobile и audit-проверки. `doctor:production` отдельно валидирует реальные production-секреты, persistent paths и публичные API URL.

## 11. Backup gate

Перед миграцией пилотных данных и сразу после неё:

```powershell
npm run backup:local
npm run backup:verify
```

`backup:verify` открывает SQLite из последнего backup, запускает `PRAGMA integrity_check`, считает ключевые таблицы и проверяет uploads. Подробный порядок восстановления описан в `docs/backup-restore.md`.
