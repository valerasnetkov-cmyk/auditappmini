# Directus collections

Минимальная активная схема Directus для Plan B: Directus — это backoffice администратора SaaS-ресурса, а не операционная панель компаний.

В Directus администратор ресурса управляет компаниями, владельцами компаний, тарифами, лимитами и служебными SaaS-настройками. Владельцы компаний, менеджеры и инспекторы работают только в пользовательской панели.

Операционные данные компаний — техника, осмотры, дефекты, ДТП, фото, OCR и antifraud-проверки — остаются в custom backend и SQLite. Они не входят в активную bootstrap-схему CMS.

## companies

- `id` - uuid, primary key; стабильный id tenant-компании для provisioning в backend.
- `slug` - string, required; человекочитаемый код компании.
- `name` - string, required.
- `type` - enum: `insurance`, `leasing`, `fleet`, `other`.
- `country` - string.
- `region` - string.
- `billing_email` - string; контакт для счетов/договоров.
- `plan_code` - string; код тарифа из `plans.code`.
- `status` - enum: `active`, `inactive`.
- `settings` - json; служебные настройки tenant.
- `notes` - text; внутренние заметки администратора ресурса.
- `created_at` - datetime.

## company_owners

- `id` - uuid, primary key.
- `company_id` - many-to-one -> `companies.id`.
- `email` - string, required.
- `name` - string, required.
- `phone` - string.
- `status` - enum: `active`, `inactive`.
- `created_at` - datetime.

После provisioning sync владелец создается в локальной auth-базе backend как `role = owner` и задает пароль через одноразовую `/owner-setup` ссылку. Пароль не хранится в Directus.

## plans

- `id` - uuid, primary key.
- `code` - string, required; стабильный код тарифа.
- `name` - string, required.
- `status` - enum: `active`, `inactive`.
- `monthly_price` - decimal.
- `max_vehicles` - integer.
- `max_users` - integer.
- `max_storage_mb` - integer.
- `features` - json; описание включенных функций.
- `created_at` - datetime.

## company_limits

- `id` - uuid, primary key.
- `company_id` - many-to-one -> `companies.id`.
- `plan_code` - string.
- `max_vehicles` - integer.
- `max_users` - integer.
- `max_storage_mb` - integer.
- `ocr_enabled` - boolean.
- `accident_module_enabled` - boolean.
- `analytics_enabled` - boolean.
- `api_access_enabled` - boolean.
- `updated_at` - datetime.

## saas_metric_snapshots

Коллекция для ручных или будущих автоматических снимков агрегированной статистики SaaS. Фактический источник live-статистики — backend endpoint `/api/admin/saas/stats`.

- `id` - uuid, primary key.
- `snapshot_date` - date, required.
- `total_companies` - integer.
- `active_companies` - integer.
- `total_users` - integer.
- `total_vehicles` - integer.
- `total_inspections` - integer.
- `total_defects` - integer.
- `open_defects` - integer.
- `total_accidents` - integer.
- `total_photos` - integer.
- `created_at` - datetime.

## Legacy operational schema

Файл `directus/schema/legacy-operational-schema.json` сохранен как историческая справка для раннего варианта интеграции, где в CMS попадали ДТП-карточки, damage/photo/OCR/fraud коллекции. Этот файл не используется для создания активной SaaS-схемы и не должен включаться в permissions Resource Admin без отдельного продуктового решения.

Если legacy operational-коллекции уже существуют в Directus после ранних запусков, `directus/scripts/bootstrap-schema.mjs` скрывает их из меню Studio через метаданные `hidden: true`. Это не удаляет таблицы и данные; оно только убирает пользовательские/операционные разделы из интерфейса администратора ресурса.
