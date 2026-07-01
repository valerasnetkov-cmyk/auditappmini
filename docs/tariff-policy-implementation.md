# Реализация тарифной политики проекта «Аудит Авто»

## Цель

Внедрить в проект понятную SaaS-тарифную модель для B2B-клиентов: владелец ресурса управляет тарифами, оплатами, лимитами и доступом компаний, а владелец компании видит свой тариф, срок действия, использование лимитов и доступные модули.

Главная бизнес-задача — монетизация сервиса через размер автопарка и уровень контроля, а не просто через количество пользователей.

---

## Продуктовая логика

Сервис продаёт не «доступ к программе», а контроль состояния автопарка:

- доказательная фотофиксация состояния техники;
- история осмотров, дефектов, ДТП и пробега;
- контроль обязательных фото;
- снижение спорных ситуаций между водителями, механиками, подрядчиками и владельцами техники;
- прозрачная история по каждой единице техники.

Тариф должен зависеть от:

1. количества техники;
2. количества пользователей;
3. количества осмотров в месяц;
4. объёма фото-хранилища;
5. доступа к OCR номера и одометра;
6. доступа к ДТП-модулю;
7. доступа к аналитике и экспорту;
8. срока действия оплаты.

---

## Тарифная сетка для старта

### 1. `pilot` — Пилот

Для тестового внедрения и первых клиентов.

| Параметр | Значение |
|---|---:|
| Цена в месяц | 5 000 ₽ |
| Цена за 3 месяца пилота | 15 000 ₽ |
| Техника | до 25 |
| Пользователи | до 10 |
| Осмотры в месяц | до 100 |
| Фото-хранилище | до 10 ГБ |
| Быстрый осмотр | да |
| Плановый осмотр | да |
| ДТП-осмотр | да |
| OCR номера | да, ограниченно |
| OCR одометра | да, ограниченно |
| Аналитика | нет / базовая |
| Экспорт | PDF / печать |
| API | нет |
| Поддержка | базовая |

Цель тарифа: дать клиенту быстро проверить ценность сервиса на реальном автопарке и затем перевести на `standard`.

---

### 2. `standard` — Стандарт

Основной коммерческий тариф. На лендинге и в панели продаж должен быть отмечен как рекомендуемый.

| Параметр | Значение |
|---|---:|
| Цена в месяц | 15 000 ₽ |
| Цена в год | 150 000 ₽ |
| Техника | до 50 |
| Пользователи | до 10 |
| Осмотры в месяц | до 2 000 |
| Фото-хранилище | до 50 ГБ |
| Быстрый осмотр | да |
| Плановый осмотр | да |
| ДТП-осмотр | да |
| OCR номера | да |
| OCR одометра | да |
| Аналитика | да |
| Экспорт | PDF / CSV |
| Импорт техники из Excel | да |
| API | нет |
| Поддержка | приоритетная |

Цель тарифа: закрыть основной сценарий для компаний с регулярным контролем автопарка.

---

### 3. `enterprise` — Enterprise

Для крупных парков, филиалов, регионального хранения данных и индивидуальных требований.

| Параметр | Значение |
|---|---:|
| Цена в месяц | 50 000 ₽ |
| Цена в год | индивидуально |
| Техника | от 150 |
| Пользователи | от 30 |
| Осмотры в месяц | индивидуально |
| Фото-хранилище | от 200 ГБ |
| Быстрый осмотр | да |
| Плановый осмотр | да |
| ДТП-осмотр | да |
| OCR номера | да |
| OCR одометра | да |
| Расширенная аналитика | да |
| Экспорт | PDF / CSV / расширенный экспорт |
| API | опционально |
| Отдельный VPS / контур | опционально |
| SLA | опционально |
| Поддержка | персональная |

Цель тарифа: продавать внедрение системы контроля, а не просто подписку.

---

## Дополнительные платные опции

