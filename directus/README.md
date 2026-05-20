# Directus CMS / SaaS Backoffice

Directus добавлен как отдельный внутренний backoffice для администратора SaaS-ресурса auditappmini. Он не заменяет существующий `backend/` и не является панелью владельцев компаний.

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

## Активная модель Plan B

Directus хранит SaaS-уровень:

- `companies` - компании-клиенты сервиса;
- `company_owners` - владельцы компаний;
- `plans` - тарифы;
- `company_limits` - лимиты и feature flags;
- `saas_metric_snapshots` - опциональные снимки агрегированной статистики.

Операционные данные компаний — техника, осмотры, дефекты, ДТП, фото, OCR и antifraud — остаются в custom backend и пользовательской панели. Владельцы компаний, менеджеры и инспекторы не получают доступ к Directus Studio.

## После первого запуска

1. Откройте `http://localhost:8055`.
2. Войдите под администратором из `.env`.
3. Создайте коллекции через bootstrap или вручную по `schema/collections.md`.
4. Настройте роли из `schema/seed.md`.
5. Создайте service token для backend и добавьте его в `backend/.env` как `DIRECTUS_TOKEN`.
6. Создайте компанию и владельца компании.
7. Запустите backend provisioning sync `POST /api/integrations/directus/provisioning/sync`.
8. Передайте владельцу одноразовую ссылку `/owner-setup?token=...` для установки пароля в пользовательской панели.

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

При повторном запуске bootstrap также приводит меню Directus Studio к Plan B: активные SaaS-коллекции остаются видимыми, а legacy operational-коллекции `vehicles`, `accident_cases`, `accident_participants`, `damages`, `photos`, `odometer_recognitions`, `plate_recognitions` и `fraud_checks` помечаются как `hidden: true`. Таблицы и данные при этом не удаляются.

Bootstrap обновляет русские названия коллекций и полей через Directus `translations` для `ru-RU` и `en-US`, поэтому даже при английском языке пользователя Studio показывает SaaS-разделы по-русски: `Компании`, `Владельцы компаний`, `Тарифы`, `Лимиты компаний`, `Снимки SaaS-метрик`.

Bootstrap также создает связи `company_owners.company_id -> companies.id` и `company_limits.company_id -> companies.id`. Если в старой локальной CMS эти поля были ошибочно созданы как `uuid`, bootstrap безопасно пересоздает их только когда соответствующие коллекции пустые; непустые данные он не удаляет.

## Seed тарифов и лимитов

После bootstrap можно заполнить стартовые тарифы:

```bash
npm run directus:seed:saas:dry
npm run directus:seed:saas
```

Seed добавляет/обновляет тарифы `pilot`, `standard` и `enterprise`, а также проверяет CRUD-права Administrator policy на активные SaaS-коллекции. `company_limits` создаются только для уже существующих компаний в Directus: если компаний ещё нет, скрипт не создает сиротские лимиты. После добавления компании повторно запустите `npm run directus:seed:saas`, и лимиты будут созданы по `companies.plan_code` или по тарифу `pilot` по умолчанию. Если у компании `plan_code` пустой, seed проставит `pilot`, чтобы карточка компании и лимиты были согласованы. Существующие лимиты не перезаписываются; для принудительного обновления используйте:

```bash
node directus/scripts/seed-saas-data.mjs --force
```

Важно: роли, service token и permission filters для MVP всё ещё настраиваются вручную в Directus Studio.

## Граница ответственности

Backend остается источником вычислений, валидации, tenant-isolation, защищенных фото и операционной статистики. Глобальная SaaS-статистика доступна администратору ресурса через `GET /api/admin/saas/stats` и web-страницу `/saas-admin`.

Синхронизированные `company_limits` применяются backend-ом: `max_vehicles` ограничивает создание/импорт техники, `max_users` ограничивает создание пользователей компании, а `ocr_enabled`, `accident_module_enabled` и `analytics_enabled` отключают соответствующие модули пользовательского API. Незаданный лимит или пустой feature flag считается включенным/безлимитным.

Так как Directus 11 создает SaaS-коллекции с integer primary key, backend при provisioning приводит `companies.id`, `company_owners.company_id` и `company_limits.company_id` к строковому tenant id для локальной SQLite-базы. Важно, чтобы все три значения ссылались на одну Directus-компанию.

Файл `schema/legacy-operational-schema.json` сохранен как историческая справка раннего варианта схемы и не используется для создания активной SaaS-схемы. Если такие коллекции уже были созданы в Directus, bootstrap скрывает их из меню Studio без удаления данных.
