# Directus CMS / Data Studio

Directus добавлен как отдельный CMS/Data Studio слой для auditappmini. Он не заменяет существующий `backend/`: OCR, hash фото, antifraud, PDF/ZIP-экспорт, webhooks и сложная бизнес-логика остаются в custom backend.

## Быстрый старт

```bash
cd directus
cp .env.example .env
docker compose up -d
```

Directus Studio будет доступен по адресу:

```txt
http://localhost:8055
```

PostgreSQL публикуется наружу на порт `5433`, чтобы не конфликтовать с локальными базами проекта.

## Переменные окружения

- `DIRECTUS_PORT` - внешний порт Directus Studio.
- `POSTGRES_PORT` - внешний порт PostgreSQL.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - база Directus.
- `DIRECTUS_KEY`, `DIRECTUS_SECRET` - ключ и секрет Directus.
- `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD` - первый администратор.
- `CORS_ORIGIN` - разрешенные локальные источники: web, backend и альтернативный web-порт.

## После первого запуска

1. Откройте `http://localhost:8055`.
2. Войдите под администратором из `.env`.
3. Создайте коллекции по описанию в `schema/collections.md`.
4. Настройте роли из `schema/seed.md`.
5. Создайте service token для backend и добавьте его в `backend/.env` как `DIRECTUS_TOKEN`.

## Bootstrap MVP-схемы

После запуска Directus можно создать базовые коллекции и поля из manifest:

```bash
cd directus
node scripts/bootstrap-schema.mjs
```

Проверить manifest без подключения к Directus:

```bash
node scripts/bootstrap-schema.mjs --dry-run
```

Скрипт читает `directus/.env`, логинится через `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD` или использует `DIRECTUS_TOKEN`, если он задан. Он не удаляет существующие коллекции и пропускает уже созданные поля.

Важно: relations, роли и permission filters для MVP всё ещё настраиваются вручную в Directus Studio.

## Граница ответственности

Directus хранит и показывает бизнес-данные, справочники и доказательную карточку ДТП. Backend остается источником вычислений, валидации и защищенных операций.
