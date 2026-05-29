# Regional Deployment

## Цель

Описать, как разворачивать один продукт в нескольких регионах без создания отдельных версий проекта.

---

## Базовая схема

```txt
<project-domain>              -> landing / marketing
app.<project-domain>          -> общий вход
<tenant>.<project-domain>     -> кабинет компании

ru-api.<project-domain>       -> RU backend
 eu-api.<project-domain>      -> EU backend
intl-api.<project-domain>     -> INTL backend
```

Домены в документации указываются только как placeholder. Реальные production-домены не должны попадать в публичный репозиторий.

---

## Региональные окружения

```txt
local
staging-ru
staging-eu
staging-intl
production-ru
production-eu
production-intl
```

---

## Разделение инфраструктуры

Каждый регион имеет собственные:

```txt
- API;
- PostgreSQL;
- storage bucket;
- OCR service;
- background workers;
- logs;
- backups;
- secrets;
- monitoring.
```

Общий код один, но переменные окружения разные.

---

## Пример переменных окружения

```txt
APP_REGION=ru
APP_ENV=production
DATABASE_URL=
STORAGE_ENDPOINT=
STORAGE_BUCKET=
OCR_ENDPOINT=
AUTH_SECRET=
```

В `.env.example` значения должны быть пустыми или демонстрационными. Реальные значения не коммитятся.

---

## Tenant registry

Глобальный слой маршрутизации содержит только минимум:

```txt
tenant_slug -> region_code -> api_cluster_key
```

Пример:

```txt
romashka -> ru -> ru-api
berlinfleet -> eu -> eu-api
demo -> intl -> intl-api
```

---

## Routing flow

```txt
1. Пользователь открывает <tenant>.<project-domain>.
2. Frontend определяет tenant slug.
3. Frontend запрашивает публичный tenant registry.
4. Registry возвращает region_code и api_cluster_key.
5. Frontend отправляет запросы только в API нужного региона.
6. Backend повторно проверяет tenant и company_id.
```

Важно: frontend routing не является безопасностью. Безопасность обеспечивается backend-авторизацией, `company_id`, ролями и regional policies.

---

## Regional API contract

Все региональные API должны иметь одинаковый контракт:

```txt
GET /api/vehicles
POST /api/inspections
POST /api/photos
POST /api/vehicle-number/recognize
POST /api/odometer/recognize
```

Это позволяет web/mobile работать с любым регионом без переписывания логики.

---

## Что не делать

```txt
- не хранить всех клиентов в одной глобальной базе;
- не использовать один общий storage bucket для всех регионов;
- не использовать общий OCR без региональной изоляции;
- не смешивать backup разных регионов;
- не хранить реальные URL клиентов в README;
- не делать отдельные ветки кода под каждый регион;
- не позволять frontend менять region_code вручную.
```

## Единицы пробега по региону

Регион может задавать значение по умолчанию для новых компаний:

```txt
RU   -> km
EU   -> km
INTL -> km или mi по стране компании
```

Но финальное значение хранится в `companies.distance_unit` и управляется владельцем компании.

---

## OCR regional routing

OCR/ANPR является частью регионального контура.

```txt
ru-api -> ru-ocr -> ru-storage -> ru-db
eu-api -> eu-ocr -> eu-storage -> eu-db
intl-api -> intl-ocr -> intl-storage -> intl-db
```

Запрещено отправлять фото номера, фото одометра, фото ДТП и другие доказательные материалы в OCR другого региона.

Backend должен возвращать `region_mismatch`, если OCR-провайдер не соответствует региону tenant.
