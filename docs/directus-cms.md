# Directus CMS / SaaS Backoffice

Directus используется в auditappmini как внутренний backoffice администратора SaaS-ресурса. Это не панель владельца компании и не замена Express + SQLite API.

## Продуктовая граница Plan B

Directus нужен только владельцу ресурса / администратору сервиса.

В Directus администратор ресурса управляет SaaS-уровнем:

- добавление, отключение и удаление компаний;
- назначение владельца компании;
- тарифные планы;
- лимиты компании;
- feature flags;
- служебные заметки по tenant-компаниям;
- снимки агрегированной SaaS-статистики, если они понадобятся для отчетности.

В Directus не работают владельцы компаний, менеджеры и инспекторы. Владелец компании после provisioning получает доступ только в пользовательскую web-панель своей компании и может назначать только менеджеров и инспекторов в рамках этой компании.

## Что не должно быть в CMS Resource Admin

Операционные данные компании не входят в активную CMS-схему:

- техника;
- осмотры;
- дефекты;
- ДТП-карточки;
- участники ДТП;
- фото-метаданные;
- OCR номера/одометра;
- antifraud-флаги.

Эти данные остаются в custom backend, потому что это рабочий контур компаний, а не SaaS-администрирование. Это также снижает риск случайного доступа администратора CMS к операционным сущностям tenant-компаний.

## Что остается в custom backend

- Авторизация пользователей пользовательской панели.
- Роли `owner`, `manager`, `inspector`, `admin`.
- Tenant-isolation по `company_id`.
- Техника, регионы, осмотры, дефекты, фото.
- OCR номера автомобиля.
- OCR одометра.
- Hash фотографий.
- Проверки гео и времени.
- Генерация PDF.
- ZIP/Excel/CSV-экспорт.
- Antifraud-логика.
- Webhooks.
- Бизнес-логика завершения осмотра и ДТП-флоу.

## Архитектура

```txt
Resource Admin
   |
   | Directus Studio
   v
Directus CMS: companies, company_owners, plans, limits
   |
   | provisioning sync, service token
   v
custom backend: auth, tenant data, SaaS aggregates
   |
   +--> web user panel: owner / manager / inspector
   +--> mobile app: inspection flow
```

Web и mobile не подключаются к Directus напрямую. Все Directus-операции проходят через backend и доступны только роли `admin`.

## Активные коллекции

MVP-схема описана в `directus/schema/mvp-schema.json` и `directus/schema/collections.md`:

- `companies` - tenant-компании SaaS.
- `company_owners` - владельцы компаний, которые будут заведены в локальную auth-базу через provisioning.
- `plans` - тарифные планы.
- `company_limits` - лимиты и feature flags компании.
- `saas_metric_snapshots` - опциональные снимки агрегированной статистики SaaS.

Legacy-файл `directus/schema/legacy-operational-schema.json` сохранен только как историческая справка. Bootstrap не использует его для активной SaaS-схемы; если legacy operational-коллекции уже были созданы в Directus, bootstrap скрывает их из меню Studio через `hidden: true`, не удаляя таблицы и данные.

## Provisioning компаний и владельцев

1. Администратор ресурса создает компанию в Directus `companies`.
2. Администратор создает владельца в `company_owners`.
3. Backend endpoint `POST /api/integrations/directus/provisioning/sync` синхронизирует эти записи в локальную SQLite/auth-базу.
4. Backend создает/обновляет локального пользователя с ролью `owner`.
5. Backend также синхронизирует `company_limits`, если коллекция уже создана в Directus.
6. При `issue_setup_links: true` backend возвращает одноразовую ссылку `/owner-setup?token=...`.
7. Владелец компании задает пароль в пользовательской панели.
8. Далее владелец назначает `manager` и `inspector` только внутри своей компании.

Пароль владельца компании не хранится в Directus.

Directus 11 по умолчанию создает primary key как integer. Backend при provisioning нормализует такие `id`/relation id в строковый tenant id для SQLite (`1` -> `"1"`), поэтому `companies.id`, `company_owners.company_id` и `company_limits.company_id` должны указывать на одно и то же значение.

## Лимиты и feature flags

`company_limits` синхронизируется в локальную SQLite-таблицу `company_limits`. Если лимит не задан, backend считает ресурс безлимитным.

Реализованный enforcement:

- `max_vehicles` ограничивает создание техники через `POST /api/vehicles` и массовый импорт `POST /api/vehicles/import`;
- `max_users` ограничивает создание пользователей компании через `POST /api/users`;
- `ocr_enabled` отключает OCR endpoints `POST /api/vehicle-number/recognize` и `POST /api/odometer/recognize`;
- `accident_module_enabled` отключает создание новых ДТП-осмотров через `POST /api/inspections` с `type: "accident"`;
- `analytics_enabled` отключает пользовательскую аналитику `GET /api/analytics/overview` и экспорт `GET /api/analytics/export/excel`;
- `api_access_enabled` синхронизируется и отображается как резервный feature flag для будущего внешнего API-доступа.

Если лимит превышен, backend возвращает `409` с понятным сообщением для пользовательской панели. Если модуль отключен тарифом, backend возвращает `403`. Создание/удаление самих компаний по-прежнему остается только в Directus.