| Опция | Рекомендованная цена |
|---|---:|
| Дополнительная техника сверх лимита | 300–500 ₽ / месяц за единицу |
| Дополнительные 50 ГБ хранилища | 1 500–3 000 ₽ / месяц |
| Дополнительные 1 000 OCR-запросов | 1 000–2 500 ₽ |
| Настройка и внедрение | 15 000–50 000 ₽ разово |
| Выделенный VPS / отдельный контур | от 25 000 ₽ / месяц дополнительно |
| Индивидуальный шаблон осмотра | по договорённости |

---

## Требования к реализации

### Главное правило

Не ломать текущие рабочие сценарии:

- вход в систему;
- создание и просмотр техники;
- импорт техники;
- создание осмотров;
- загрузка фото;
- фиксация дефектов;
- OCR;
- ДТП-осмотры;
- аналитику;
- панель владельца компании;
- панель администратора ресурса.

Все изменения должны быть tenant-safe: компания не должна видеть тарифы, оплаты, лимиты и данные другой компании.

---

## Модель данных

### Таблица / коллекция `plans`

Если таблица уже существует — расширить безопасной миграцией без удаления данных.

Поля:

```txt
id
code
name
description
position
is_active
is_public
monthly_price_rub
yearly_price_rub
trial_months
recommended
max_vehicles
max_users
max_inspections_per_month
storage_limit_gb
ocr_enabled
ocr_monthly_limit
accident_module_enabled
analytics_enabled
export_enabled
api_enabled
custom_branding_enabled
regional_storage_enabled
support_level
created_at
updated_at
```

Рекомендуемые значения:

```txt
support_level: basic | priority | personal
```

---

### Таблица / коллекция `company_limits`

Если уже есть — расширить.

Поля:

```txt
id
company_id
plan_code
max_vehicles
max_users
max_inspections_per_month
storage_limit_gb
ocr_enabled
ocr_monthly_limit
accident_module_enabled
analytics_enabled
export_enabled
api_enabled
custom_branding_enabled
regional_storage_enabled
support_level
limits_comment
created_at
updated_at
```

Правило:

- `company_limits` хранит фактические лимиты конкретной компании;
- если лимит в `company_limits` не задан, брать значение из `plans`;
- если значение не задано ни в `company_limits`, ни в `plans`, считать его безлимитным только там, где это уже принято текущей логикой проекта;
- индивидуальные условия Enterprise должны задаваться через `company_limits`, а не через создание десятков новых тарифов.

---

### Новая таблица `company_billing`

Нужна для ручного учёта оплат, так как на старте платежи будут оффлайн.

Поля:

```txt
id
company_id
plan_code
billing_status
paid_until
trial_until
last_payment_date
last_payment_amount_rub
last_payment_period_start
last_payment_period_end
payment_method
payment_comment
invoice_number
contract_number
created_by_user_id
created_at
updated_at
```

Значения `billing_status`:

```txt
trial
active
payment_due
suspended
archived
```

Правила статусов:

- `trial` — пилотный период активен;
- `active` — тариф оплачен и действует;
- `payment_due` — срок оплаты закончился или скоро закончится, сервис работает с предупреждением;
- `suspended` — новые действия ограничены, история доступна для просмотра;
- `archived` — компания неактивна, новые действия запрещены.

---

### Новая таблица `company_billing_events`

Нужна для истории изменений тарифа и оплат.

Поля:

```txt
id
company_id
event_type
old_value
new_value
comment
created_by_user_id
created_at
```

Значения `event_type`:

```txt
plan_changed
payment_added
paid_until_changed
status_changed
limits_changed
manual_note_added
suspended
reactivated
```

---

## Seed тарифов

Обновить seed-данные так, чтобы в системе были три базовых тарифа:

```txt
pilot
standard
enterprise
```

### `pilot`

```json
{
  "code": "pilot",
  "name": "Пилот",
  "monthly_price_rub": 5000,
  "yearly_price_rub": null,
  "trial_months": 3,
  "recommended": false,
  "max_vehicles": 25,
  "max_users": 10,
  "max_inspections_per_month": 100,
  "storage_limit_gb": 10,
  "ocr_enabled": true,
  "ocr_monthly_limit": 100,
  "accident_module_enabled": true,
  "analytics_enabled": false,
  "export_enabled": true,
  "api_enabled": false,
  "custom_branding_enabled": false,
  "regional_storage_enabled": false,
  "support_level": "basic"
}
```

