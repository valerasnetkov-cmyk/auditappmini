# Backend Changes

## Billing policy

Тарифные лимиты и feature flags разрешаются сервисом
`src/services/planLimits.js`, а enforcement подключён к технике,
пользователям, осмотрам, OCR, ДТП, аналитике и экспорту. Resource-admin API
реализован в `src/routes/adminBilling.js`. Ежедневная проверка:
`npm run billing:check`.

Подробнее: [billing-and-tariffs.md](./billing-and-tariffs.md).

## Цель

Backend должен поддерживать single-company MVP, но быть готовым к multi-company SaaS через `company_id`.

---

## Обязательные backend-модули

```txt
companies
users
vehicles
inspections
inspection-items
photo-requirements
photos
defects
vehicle-number
odometer
i18n / locale
audit-logs
```

---

## Runtime structure

Current backend runtime is split by responsibility:

```txt
backend/src/server.js              # database init, HTTP listen, socket tracking, graceful shutdown
backend/src/app.js                 # Express app factory and route/middleware wiring
backend/src/config.js              # env-derived runtime configuration and production guard
backend/src/middleware/            # request id, access log, security, auth, rate limits, tenant endpoint predicate
backend/src/routes/                # auth, health, vehicles, inspections, defects, photos, dashboard, analytics, users, settings, uploads
backend/src/services/              # photo upload, company policy, role guards, user store and OCR helpers
backend/src/seed/                  # demo-data and seed endpoints
```

`server.js` intentionally stays small. Request behavior should be changed in
route, middleware, service or config modules first; `server.js` should only
change when boot, listen or shutdown behavior changes.

## Database runtime

`backend/src/db.js` uses `better-sqlite3` against `DATABASE_PATH`. The module
keeps the existing `getDb()` facade (`run`, `get`, `all`) for route and service
code, while the underlying SQLite file is updated directly by the native driver.
`saveDatabase()` is retained only as a compatibility no-op.

---

## Tenant middleware

Каждый запрос после авторизации должен получить:

```txt
req.userId
req.companyId
req.role
```

`company_id` не должен приходить из публичного URL как источник доверия. Backend определяет компанию по пользователю и выбранному tenant-контексту.

---

## API: Vehicles

```txt
GET    /api/vehicles
GET    /api/vehicles/:id
GET    /api/vehicles/by-number/:number
POST   /api/vehicles
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id
```

Все запросы фильтруются по `company_id`.

---

## API: Vehicle Number

### POST /api/vehicle-number/recognize

Распознать номер по фото.

Результат не запускает осмотр автоматически.

### POST /api/vehicles/resolve-number

Нормализовать введённый номер и найти технику в текущей компании.

Ручной ввод принимает только латиницу и цифры.

---

## API: Odometer

### POST /api/odometer/recognize

Принимает фото одометра, возвращает распознанное числовое значение и confidence. Единица измерения берётся из настроек компании.

Ответ:

```json
{
  "rawText": "128450",
  "recognizedValue": 128450,
  "unit": "km",
  "confidence": 0.86,
  "candidates": [
    { "value": 128450, "confidence": 0.86 }
  ]
}
```

### POST /api/inspections/:id/odometer

Сохраняет подтверждённый инспектором километраж в карточку осмотра.

Запрос:

```json
{
  "odometerValue": 128450,
  "unit": "km",
  "odometerValueKm": 128450,
  "photoId": "photo-id",
  "recognitionId": "recognition-id"
}
```

Правила:

- принимать только целое число;
- валидировать `unit`: только `km` или `mi`;
- сохранять `odometer_value`, `odometer_unit` и `odometer_value_km`;
- не принимать отрицательные значения;
- при значении меньше предыдущего пробега помечать осмотр `requires_review`;
- сравнение с предыдущим пробегом выполнять через нормализованное значение `odometer_value_km`;
- не считать OCR-результат финальным без подтверждения инспектора.

---

## API: Inspections

```txt
GET  /api/inspections
GET  /api/inspections/:id
GET  /api/vehicles/:id/inspections
POST /api/inspections
POST /api/inspections/:id/accident-details
POST /api/inspections/:id/complete
```

### POST /api/inspections

