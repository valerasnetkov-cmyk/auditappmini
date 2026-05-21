# Release runbook

Этот runbook описывает один воспроизводимый порядок выкладки Auditmini в пилот/production.

## Когда использовать

Используйте этот порядок перед:

- первым пилотным запуском;
- миграцией реальных данных;
- обновлением backend/web/mobile после пилота;
- ручным восстановлением из backup.

## 0. Что должно быть готово

Перед релизом должны существовать приватные production env:

- `backend/.env.production` или переменные в process manager / secret storage;
- `web/.env.production` или env в hosting/build pipeline;
- `mobile/.env.production` или env в Expo/native build pipeline.

Шаблоны:

- `backend/.env.production.example`;
- `web/.env.production.example`;
- `mobile/.env.production.example`.

Подробности: `docs/production-env.md`.

## 1. Code gate

На машине разработки или CI:

```powershell
npm run verify:launch
```

Команда проверяет:

- backend smoke, включая изоляцию компаний, дефекты, SaaS-admin, лимиты, Directus service mock и backup smoke;
- production build web;
- mobile typecheck / Expo install check / Expo doctor;
- изолированный Chromium E2E;
- launch doctor для backend/web/mobile в dev-safe режиме;
- audit-проверки backend/web/mobile.

Если нужен один короткий pre-release gate вместе с проверкой последнего backup:

```powershell
npm run release:verify
```

## 2. Production env gate

На production/staging host или в окружении, где доступны реальные production env:

```powershell
npm run doctor:production
```

Команда должна завершиться без `errors`.

Что проверяется:

- backend `JWT_SECRET`, `PUBLIC_REGISTRATION_ENABLED=false`, `CORS_ORIGINS`, persistent `DATABASE_PATH`, `UPLOAD_DIR`, `BACKUP_DIR`, admin seed и Directus token;
- web `NEXT_PUBLIC_API_URL`;
- mobile `EXPO_PUBLIC_API_URL`.

Production URL должны быть публичными HTTPS URL и заканчиваться на `/api`.

Если на production host нужно проверить только production env и последний backup, без полного build/E2E:

```powershell
npm run release:production-check
```

## 3. Data safety gate

Перед миграцией или обновлением:

```powershell
npm run backup:local
npm run backup:verify
```

`backup:verify` открывает SQLite из последнего backup, запускает `PRAGMA integrity_check`, считает ключевые таблицы и проверяет uploads.

Подробности: `docs/backup-restore.md`.

## 4. Full release check

Если production env доступны на этой машине, можно выполнить полный gate одной командой:

```powershell
npm run release:check
```

Она последовательно выполняет:

1. `npm run verify:launch`;
2. `npm run doctor:production`;
3. `npm run backup:verify`.

Если production env недоступны на dev-машине, используйте разделы 1 и 2 отдельно: `verify:launch` в dev/CI, `doctor:production` на production/staging host.

## 5. Build and start

### Backend

Для PM2:

```powershell
npm --prefix backend run pm2:start
```

Для ручной локальной production-проверки:

```powershell
cd backend
node -r dotenv/config src/server.js dotenv_config_path=.env.production
```

### Web

Перед build production env должен быть уже задан:

```powershell
npm --prefix web run doctor:production
npm --prefix web run build
npm --prefix web run start
```

### Mobile

Перед production build:

```powershell
npm --prefix mobile run doctor:production
npm --prefix mobile run verify
```

После изменения `EXPO_PUBLIC_API_URL` мобильную сборку нужно пересобрать.

## 6. Post-release smoke / UAT

Сначала проверьте техническую готовность backend:

```powershell
Invoke-RestMethod https://api.<project-domain>/health
Invoke-RestMethod https://api.<project-domain>/api/health/ready
```

`/health`, `/api/health` и `/api/health/live` — лёгкая проверка процесса.  
`/api/health/ready` дополнительно проверяет SQLite query и запись в uploads; reverse proxy/monitoring лучше привязывать именно к readiness endpoint.

После запуска проверьте вручную:

1. вход admin / owner / manager / inspector;
2. создание компании через CMS/admin-контур;
3. создание владельца компании и owner setup;
4. отсутствие публичной саморегистрации в production;
5. создание техники и импорт техники;
6. запуск quick/scheduled/accident осмотра;
7. загрузку обязательных фото и фото дефекта;
8. закрытие и переоткрытие дефекта;
9. фильтр дефектов по выбранной технике;
10. dashboard и analytics;
11. что пользователь другой компании не видит чужие данные.

## 7. Rollback

Если после релиза обнаружена критическая ошибка:

1. остановите backend/web;
2. сохраните текущий аварийный снимок:

```powershell
npm run backup:local
npm run backup:verify
```

3. восстановите выбранный предыдущий backup вручную по `docs/backup-restore.md`;
4. верните предыдущую web/mobile сборку;
5. запустите:

```powershell
npm run doctor:production
```

6. после старта проверьте вход, список техники, карточку осмотра, дефекты и фото.

Автоматический destructive rollback/restore намеренно не добавлен: для пилота безопаснее выполнять восстановление под контролем администратора ресурса.

## 8. Release evidence

Для каждого production-релиза сохраните:

- дату и время релиза;
- git commit / архив версии;
- JSON-вывод `npm run doctor:production`;
- JSON-вывод `npm run backup:local`;
- JSON-вывод `npm run backup:verify`;
- результат `npm run verify:launch`;
- список ручных UAT-проверок и найденные замечания.