### `standard`

```json
{
  "code": "standard",
  "name": "Стандарт",
  "monthly_price_rub": 15000,
  "yearly_price_rub": 150000,
  "trial_months": 0,
  "recommended": true,
  "max_vehicles": 50,
  "max_users": 10,
  "max_inspections_per_month": 2000,
  "storage_limit_gb": 50,
  "ocr_enabled": true,
  "ocr_monthly_limit": 2000,
  "accident_module_enabled": true,
  "analytics_enabled": true,
  "export_enabled": true,
  "api_enabled": false,
  "custom_branding_enabled": false,
  "regional_storage_enabled": false,
  "support_level": "priority"
}
```

### `enterprise`

```json
{
  "code": "enterprise",
  "name": "Enterprise",
  "monthly_price_rub": 50000,
  "yearly_price_rub": null,
  "trial_months": 0,
  "recommended": false,
  "max_vehicles": 150,
  "max_users": 30,
  "max_inspections_per_month": null,
  "storage_limit_gb": 200,
  "ocr_enabled": true,
  "ocr_monthly_limit": null,
  "accident_module_enabled": true,
  "analytics_enabled": true,
  "export_enabled": true,
  "api_enabled": true,
  "custom_branding_enabled": true,
  "regional_storage_enabled": true,
  "support_level": "personal"
}
```

---

## Backend: правила применения лимитов

### 1. Проверка лимита техники

Уже существующую проверку `max_vehicles` сохранить и расширить понятным ответом.

При превышении лимита:

```http
409 Conflict
```

Ответ:

```json
{
  "error": "vehicle_limit_exceeded",
  "message": "Достигнут лимит техники по текущему тарифу.",
  "limit": 50,
  "used": 50,
  "upgrade_cta": "Свяжитесь с поддержкой для увеличения лимита."
}
```

Применять к:

```txt
POST /api/vehicles
POST /api/vehicles/import
```

---

### 2. Проверка лимита пользователей

При превышении:

```http
409 Conflict
```

Ответ:

```json
{
  "error": "user_limit_exceeded",
  "message": "Достигнут лимит пользователей по текущему тарифу.",
  "limit": 10,
  "used": 10,
  "upgrade_cta": "Увеличьте тариф или запросите дополнительный лимит."
}
```

Применять к:

```txt
POST /api/users
```

---

### 3. Проверка лимита осмотров в месяц

Добавить новую проверку.

Применять к:

```txt
POST /api/inspections
```

Логика:

- считать только осмотры текущей компании;
- период — календарный месяц по дате создания осмотра;
- черновики учитывать, если они создают нагрузку на фото/данные;
- если лимит `null`, не ограничивать.

При превышении:

```http
409 Conflict
```

Ответ:

```json
{
  "error": "inspection_limit_exceeded",
  "message": "Достигнут месячный лимит осмотров по текущему тарифу.",
  "limit": 2000,
  "used": 2000,
  "period": "2026-06"
}
```

---

### 4. Проверка OCR

Текущие feature flags сохранить и расширить месячным лимитом.

Применять к:

```txt
POST /api/vehicle-number/recognize
POST /api/odometer/recognize
```

Если OCR отключён:

```http
403 Forbidden
```

```json
{
  "error": "ocr_disabled_by_plan",
  "message": "OCR недоступен на текущем тарифе."
}
```

Если превышен месячный лимит OCR:

```http
409 Conflict
```

```json
{
  "error": "ocr_limit_exceeded",
  "message": "Достигнут месячный лимит распознаваний OCR.",
  "limit": 100,
  "used": 100,
  "period": "2026-06"
}
```

Для подсчёта использовать таблицы:

```txt
vehicle_number_recognitions
odometer_recognitions
```

Если нужно — добавить отдельную агрегирующую таблицу `company_usage_monthly`.

---

### 5. Проверка ДТП-модуля