Создаёт осмотр.

Минимальный payload:

```json
{
  "vehicleId": "vehicle-id",
  "type": "quick"
}
```

Допустимые типы:

```txt
quick
planned
accident
```

### POST /api/inspections/:id/accident-details

Сохраняет обязательные данные ДТП. Используется только для `type = accident`.

```json
{
  "accidentOccurredAt": "2026-05-02T14:30:00+03:00",
  "accidentPlace": "г. Москва, парковка ..., ориентир ...",
  "accidentLatitude": 55.7558,
  "accidentLongitude": 37.6173,
  "locationSource": "gps",
  "timeSource": "manual"
}
```

Минимально обязательны `accidentOccurredAt` и `accidentPlace`. Координаты сохраняются, если доступны.

---

## Проверка завершения осмотра

Перед завершением backend проверяет:

- пользователь принадлежит текущей компании;
- техника принадлежит текущей компании;
- номер техники подтверждён;
- тип осмотра задан;
- обязательные фото по типу осмотра загружены;
- для быстрого и планового осмотра есть фото одометра;
- километраж подтверждён или введён вручную;
- все `НЕТ` в чек-листе имеют дефект и фото;
- для ДТП есть общий план повреждения и крупный план каждого повреждённого участка;
- для ДТП указано место ДТП;
- для ДТП указаны дата и время ДТП;
- фото имеют дату, время и геоданные.

Пример ошибки:

```json
{
  "error": "inspection_validation_failed",
  "missingPhotos": ["front", "odometer"],
  "missingData": ["odometerValue", "accidentOccurredAt", "accidentPlace"]
}
```

---

## API: Photos

```txt
POST /api/photos
GET  /api/photos/:id
```

При загрузке фото передаётся `photo_type`:

```json
{
  "inspectionId": "inspection-id",
  "photoType": "front",
  "takenAt": "client-timestamp",
  "latitude": 0,
  "longitude": 0
}
```

Допустимые типы:

```txt
front
left_side
right_side
rear
overall
odometer
number_plate
undercarriage
brake_system
electrical
lighting
component_detail
defect
accident_overall
accident_damage_close
other
```

---

## API: Photo Requirements

```txt
GET /api/photo-requirements/:inspectionType
```

Возвращает список обязательных фото для выбранного типа осмотра.

---

## API: Defects

```txt
GET  /api/defects
GET  /api/vehicles/:id/defects
POST /api/defects
```

Для ДТП дефекты могут использоваться для описания повреждений.

## ДТП: место и время

Backend не должен автоматически считать `started_at` временем ДТП. Для `accident`-осмотра должны быть отдельные поля:

```txt
accident_occurred_at
accident_place_text
accident_latitude
accident_longitude
accident_location_source
accident_time_source
```

Перед завершением осмотра `accident_occurred_at` и `accident_place_text` обязательны.

---

## Audit logs

Backend должен писать журнал для действий:

- создание и завершение осмотра;
- подтверждение номера;
- подтверждение километража;
- загрузка обязательных фото;
- создание дефекта;
- изменение техники;
- изменение настроек компании.

---

## Что не делать в backend

- Не доверять `company_id` из тела запроса.
- Не завершать осмотр без серверной проверки обязательных фото.
- Не сохранять OCR номера или одометра как финальное значение без подтверждения инспектора.
- Не отдавать фото без проверки доступа по `company_id`.
- Не хранить секреты, реальные URL и ключи в репозитории.

## API: Checklist Templates

```txt
GET  /api/checklist-templates/:inspectionType
POST /api/checklist-templates
PUT  /api/checklist-templates/:id
```

Для планового осмотра backend должен вернуть чек-лист, сгруппированный по разделам:

```txt
exterior
undercarriage
brake_system
electrical
lighting
odometer
```

Пункт чек-листа должен содержать:

```json
{
  "id": "item-id",
  "sectionKey": "brake_system",
  "componentArea": "brake_system",
  "title": "Нет видимых подтёков тормозной жидкости",
  "required": true,
  "requiresPhotoOnFail": true
}
```

При завершении планового осмотра backend проверяет, что обязательные пункты всех технических разделов заполнены. Если пункт имеет результат `false`, создаётся дефект с соответствующим `component_area`.

