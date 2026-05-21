# Auditmini Web

Next.js web-панель Auditmini находится в папке `web/`.

## Локальный запуск

Из корня проекта:

```powershell
npm run dev
```

Или отдельно:

```powershell
npm --prefix backend run dev
npm --prefix web run dev
```

Web по умолчанию открывается на `http://localhost:3002`, backend API — на `http://localhost:3001/api`.

## Локальный env

```powershell
cd C:\Projects\Auditmini\auditappmini\web
Copy-Item .env.example .env.local
```

Для локальной разработки:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Production env

Перед production build используйте отдельный env-файл:

```powershell
Copy-Item .env.production.example .env.production
```

В `web/.env.production` должен быть публичный HTTPS backend API:

```env
NEXT_PUBLIC_API_URL=https://api.<project-domain>/api
```

`NEXT_PUBLIC_API_URL` встраивается в frontend bundle и виден браузеру. Секреты в `NEXT_PUBLIC_*` переменных хранить нельзя.

Проверка production env:

```powershell
npm run doctor:production
```

## Проверки

```powershell
npm run lint
npm run build
npm run doctor:launch
```

E2E-проверки запускаются из корня проекта через изолированный runner:

```powershell
npm run verify:e2e
```
