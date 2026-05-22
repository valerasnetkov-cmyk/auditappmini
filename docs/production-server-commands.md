# Production server commands

Короткая шпаргалка команд для production/staging сервера. Здесь нет секретов и нет значений реальных доменов — перед запуском замените placeholders на значения окружения.

Полные документы:

- `docs/production-env.md`
- `docs/first-production-start.md`
- `docs/release-runbook.md`
- `docs/backup-restore.md`

## 1. Проверить приватные env

Production env-файлы не должны попадать в Git. На сервере они должны быть созданы вручную или заменены secret manager значениями:

```powershell
Test-Path backend/.env.production
Test-Path web/.env.production
Test-Path mobile/.env.production
```

Если файлов нет, создайте их из example-шаблонов и заполните реальные значения:

```powershell
Copy-Item backend/.env.production.example backend/.env.production
Copy-Item web/.env.production.example web/.env.production
Copy-Item mobile/.env.production.example mobile/.env.production
```

## 2. Проверить production env

```powershell
npm run doctor:production
```

Ожидаемо: `ok=true`, `errors=[]`.

## 3. Проверить код и активные контуры

```powershell
npm run mobile:status
npm run verify:launch
npm --prefix backend audit --audit-level=moderate
npm --prefix web audit --audit-level=moderate
npm --prefix mobile audit --audit-level=moderate
```

`mobile/` — активный мобильный контур. `mobile-app/` — legacy и не должен участвовать в production, пока отдельно не обновлён или не удалён.

## 4. Сделать backup перед стартом/миграцией

```powershell
npm run backup:local
npm run backup:verify
```

Сохраните путь к backup manifest и вывод verify-команды в release evidence.

## 5. Подготовить PM2 log rotation

```powershell
npm --prefix backend run pm2:logrotate:install
npm --prefix backend run pm2:logrotate:configure
pm2 conf pm2-logrotate
```

Не включайте timestamp prefix PM2 поверх backend JSON access-log: backend уже пишет `timestamp` и `requestId`.

## 6. Запустить backend

```powershell
npm --prefix backend run pm2:start
pm2 status
npm --prefix backend run pm2:logs
```

При обновлении backend:

```powershell
npm --prefix backend run pm2:restart
pm2 status
```

Backend должен получать `SIGTERM`/`SIGINT` и иметь минимум `GRACEFUL_SHUTDOWN_TIMEOUT_MS` до принудительного завершения.

## 7. Собрать и запустить web

```powershell
npm --prefix web run doctor:production
npm --prefix web run build
npm --prefix web run start
```

Если web запускается через отдельный process manager, используйте production-команду `next start -p 3002`, а не `next dev`.

## 8. Проверить health/readiness

```powershell
Invoke-RestMethod https://api.<project-domain>/health
Invoke-RestMethod https://api.<project-domain>/api/health/ready
```

Проверьте, что рабочий API-запрос возвращает `X-Request-Id`, а reverse proxy/backend logs позволяют найти тот же request id.

## 9. Вывести operator/readiness evidence

```powershell
npm run release:first-start
npm run release:readiness
npm run release:evidence
```

Файлы из `release-evidence/` храните вместе с release notes вне Git.

## 10. Rollback quick path

Если после релиза найден критичный дефект:

```powershell
npm run backup:local
npm run backup:verify
npm --prefix backend run pm2:stop
```

Дальше восстановление выполняется вручную по `docs/backup-restore.md`: выбранный backup копируется в production `DATABASE_PATH` и `UPLOAD_DIR`, затем снова запускается `doctor:production`, backend и UAT.