---

## API: Theme / Preferences

Backend должен хранить пользовательскую настройку темы и настройку темы компании.

Поддерживаемые значения:

```txt
system
light
dark
```

### PATCH /api/me/preferences

Обновляет личные настройки текущего пользователя.

Пример запроса:

```json
{
  "themePreference": "dark"
}
```

Пример ответа:

```json
{
  "locale": "ru",
  "themePreference": "dark"
}
```

### PATCH /api/company/settings

Для `owner`. Обновляет настройки компании внутри tenant-контура. Администратор ресурса не изменяет эти настройки через пользовательские company endpoints.

Пример запроса:

```json
{
  "defaultTheme": "system"
}
```

Правила backend:

- принимать только `system`, `light`, `dark`;
- не передавать `company_id` из клиента;
- писать изменение темы в `audit_logs`, если это настройка компании;
- возвращать тему в `/api/auth/me`, чтобы web и mobile могли применить её при старте.

## Regional backend requirements

Backend должен работать как региональный сервис. Один и тот же код разворачивается в разных регионах с разными переменными окружения.

```txt
APP_REGION=ru
APP_REGION=eu
APP_REGION=intl
```

Каждый backend обслуживает только компании своего региона.

Обязательные проверки:

```txt
- company.region_code соответствует APP_REGION;
- user состоит в company_users;
- все запросы фильтруются по company_id;
- OCR вызывается только внутри текущего региона;
- storage bucket соответствует региону компании;
- backup и audit logs остаются в регионе.
```

### Ошибка region_mismatch

Если запрос пытается обратиться к компании из другого региона, backend возвращает:

```json
{
  "error": "region_mismatch"
}
```

### Tenant registry endpoint

Публичный endpoint может возвращать только безопасные данные:

```txt
GET /api/public/tenant/:slug
```

Ответ:

```json
{
  "slug": "company-slug",
  "publicName": "Company",
  "regionCode": "ru",
  "apiClusterKey": "ru-api",
  "status": "active"
}
```

Запрещено возвращать email пользователей, ФИО, реальные storage URLs, секреты и внутренние ключи.

---

## Vehicle Number OCR implementation

Распознавание номера реализуется через backend endpoint, а не напрямую через mobile-приложение к внешнему сервису.

```txt
POST /api/vehicle-number/recognize
POST /api/vehicle-number/:recognitionId/confirm
POST /api/vehicles/resolve-number
```

Правила backend:

- `POST /api/vehicle-number/recognize` принимает `multipart/form-data` с полем `image`;
- endpoint выбирает OCR/ANPR-провайдера по `req.regionCode`;
- результат сохраняется в `vehicle_number_recognitions`;
- распознанный номер проходит `normalizeVehicleNumber`;
- для российских номеров применяется маска `L DDD LL RR/RRR`;
- OCR-ошибки исправляются по позиционной маске, но финальное значение подтверждает инспектор;
- результат OCR не создаёт осмотр и не создаёт технику;
- ключи OCR-провайдеров хранятся только на backend;
- временные файлы удаляются после обработки, если фото не сохраняется как доказательное.

Пример ответа:

```json
{
  "recognitionId": "recognition-id",
  "rawText": "А123ВС77",
  "normalizedNumber": "A123BC77",
  "confidence": 0.91,
  "provider": "regional-anpr",
  "candidates": [
    { "number": "A123BC77", "confidence": 0.91, "isValid": true }
  ]
}
```

Ошибки:

```txt
image_required
invalid_image_type
image_too_large
ocr_region_unavailable
ocr_failed
plate_not_found
invalid_plate_format
latin_input_required
tenant_access_denied
region_mismatch
```

Модульная структура:

```txt
backend/src/modules/vehicle-number/
├── vehicle-number.routes.ts
├── normalize-vehicle-number.ts
├── extract-plate-candidates.ts
├── vehicle-number-recognition.service.ts
├── vehicle-number-recognition.repository.ts
└── providers/
    ├── index.ts
    ├── local-ocr.provider.ts
    ├── anpr-http.provider.ts
    └── mock.provider.ts
```