Сохранить текущую проверку `accident_module_enabled`.

Применять к созданию ДТП-осмотра.

Ответ:

```http
403 Forbidden
```

```json
{
  "error": "accident_module_disabled_by_plan",
  "message": "ДТП-осмотры недоступны на текущем тарифе."
}
```

---

### 6. Проверка аналитики и экспорта

Сохранить текущую проверку `analytics_enabled` и добавить `export_enabled`.

Применять к:

```txt
GET /api/analytics/*
GET /api/admin/company analytics where applicable
GET /api/export/*
```

Если аналитика отключена:

```http
403 Forbidden
```

```json
{
  "error": "analytics_disabled_by_plan",
  "message": "Аналитика недоступна на текущем тарифе."
}
```

Если экспорт отключён:

```http
403 Forbidden
```

```json
{
  "error": "export_disabled_by_plan",
  "message": "Экспорт отчётов недоступен на текущем тарифе."
}
```

---

### 7. Проверка статуса оплаты

Добавить централизованный guard, например:

```txt
requireActiveBilling
```

Он должен проверять:

- статус компании;
- `billing_status`;
- `paid_until`;
- `trial_until`.

Правила:

| Статус | Поведение |
|---|---|
| `trial` | всё работает до `trial_until` |
| `active` | всё работает до `paid_until` |
| `payment_due` | всё работает, но показывается предупреждение |
| `suspended` | просмотр доступен, новые осмотры/фото/пользователи/техника запрещены |
| `archived` | доступ только resource admin |

Ограничить при `suspended`:

```txt
POST /api/vehicles
POST /api/vehicles/import
POST /api/users
POST /api/inspections
POST /api/photos
POST /api/vehicle-number/recognize
POST /api/odometer/recognize
```

Разрешить при `suspended`:

```txt
GET /api/vehicles
GET /api/vehicles/:id
GET /api/inspections
GET /api/inspections/:id
GET /api/photos/:id
GET /api/company/usage
```

---

## API

### `GET /api/company/usage`

Расширить ответ.

Пример ответа:

```json
{
  "company_id": "1",
  "plan": {
    "code": "standard",
    "name": "Стандарт",
    "monthly_price_rub": 15000,
    "yearly_price_rub": 150000,
    "recommended": true
  },
  "billing": {
    "status": "active",
    "paid_until": "2026-07-30",
    "trial_until": null,
    "days_left": 24,
    "last_payment_date": "2026-06-30",
    "last_payment_amount_rub": 15000
  },
  "usage": {
    "vehicles": { "used": 38, "limit": 50 },
    "users": { "used": 7, "limit": 10 },
    "inspections_month": { "used": 842, "limit": 2000, "period": "2026-06" },
    "storage_gb": { "used": 21.4, "limit": 50 },
    "ocr_month": { "used": 311, "limit": 2000, "period": "2026-06" }
  },
  "features": {
    "ocr_enabled": true,
    "accident_module_enabled": true,
    "analytics_enabled": true,
    "export_enabled": true,
    "api_enabled": false,
    "custom_branding_enabled": false,
    "regional_storage_enabled": false
  }
}
```

---

### `GET /api/admin/saas/plans`

Только для resource admin.

Возвращает список тарифов.

---

### `POST /api/admin/saas/plans`

Только для resource admin.

Создаёт тариф.

Для MVP можно не делать UI создания тарифов, если тарифы управляются seed-скриптом или внутренним backoffice.

---

### `PUT /api/admin/saas/plans/:code`

Только для resource admin.

Обновляет тариф.

---

### `GET /api/admin/saas/companies/:id/billing`

Только для resource admin.

Возвращает тариф, оплату, лимиты и историю платежных событий компании.

---

### `PUT /api/admin/saas/companies/:id/billing`

Только для resource admin.

Обновляет:

```txt
plan_code
billing_status
paid_until
trial_until
payment_comment
```

Обязательно пишет событие в `company_billing_events`.

---

### `POST /api/admin/saas/companies/:id/payments`

Только для resource admin.

Добавляет ручную оплату.

