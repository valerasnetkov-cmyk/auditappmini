# Task: Web-first System Admin вместо обязательного Directus

## Goal

Перевести проект auditappmini на web-first модель системного администрирования SaaS.

Directus больше не должен быть обязательным production-компонентом. Основной системный администратор ресурса управляет компаниями, владельцами, тарифами, лимитами и глобальной статистикой через web-интерфейс.

Directus оставить в репозитории как optional legacy/internal emergency backoffice, но убрать из основного production/runbook пути.

## Product decision

Новая модель:

- `admin` — системный администратор ресурса, работает только в `/system-admin`;
- `owner` — владелец компании, работает только внутри своей компании;
- `manager` — менеджер компании;
- `inspector` — инспектор компании.

`admin` не должен попадать в tenant-операционные разделы компаний: техника, осмотры, дефекты, пользователи компании как обычный tenant user.

## Backend requirements

Добавить admin-only API для системного контура:

### Companies

- `GET /api/system/companies`
- `GET /api/system/companies/:id`
- `POST /api/system/companies`
- `PUT /api/system/companies/:id`
- `POST /api/system/companies/:id/archive`

Компания должна иметь:

- `id`
- `name`
- `slug`
- `status`
- `region_code`
- `plan_code`
- `created_at`
- `updated_at`

### Company owners

Добавить управление владельцем компании:

- `GET /api/system/companies/:id/owner`
- `POST /api/system/companies/:id/owner`
- `PUT /api/system/companies/:id/owner`
- `POST /api/system/companies/:id/owner/setup-link`

Owner setup link должен использовать существующий безопасный механизм owner setup token, если он уже есть в проекте.

### Plans and limits

Добавить управление тарифами и лимитами:

- `GET /api/system/plans`
- `POST /api/system/plans`
- `PUT /api/system/plans/:code`

- `GET /api/system/companies/:id/limits`
- `PUT /api/system/companies/:id/limits`

Лимиты:

- `max_vehicles`
- `max_users`
- `ocr_enabled`
- `accident_module_enabled`
- `analytics_enabled`
- `api_enabled`

Существующие backend-проверки лимитов должны продолжить работать.

### Global stats

Сохранить существующий:

- `GET /api/admin/saas/stats`

Если нужно — использовать его внутри `/system-admin`.

### Admin isolation

Tenant API должны возвращать `403` для системного `admin`, если он пытается попасть в обычные tenant endpoints:

- `/api/vehicles`
- `/api/inspections`
- `/api/defects`
- `/api/users`
- `/api/company/usage`

Исключение: только специальные `/api/system/*` и `/api/admin/*` endpoints.

## Web requirements

Создать новый основной маршрут:

- `/system-admin`

Старый маршрут:

- `/saas-admin`

должен делать redirect на `/system-admin`.

### System Admin UI

Сделать отдельный системный layout/menu без tenant-разделов.

Меню:

- Обзор
- Компании
- Тарифы
- Лимиты
- Health
- Профиль

### Pages

#### `/system-admin`

Dashboard системного администратора:

- всего компаний;
- активные компании;
- владельцы;
- техника;
- осмотры;
- дефекты;
- фото;
- активность за 7 дней;
- health-индикаторы.

#### `/system-admin/companies`

Список компаний:

- название;
- slug;
- статус;
- регион;
- тариф;
- владелец;
- лимиты;
- дата создания;
- действия.

Действия:

- создать компанию;
- редактировать компанию;
- архивировать компанию;
- создать/изменить владельца;
- сгенерировать setup-ссылку владельца;
- открыть лимиты.

#### `/system-admin/plans`

Управление тарифами:

- pilot;
- standard;
- enterprise;
- custom.

#### `/system-admin/health`

Проверки:

- backend health;
- database;
- uploads;
- backup status, если доступно;
- SSL/API URL подсказки можно оставить текстом.

## UX rules

- Никаких упоминаний Directus/CMS в пользовательской панели компаний.
- Owner/manager/inspector не видят `/system-admin`.
- Admin не видит tenant navigation.
- Если admin открывает `/vehicles`, `/inspections`, `/defects`, `/users` — показать понятный экран “Системный администратор не работает в контуре компании” или redirect на `/system-admin`.

## Directus legacy

Directus не удалять физически.

Сделать изменения в документации:

- убрать Directus из основного production runbook;
- пометить `directus/` как optional legacy/internal emergency backoffice;
- existing Directus endpoints оставить временно;
- Directus sync не использовать как обязательный путь создания компаний;
- операционные данные компаний не переносить в Directus.

## Changelog

Обновить `CHANGELOG.md` сегодняшней датой.

Добавить раздел:

### Changed

- Перевод SaaS-администрирования на web-first модель через `/system-admin`.
- Directus переведён в optional legacy/internal backoffice и больше не является обязательным production-компонентом.
- `/saas-admin` оставлен как compatibility route с redirect на `/system-admin`.

### Added

- Admin-only system API для компаний, владельцев, тарифов и лимитов.
- Web-кабинет системного администратора `/system-admin`.

### Fixed

- Разделение системного admin-контура и tenant UI/API.

## Tests

Добавить или обновить smoke/e2e проверки:

### Admin

- admin login → `/system-admin`;
- admin создаёт компанию;
- admin создаёт владельца компании;
- owner setup link работает;
- admin меняет тариф/лимиты;
- admin получает `403` на tenant API `/api/vehicles`, `/api/inspections`, `/api/defects`, `/api/users`.

### Owner

- owner входит в обычную панель;
- owner видит только свою компанию;
- owner создаёт manager/inspector только внутри своей компании;
- owner не видит `/system-admin`.

### Regression

Запустить:

- `npm run verify:launch`
- `npm run backup:verify`
- `npm run release:verify`

## Important

Не ломать текущий production deployment:

- backend на 3001;
- web на 3002;
- Nginx;
- PM2;
- `https://auditavto.ru`;
- `https://api.auditavto.ru/api`.

Directus не должен быть нужен для старта production.