Для пользовательской панели есть отдельный endpoint `GET /api/company/usage`. Он показывает текущей компании тариф, использование лимитов и доступные модули без упоминания CMS/Directus. В web-панели эти данные отображаются в настройках как блок "Тариф и доступные модули".

## SaaS-статистика

Да, общую статистику по всем компаниям можно вести и показывать администратору ресурса.

Реализованный live endpoint:

- `GET /api/admin/saas/stats` - admin-only агрегаты по всем компаниям.

Он возвращает:

- общее количество компаний;
- активные/неактивные компании;
- владельцы, менеджеры, инспекторы;
- общее количество техники;
- количество осмотров;
- количество дефектов и открытых дефектов;
- количество ДТП-осмотров;
- количество фото;
- активность за последние 7 дней;
- breakdown по компаниям;
- тариф и лимиты по компаниям;
- health-индикаторы вроде компаний без владельца или записей без `company_id`.
- короткие списки компаний без активного владельца и без лимитов, чтобы администратор ресурса видел, что нужно исправить в Directus.

Web-страница администратора:

- `/saas-admin` - доступна только роли `admin`, пункт меню виден только администратору ресурса.

Для публичной SaaS-страницы лучше не открывать raw endpoint. Если понадобится маркетинговый блок на лендинге, нужно сделать отдельный public endpoint с безопасными округленными числами и явным allowlist метрик.

## Env

Directus:

```txt
DIRECTUS_PORT=8055
POSTGRES_PORT=5433
POSTGRES_DB=directus
POSTGRES_USER=directus
POSTGRES_PASSWORD=change-me
DIRECTUS_SECRET=change-me-long-random-secret
DIRECTUS_ADMIN_EMAIL=admin@example.com
DIRECTUS_ADMIN_PASSWORD=change-me
CORS_ORIGIN=http://localhost:3000,http://localhost:3002,http://localhost:3001
```

Backend:

```txt
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=change-me-service-token
WEB_APP_URL=http://localhost:3002
OWNER_SETUP_TOKEN_TTL=7d
```

## Safety rules

- Не удалять SQLite backend.
- Не переписывать весь API на Directus.
- Не переносить OCR в Directus.
- Не хранить OCR/API tokens во frontend.
- Не давать web/mobile прямой доступ к Directus.
- Не показывать Directus/CMS в пользовательской панели компаний.
- Не создавать и не удалять компании через пользовательскую панель.
- Не делать Directus единственным backend для фотофиксации.
- Не хранить секреты в git.
- Не включать operational legacy collections в Resource Admin permissions без отдельного решения.

## Запуск Directus

```bash
cd directus
cp .env.example .env
docker compose up -d
```

Directus Studio: `http://localhost:8055`.

Bootstrap активной SaaS-схемы:

```bash
npm run directus:bootstrap:dry
npm run directus:bootstrap
```

Скрипт:

- читает `directus/.env`;
- поддерживает dry-run режим для локальной проверки manifest;
- использует `DIRECTUS_TOKEN` или логин администратора из `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD`;
- создает отсутствующие коллекции;
- создает отсутствующие поля;
- обновляет метаданные активных SaaS-коллекций, чтобы они оставались видимыми в меню Studio;
- обновляет русские `translations` для коллекций и полей, подсказки, иконки, display templates и русские labels для dropdown-значений;
- создает relations `company_owners.company_id -> companies.id` и `company_limits.company_id -> companies.id`;
- скрывает legacy operational-коллекции (`vehicles`, `accident_cases`, `accident_participants`, `damages`, `photos`, `odometer_recognitions`, `plate_recognitions`, `fraud_checks`) из меню Studio без удаления данных;
- не удаляет существующие данные;
- не настраивает роли, service token и permission filters автоматически.

Seed стартовых SaaS-данных:

```bash
npm run directus:seed:saas:dry
npm run directus:seed:saas
```

Скрипт создает/обновляет тарифы `pilot`, `standard`, `enterprise` и выдает Administrator policy CRUD-доступ к активным SaaS-коллекциям. `company_limits` создаются только для существующих компаний. Если компаний в Directus ещё нет, лимиты не создаются, чтобы не появлялись записи без владельца; после добавления компании повторите `npm run directus:seed:saas`. Если у компании не заполнен `plan_code`, seed проставит `pilot` и создаст лимиты по пилотному тарифу. Существующие лимиты сохраняются; для пересинхронизации лимитов с тарифом используйте `node directus/scripts/seed-saas-data.mjs --force`.

## Backend endpoints

- `GET /api/integrations/directus/status` - показывает admin-only статус Directus и активные SaaS-коллекции.
- `POST /api/integrations/directus/provisioning/sync` - admin-only синхронизирует `companies` и `company_owners` из Directus в локальную auth/API-базу.
- `GET /api/admin/saas/stats` - admin-only live-статистика по всему SaaS-проекту.

Legacy endpoints для точечной отправки ДТП-осмотра в Directus пока сохранены как совместимость/диагностика, но они не входят в активную SaaS CMS-схему:

- `GET /api/integrations/directus/inspections/:id/preview`
- `POST /api/integrations/directus/inspections/:id/sync`

Перед использованием legacy sync нужно отдельно принять решение, какие operational collections допустимы в Directus и какие permissions им нужны.