Payload:

```json
{
  "amount_rub": 15000,
  "payment_date": "2026-06-30",
  "period_start": "2026-07-01",
  "period_end": "2026-07-31",
  "payment_method": "bank_transfer",
  "invoice_number": "INV-2026-001",
  "contract_number": "AAV-2026-001",
  "comment": "Оплата тарифа Стандарт за июль"
}
```

После добавления оплаты:

- обновить `last_payment_date`;
- обновить `last_payment_amount_rub`;
- обновить `paid_until`;
- перевести `billing_status` в `active`, если компания была `payment_due` или `suspended`;
- записать событие `payment_added`.

---

### `PUT /api/admin/saas/companies/:id/limits`

Только для resource admin.

Позволяет задать индивидуальные лимиты компании.

Payload может быть частичным:

```json
{
  "max_vehicles": 75,
  "max_users": 15,
  "storage_limit_gb": 100,
  "ocr_monthly_limit": 5000,
  "analytics_enabled": true,
  "limits_comment": "Индивидуальные условия по договору"
}
```

---

## Web: панель владельца / менеджера компании

### Где показывать

В разделе настроек компании:

```txt
Настройки -> Тариф и лимиты
```

И короткий виджет на дашборде, если до окончания оплаты осталось мало дней.

---

### Блок «Тариф и доступные модули»

Показать:

```txt
Тариф: Стандарт
Статус: Активен
Оплачен до: 30.07.2026
Осталось: 24 дня
```

Лимиты:

```txt
Техника: 38 / 50
Пользователи: 7 / 10
Осмотры за месяц: 842 / 2 000
Хранилище: 21.4 ГБ / 50 ГБ
OCR за месяц: 311 / 2 000
```

Модули:

```txt
✓ Быстрый осмотр
✓ Плановый осмотр
✓ ДТП-осмотр
✓ OCR номера
✓ OCR одометра
✓ Аналитика
✓ Экспорт отчётов
– API
– Брендирование
```

CTA:

```txt
Продлить тариф
Увеличить лимит
Связаться с поддержкой
```

Для MVP CTA могут вести на `mailto`, Telegram или статичный блок с контактами.

---

### Предупреждения

#### До окончания тарифа 14 дней

```txt
Срок действия тарифа заканчивается 30.07.2026. Чтобы осмотры и загрузка фото продолжили работать без ограничений, продлите тариф заранее.
```

#### До окончания тарифа 7 дней

```txt
До окончания тарифа осталось 7 дней. После окончания оплаты новые осмотры могут быть ограничены.
```

#### Срок оплаты закончился

```txt
Срок действия тарифа закончился. История осмотров доступна, но новые действия могут быть ограничены. Свяжитесь с поддержкой для продления.
```

#### Компания заблокирована

```txt
Компания временно ограничена из-за статуса оплаты. Просмотр истории доступен, создание новых осмотров, техники и пользователей отключено.
```

---

## Web: панель администратора ресурса

### Страница компаний

Добавить / доработать отдельную страницу:

```txt
/saas-admin/companies
```

Колонки:

```txt
Компания
Владелец
Тариф
Статус оплаты
Оплачен до
Техника
Пользователи
Осмотры за месяц
Хранилище
OCR
Последняя активность
Действия
```

Фильтры:

```txt
Тариф
Статус оплаты
Скоро истекает
Просрочено
Без владельца
Без лимитов
```

---

### Карточка компании

На странице компании добавить вкладки:

```txt
Обзор
Владелец
Пользователи
Тариф и оплата
Лимиты
История
```

---

### Вкладка «Тариф и оплата»

Функции:

- сменить тариф;
- указать дату окончания оплаты;
- указать trial date;
- изменить статус оплаты;
- добавить ручную оплату;
- видеть последнюю оплату;
- видеть историю платежных событий.

Поля формы ручной оплаты:

```txt
Сумма
Дата оплаты
Период с
Период по
Способ оплаты
Номер счёта
Номер договора
Комментарий
```

---

### Вкладка «Лимиты»

Функции:

- показать лимиты тарифа;
- показать фактическое использование;
- разрешить индивидуально изменить лимит;
- показать, какие значения переопределены вручную.

Визуальный принцип:

```txt
Техника: 38 / 50
[########--------]
```

Если использование больше 80% — показать предупреждение.

Если использование достигло 100% — показать красный статус и действие «Увеличить лимит».

---

## Уведомления

### Кому отправлять

1. Владельцу компании.
2. Назначенному администратору компании, если владелец включил получение сервисных уведомлений для него.
3. Администратору ресурса.

---

### События уведомлений

```txt
billing_expires_soon_14_days
billing_expires_soon_7_days
billing_expires_soon_3_days
billing_expired
company_suspended
vehicle_limit_80_percent
vehicle_limit_100_percent
user_limit_80_percent
user_limit_100_percent
inspection_limit_80_percent
inspection_limit_100_percent
storage_limit_80_percent
storage_limit_100_percent
ocr_limit_80_percent
ocr_limit_100_percent
```

---

### Каналы

Для MVP:

```txt
Внутренние уведомления в web-панели
```

Следующий этап:

```txt
Telegram bot
Email
```

---

## Автоматический пересчёт статусов

Добавить daily job / script:

```txt
backend/scripts/billing-status-job.mjs
```

Задачи:

1. найти компании, у которых `paid_until` истекает через 14 / 7 / 3 дня;
2. создать уведомления;
3. если дата оплаты прошла — перевести в `payment_due`;
4. если просрочка больше заданного периода — перевести в `suspended`;
5. записать событие в `company_billing_events`.

Настройки grace period:

```txt
BILLING_GRACE_DAYS=7
BILLING_SUSPEND_AFTER_DAYS=14
```

---

## Хранилище фото

Добавить расчёт использования хранилища на компанию.

Считать:

```txt
original file size
webp file size
thumb file size
```

Если размеры уже сохраняются в таблице `photos`, считать по ним.

Если нет — добавить безопасный backfill script:

```txt
backend/scripts/backfill-photo-storage-usage.mjs
```

Для MVP можно считать приближённо по данным таблицы `photos`, без обхода файловой системы при каждом запросе.

---

## UI-копирайтинг

### Для владельца компании

```txt
Ваш тариф контролирует доступные лимиты: количество техники, пользователей, осмотров, OCR и хранилища фото.
```

```txt
Если лимит почти исчерпан, вы можете увеличить его без смены всей системы.
```

```txt
История осмотров и фото сохраняется даже при окончании оплаты. Новые действия могут быть ограничены до продления тарифа.
```

---

### Для resource admin

```txt
Тариф и лимиты управляют доступом компании к модулям сервиса. Индивидуальные условия можно задать поверх базового тарифа.
```

```txt
Ручная оплата продлевает срок действия тарифа и фиксируется в истории компании.
```

---

## Frontend implementation notes

### Компоненты

Создать или доработать:

```txt
web/src/components/billing/PlanBadge.tsx
web/src/components/billing/UsageMeter.tsx
web/src/components/billing/FeatureList.tsx
web/src/components/billing/BillingStatusBanner.tsx
web/src/components/billing/PaymentForm.tsx
web/src/components/billing/CompanyLimitsForm.tsx
web/src/components/billing/BillingEventsTimeline.tsx
```

Стили — только во внешних CSS-файлах, без inline styles.

Пример:

```txt
web/src/styles/billing.css
```

Подключить через существующий layout/style pipeline проекта.

---

## Backend implementation notes

### Сервисы

Создать:

```txt
backend/src/services/billing.js
backend/src/services/companyUsage.js
backend/src/services/planLimits.js
backend/src/services/billingEvents.js
```

Не раздувать `server.js`. Новую бизнес-логику вынести в отдельные сервисы и маршруты.

### Routes

Создать / доработать:

```txt
backend/src/routes/companyUsage.js
backend/src/routes/adminBilling.js
backend/src/routes/adminPlans.js
```

### Guards

Создать / доработать:

