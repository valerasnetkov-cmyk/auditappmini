# First production start

Короткий операторский порядок для первого запуска Auditmini на production/staging сервере. Полный релизный порядок остаётся в `docs/release-runbook.md`, а этот файл нужен как быстрый checklist перед реальным стартом сервиса.

Production server command cheat sheet: `docs/production-server-commands.md`.
Legacy mobile-app removal record: `docs/mobile-app-retirement.md`.

Интерактивную версию checklist можно вывести командой:

```powershell
npm run release:first-start
```

Машиночитаемый JSON:

```powershell
npm run release:first-start -- --json
```

Команда read-only: она не запускает сервисы, не создаёт backup и не выводит значения production-секретов.

## 1. Подготовить production env

Создайте приватные production env-файлы или настройте те же значения в secret manager / панели хостинга:

```powershell
copy backend/.env.production.example backend/.env.production
copy web/.env.production.example web/.env.production
copy mobile/.env.production.example mobile/.env.production
```

Критично проверить:

- `JWT_SECRET` уникальный и длинный;
- `PUBLIC_REGISTRATION_ENABLED=false`;
- `TRUST_PROXY` задан явно;
- `CORS_ORIGINS` указывает реальные web origin;
- `DATABASE_PATH`, `UPLOAD_DIR`, `BACKUP_DIR` находятся на persistent storage;
- `REQUEST_ID_HEADER=x-request-id`, `ACCESS_LOG_FORMAT=json`, `ACCESS_LOG_SKIP_PATHS=/health,/api/health`;
- web/mobile API URL указывают на публичный HTTPS API.

## 2. Пройти code gate

До публикации артефактов:

```powershell
npm run mobile:status
npm run verify:launch
```

Сохраните terminal output или ссылку на CI job.

## 3. Проверить production env на сервере

На production/staging host:

```powershell
npm run doctor:production
```

Ожидаемый результат: `ok=true`, `errors=[]`. Warnings перед реальным стартом лучше разобрать, а не игнорировать.

## 4. Сделать backup перед стартом/миграцией

```powershell
npm run backup:local
npm run backup:verify
```

Сохраните путь к `manifest.json` и вывод `backup:verify`.

## 5. Включить ротацию PM2-логов

```powershell
npm --prefix backend run pm2:logrotate:install
npm --prefix backend run pm2:logrotate:configure
pm2 conf pm2-logrotate
```

Не включайте PM2 timestamp prefix поверх backend JSON access-log: backend уже пишет `timestamp` и `requestId` внутри строки.

## 6. Запустить backend и web

Backend:

```powershell
npm --prefix backend run pm2:start
```

Web:

```powershell
npm --prefix web run doctor:production
npm --prefix web run build
npm --prefix web run start
```

Если web запускается отдельным process manager / hosting provider, используйте production-команду `next start -p 3002`, а не `next dev`.

## 7. Проверить health/readiness и диагностику

```powershell
Invoke-RestMethod https://api.<project-domain>/health
Invoke-RestMethod https://api.<project-domain>/api/health/ready
```

Затем проверьте один рабочий API-запрос из web/mobile:

- ответ содержит `X-Request-Id`;
- reverse proxy логирует тот же request id;
- backend access-log пишет тот же request id для рабочего API-запроса;
- health-check пути из `ACCESS_LOG_SKIP_PATHS` могут отсутствовать в backend access-log — это нормально.

## 8. Пройти ручной UAT

Минимум:

- вход admin / owner / manager / inspector;
- создание компании через CMS/admin contour;
- создание owner и прохождение owner setup;
- отсутствие публичной саморегистрации в production;
- создание техники и импорт техники;
- quick/scheduled/accident inspection;
- обязательные фото и фото дефекта;
- закрытие и переоткрытие дефекта;
- фильтр дефектов по выбранной технике;
- dashboard/analytics;
- пользователь другой компании не видит чужие данные.

## 9. Сохранить release evidence

Перед сохранением evidence полезно вывести общий readiness report:

```powershell
npm run release:readiness
```

Если в отчёте есть `blockers`, старт откладывается. Если остались только `release-actions` и `accepted-pilot-risks`, их нужно явно пройти/принять и приложить к release notes.

После успешных проверок:

```powershell
npm run release:evidence
```

Файл появится в `release-evidence/`, не попадёт в Git и должен храниться вместе с release notes / deployment evidence.
