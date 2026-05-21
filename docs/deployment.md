# Deployment

## Цель

Описать безопасную структуру окружений и доменов без публикации реальных ссылок, ключей и секретов.

---

## Окружения

Рекомендуемые окружения:

```txt
local
staging
production
```

---

## Домены

В документации и коде репозитория не нужно хранить реальные production-ссылки.

Используйте placeholder-формат:

```txt
<project-domain>
<api-domain>
<tenant>.<project-domain>
```

---

## Будущая структура SaaS

```txt
<project-domain>              -> лендинг
app.<project-domain>          -> общий вход
<tenant>.<project-domain>     -> кабинет компании
api.<project-domain>          -> backend API
admin.<project-domain>        -> внутренняя админка сервиса
```

На текущем этапе можно не внедрять поддомены. Достаточно подготовить `companies.slug`.

---

## Wildcard subdomains

Будущий SaaS может использовать wildcard-поддомены:

```txt
*.<project-domain>
```

Это не нужно делать до стабилизации MVP одной компании.

---

## Переменные окружения

В репозиторий можно добавлять только `.env.example`.

В `.env.example` указываются имена переменных без реальных значений:

```txt
APP_ENV=
APP_PORT=
DATABASE_URL=
AUTH_SECRET=
STORAGE_BUCKET=
```

Нельзя добавлять:

```txt
реальные URL базы
реальные production домены
ключи доступа
токены
пароли
service role keys
```

---

## Что должно быть вне репозитория

- production переменные окружения;
- staging переменные окружения;
- приватные ключи;
- токены CI/CD;
- реальные параметры подключения к базе;
- реальные storage credentials;
- реальные домены клиентов.

---

## Что не делать сейчас

- Не настраивать полноценный SaaS deployment до готовности single-company MVP.
- Не делать отдельный deployment на каждую компанию.
- Не хранить production ссылки в README.
- Не писать реальные домены клиентов в публичной документации.

## Health checks

Backend отдаёт безопасные unauthenticated health endpoints:

```txt
/health
/api/health
/api/health/live
/api/health/ready
```

`/health`, `/api/health` и `/api/health/live` подходят для liveness-проверки процесса.

`/api/health/ready` подходит для readiness/monitoring: он проверяет, что backend может выполнить SQLite query и записать временный probe-файл в `UPLOAD_DIR`. Endpoint не возвращает секреты, tenant data или пользовательские данные.

## Regional deployment

Для multi-company SaaS используется несколько региональных окружений:

```txt
staging-ru
staging-eu
staging-intl
production-ru
production-eu
production-intl
```

Каждое окружение имеет собственные:

```txt
DATABASE_URL
STORAGE_ENDPOINT
STORAGE_BUCKET
OCR_ENDPOINT
AUTH_SECRET
LOG_DESTINATION
BACKUP_BUCKET
```

Реальные значения не хранятся в репозитории.

---

## Regional API domains

В документации используются placeholder-домены:

```txt
ru-api.<project-domain>
eu-api.<project-domain>
intl-api.<project-domain>
```

Реальные production-домены, домены клиентов и внутренние endpoints не добавляются в GitHub.

---

## Supabase note

Для международного контура Supabase может быть выбран в подходящем регионе. Для РФ-контура нужно отдельно проверить требования локализации и наличие инфраструктуры на территории РФ. Если выбранный сервис не имеет нужного региона, его нельзя использовать как основной контур для таких данных.