```txt
backend/src/middleware/requireActiveBilling.js
backend/src/middleware/requirePlanFeature.js
backend/src/middleware/requireResourceLimit.js
```

---

## Миграции

Добавить безопасные миграции:

```txt
backend/src/migrations/xxxx_add_billing_tables.sql
backend/src/migrations/xxxx_extend_plans_and_company_limits.sql
backend/src/migrations/xxxx_add_usage_limits.sql
```

Требования:

- не удалять существующие таблицы;
- не терять существующие лимиты компаний;
- если у компании нет тарифа — назначить `pilot`;
- если у компании нет billing-записи — создать со статусом `trial` или `active` по текущей логике проекта;
- миграции должны быть повторно безопасными.

---

## Directus / внутренний backoffice

Если в текущей версии проекта Directus используется как внутренний SaaS backoffice:

1. расширить активные коллекции `plans` и `company_limits`;
2. добавить коллекции `company_billing` и `company_billing_events`;
3. обновить `directus/schema/mvp-schema.json`;
4. обновить `directus/schema/collections.md`;
5. обновить seed `directus/scripts/seed-saas-data.mjs`;
6. проверить `npm run directus:bootstrap:dry`;
7. проверить `npm run directus:seed:saas:dry`.

Если Directus не используется в конкретном окружении, вся логика должна работать через custom backend и web-панель администратора ресурса.

---

## Тесты и smoke checks

Добавить smoke-тесты:

```txt
backend/scripts/smoke-billing.mjs
backend/scripts/smoke-plan-limits.mjs
backend/scripts/smoke-company-usage.mjs
backend/scripts/smoke-billing-status.mjs
```

Проверить сценарии:

### 1. Лимит техники

- создать компанию на `pilot`;
- создать 25 единиц техники;
- попытаться создать 26-ю;
- получить `409 vehicle_limit_exceeded`.

### 2. Лимит пользователей

- создать 10 пользователей на `pilot`;
- попытаться создать 11-го;
- получить `409 user_limit_exceeded`.

### 3. Лимит осмотров

- задать `max_inspections_per_month = 1`;
- создать первый осмотр;
- попытаться создать второй;
- получить `409 inspection_limit_exceeded`.

### 4. OCR disabled

- отключить `ocr_enabled`;
- вызвать OCR номера;
- получить `403 ocr_disabled_by_plan`.

### 5. ДТП disabled

- отключить `accident_module_enabled`;
- создать ДТП-осмотр;
- получить `403 accident_module_disabled_by_plan`.

### 6. Аналитика disabled

- отключить `analytics_enabled`;
- открыть аналитику;
- получить `403 analytics_disabled_by_plan`.

### 7. Suspended company

- перевести компанию в `suspended`;
- проверить, что история доступна;
- проверить, что новые осмотры, фото, техника и пользователи запрещены.

### 8. Ручная оплата

- добавить оплату через admin endpoint;
- проверить обновление `paid_until`;
- проверить статус `active`;
- проверить запись в `company_billing_events`.

---

## Команды проверки

После реализации выполнить:

```bash
node --check backend/src/server.js
npm --prefix backend run smoke
npm --prefix web run lint
npm --prefix web run build
npm run verify:launch
```

Если добавлены новые smoke-команды — подключить их к общему backend smoke и launch gate.

---

## Документация

Обновить:

```txt
README.md
docs/product.md
docs/data-model.md
docs/backend.md
docs/web.md
docs/implementation-plan.md
docs/launch-checklist.md
CHANGELOG.md
```

Добавить отдельный документ:

```txt
docs/billing-and-tariffs.md
```

В документе описать:

- тарифы;
- лимиты;
- статусы оплаты;
- поведение при окончании оплаты;
- ручное внесение платежей;
- уведомления;
- права владельца компании и resource admin.

---

## UX / визуальная логика

### Для владельца компании

Главная задача интерфейса — не пугать ограничениями, а показывать прозрачность:

```txt
Вы знаете, сколько техники подключено, сколько осмотров сделано и когда нужно продлить тариф.
```

### Для resource admin

Главная задача — быстро видеть деньги и риски:

