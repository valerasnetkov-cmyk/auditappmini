# Billing and tariffs

Resource-admin `plans` является источником данных для цен и базовых лимитов
тарифов. Лендинг читает активные публичные тарифы через `GET /api/public/plans`,
а настройки компании читают назначенную effective policy через
`GET /api/company/usage`.

## Базовые тарифы

| Код | Название | Цена/месяц | Техника | Пользователи | Осмотры/месяц | Хранилище | OCR/месяц |
|---|---|---:|---:|---:|---:|---:|---:|
| `pilot` | Пилот | 5 000 ₽ | 25 | 10 | 100 | 10 ГБ | 100 |
| `standard` | Стандарт | 15 000 ₽ | 50 | 10 | 2 000 | 50 ГБ | 2 000 |
| `enterprise` | Enterprise | 50 000 ₽ | 150 | 30 | индивидуально | 200 ГБ | индивидуально |

`standard` является рекомендуемым тарифом. Индивидуальные условия задаются в
`company_limits` поверх базового тарифа.

## Модель данных

- `plans` хранит базовую тарифную сетку, цены, лимиты и feature flags.
- `company_limits` хранит индивидуальные overrides компании.
- `company_billing` хранит текущий статус оплаты и даты действия.
- `company_payments` хранит ручные офлайн-платежи.
- `company_billing_events` хранит историю изменений тарифа, оплаты и лимитов.
- `company_ocr_usage` хранит события OCR для месячного лимита.

Разрешение политики выполняется в порядке:

1. индивидуальное значение `company_limits`;
2. значение базового `plans`;
3. прежнее совместимое поведение для незаданных параметров.

## Статусы оплаты

- `trial`: сервис доступен до `trial_until`;
- `active`: сервис оплачен до `paid_until`;
- `payment_due`: сервис работает с предупреждением;
- `suspended`: история доступна, новые операции заблокированы;
- `archived`: компания недоступна tenant-пользователям.

Переходный legacy-контур `company_subscriptions` сохраняется. При конфликте
строгие статусы `expired` и `suspended` не ослабляются новой billing-записью.

## Enforcement

Backend проверяет:

- количество техники и пользователей;
- осмотры за текущий календарный месяц;
- доступность и месячный лимит OCR;
- ДТП-модуль;
- аналитику и экспорт;
- billing status перед операциями записи.

Все расчёты выполняются по `company_id` из авторизованного пользователя.

## API

Tenant:

- `GET /api/company/usage`

Resource admin:

- `GET|POST /api/admin/saas/plans`
- `PUT /api/admin/saas/plans/:code`
- `GET|PUT /api/admin/saas/companies/:id/billing`
- `POST /api/admin/saas/companies/:id/payments`
- `PUT /api/admin/saas/companies/:id/limits`

Ручная оплата переводит billing в `active`, обновляет `paid_until` и создаёт
событие `payment_added`.

## Daily job

Команда:

```bash
npm --prefix backend run billing:check
```

Job создаёт уведомления за 14/7/3 дня, переводит просроченные записи в
`payment_due`, а после `BILLING_SUSPEND_AFTER_DAYS` — в `suspended`.

Настройки:

```env
BILLING_GRACE_DAYS=7
BILLING_SUSPEND_AFTER_DAYS=14
```

## Проверка

```bash
npm --prefix backend run smoke:billing-policy
npm --prefix backend run smoke
npm --prefix web run lint
npm --prefix web run build
```