```txt
кто оплатил;
у кого скоро заканчивается тариф;
кто превысил лимиты;
у какой компании нет владельца;
у какой компании нет лимитов;
какая компания требует внимания.
```

---

## Acceptance criteria

Задача считается выполненной, если:

1. В системе есть тарифы `pilot`, `standard`, `enterprise`.
2. У каждой компании есть тариф, лимиты и billing status.
3. Resource admin может видеть тариф и оплату компании.
4. Resource admin может вручную добавить оплату.
5. После оплаты обновляется `paid_until` и история событий.
6. Владелец / менеджер компании видит тариф, срок действия, лимиты и доступные модули.
7. Backend блокирует превышение лимитов техники, пользователей и осмотров.
8. Backend блокирует отключённые модули OCR, ДТП, аналитики и экспорта.
9. При `suspended` новые действия запрещены, но история доступна.
10. Предупреждения о скором окончании тарифа отображаются в web-панели.
11. Все проверки tenant-safe.
12. Smoke-тесты проходят.
13. Web build проходит.
14. Launch verify проходит.
15. CHANGELOG обновлён.

---

## Рекомендуемый порядок внедрения

### Этап 1. База и seed

- расширить `plans`;
- расширить `company_limits`;
- добавить `company_billing`;
- добавить `company_billing_events`;
- обновить seed тарифов.

### Этап 2. Backend enforcement

- централизовать получение тарифов и лимитов;
- добавить billing guard;
- добавить лимит осмотров;
- добавить OCR monthly limit;
- добавить export flag;
- улучшить ответы ошибок.

### Этап 3. Web для владельца компании

- расширить `GET /api/company/usage`;
- добавить блок «Тариф и лимиты» в настройках;
- добавить предупреждения на дашборде.

### Этап 4. Web для resource admin

- добавить управление оплатой;
- добавить управление индивидуальными лимитами;
- добавить историю событий;
- добавить фильтры по оплате и лимитам.

### Этап 5. Уведомления и cron/job

- добавить daily billing job;
- добавить уведомления за 14 / 7 / 3 дня;
- добавить события по превышению 80% и 100% лимитов.

### Этап 6. Тесты и документация

- добавить smoke-тесты;
- обновить документацию;
- обновить CHANGELOG;
- выполнить launch verify.

---

## Важные ограничения

- Не добавлять публичную саморегистрацию компаний.
- Не подключать онлайн-эквайринг на этом этапе.
- Не хранить платёжные данные карт.
- Не смешивать billing resource admin с пользовательской панелью компании.
- Не передавать `company_id` в публичных endpoint, если текущая архитектура определяет компанию по пользователю.
- Не давать manager / inspector доступ к управлению тарифами.
- Не ломать текущие `pilot`, `standard`, `enterprise` plan codes.
- Не удалять существующие лимиты компаний при миграции.
- Не делать OCR безлимитным без возможности ограничения.

---

## Короткий промт для Codex

```txt
Реализуй тарифную политику проекта «Аудит Авто» по документу docs/billing-and-tariffs.md / tariff-policy-implementation.md.

Нужно добавить SaaS billing слой: тарифы pilot/standard/enterprise, лимиты компаний, ручной учёт оплат, paid_until, billing_status, историю billing events, расширенный GET /api/company/usage, управление оплатой и лимитами в resource admin, отображение тарифа и лимитов владельцу компании, backend enforcement лимитов техники, пользователей, осмотров, OCR, ДТП-модуля, аналитики и экспорта.

Платежи пока оффлайн, онлайн-эквайринг не подключать. Всё должно быть tenant-safe. Существующие сценарии осмотров, фото, техники, пользователей, OCR, ДТП и аналитики не ломать. Directus использовать только как внутренний SaaS backoffice, если он активен в текущем проекте; пользовательские панели не должны зависеть от Directus напрямую.

После реализации обновить README, docs, CHANGELOG и добавить smoke-тесты. Проверить npm --prefix backend run smoke, npm --prefix web run lint, npm --prefix web run build, npm run verify:launch.
```
