# Задача Codex: мобильное добавление авто, быстрый осмотр и фото общего плана

> Scope update: концепция добавления авто инспектором из мобильного приложения
> снята с текущей реализации. Актуальный оставшийся пункт этого документа —
> ограничить выбор основного фото в web-карточке техники только фотографиями
> общего плана (`photo_type = overall`), без mobile-create, quick-flow,
> verification-status и новых mobile-экранов.

## Контекст

В проекте AuditAvto проведение осмотров выполняется только через мобильное приложение. Web-контур остаётся для контроля, истории, карточек техники, дефектов, согласования и отчётов.

Нужно расширить мобильную версию:

1. Добавить возможность создать новое авто прямо из mobile app.
2. Добавить удобный сценарий быстрого осмотра.
3. В карточку авто сохранять фото общего плана автомобиля.
4. Новое авто, созданное в mobile app, должно появляться в web-контуре компании в разделе **«Техника»** как новая карточка со статусом ожидания подтверждения.
5. Manager или owner должны подтвердить внесение данных, а при необходимости исправить номер, название, регион, модель или другое описание.
6. В web-карточке авто оставить выбор фото только из фотографий общего плана, а не из всех фото осмотров.

---

## Главные ограничения

1. Не возвращать проведение осмотра в web.
2. Не ломать текущий mobile-only inspection contract.
3. Не смешивать фото общего плана авто с доказательными фото осмотра.
4. Не ломать текущие PDF-отчёты, watermark, readiness и фотофиксацию осмотров.
5. Не отключать MIME-проверку через `sharp`, `MAX_IMAGE_PIXELS`, protected uploads и tenant isolation.
6. Не давать resource-admin доступ к tenant endpoints техники, осмотров и фото.
7. Все новые действия должны учитывать subscription/company guards:

   * при `suspended` компания read-only;
   * при `expired` новые операционные записи запрещены;
   * при disabled/archived company действия запрещены.
8. Все изменения должны пройти backend smoke, web build/lint и mobile typecheck.

---

# 1. Мобильное добавление авто

## Цель

Инспектор или другой разрешённый пользователь в mobile app должен иметь возможность добавить авто без перехода в web.

При этом карточка, созданная инспектором, не должна сразу считаться полностью подтверждённой. Она должна попадать в web-раздел компании **«Техника»** как новая запись, требующая проверки manager или owner.

## Пользовательский сценарий

```txt
Mobile app
  ↓
Главный экран / выбор авто
  ↓
Кнопка "Добавить авто"
  ↓
Форма авто
  ↓
Фото общего плана
  ↓
Сохранить
  ↓
Авто появляется в списке mobile
  ↓
Авто появляется в web: Компания → Техника
  ↓
Статус карточки: "Ожидает подтверждения"
  ↓
Manager / owner проверяет данные
  ↓
При необходимости исправляет номер, модель, регион, название
  ↓
Подтверждает карточку
  ↓
Авто становится подтверждённым и используется в обычных процессах
```

## Поля формы mobile

Минимальный набор:

```txt
Госномер / номер техники
Название / модель
Регион / площадка / подразделение
Фото общего плана авто
```

Рекомендуемые поля:

```txt
number
name
brand
model
region_id или region
notes
overview_photo
```

Если часть полей уже есть в текущем backend-контракте `vehicles`, использовать существующую схему и не создавать дублирующие поля без необходимости.

## Валидация в mobile

* Номер авто обязателен.
* Название/модель желательно, но не должно блокировать создание, если текущий backend допускает только номер.
* Фото общего плана желательно сделать обязательным для mobile-created vehicle.
* Если фото не удалось загрузить, авто не должно становиться «битым»: показать ошибку и дать повторить загрузку.
* При дубликате номера показать понятное сообщение.
* Если компания заблокирована, подписка истекла или лимит техники превышен, показать понятную причину.

## UX mobile

На главном экране mobile:

```txt
[Начать быстрый осмотр]
[Добавить авто]
[Выбрать авто из списка]
```

На экране добавления:

```txt
Добавить авто

Номер техники *
[__________]

Название / модель
[__________]

Регион / площадка
[__________]

Фото общего плана *
[Сделать фото]

[Сохранить авто]
```

После успешного создания:

```txt
Авто добавлено.

Карточка появится в разделе "Техника" и будет ожидать подтверждения manager или owner.

Начать быстрый осмотр?
[Да, начать] [Позже]
```

---

# 2. Статус подтверждения нового авто

## Цель

Данные, внесённые инспектором в mobile app, должны проходить проверку manager или owner.

Это снижает риск ошибок в номере, модели, регионе или названии техники.

## Новый статус карточки авто

Добавить отдельное поле статуса проверки данных:

```txt
vehicle_verification_status
```

Рекомендуемые значения:

```txt
pending_review
confirmed
needs_correction
rejected
```

Минимально допустимый набор:

```txt
pending_review
confirmed
```

## Поведение статусов

### `pending_review`

Статус по умолчанию для авто, созданного из mobile app инспектором.

Означает:

* авто отображается в web-разделе **«Техника»**;
* карточка помечена бейджем **«Ожидает подтверждения»**;
* manager/owner могут открыть карточку, проверить и исправить данные;
* быстрый осмотр можно разрешить сразу, но в интерфейсе нужно показать, что данные авто ещё не подтверждены.

### `confirmed`

Статус после проверки manager или owner.

Означает:

* данные карточки проверены;
* бейдж ожидания исчезает;
* авто считается полноценной подтверждённой единицей техники.

### `needs_correction`

Опционально.

Означает:

* manager/owner заметил ошибку;
* карточка требует исправления;
* можно показать комментарий, что нужно исправить.

### `rejected`

Опционально.

Означает:

* авто создано ошибочно;
* запись не должна использоваться в новых осмотрах;
* лучше не удалять физически, а архивировать или пометить как отклонённую.

## Кто может подтверждать

```txt
owner: да
manager: да
inspector: нет
admin/resource_manager: нет через tenant endpoints
```

Resource-admin не должен подтверждать технику через tenant API, так как это операционные данные компании.

---

# 3. Web: отображение нового авто в разделе «Техника»

## Цель

Авто, созданное в mobile app, должно появляться в web-контуре компании:

```txt
Компания → Техника
```

## В списке техники

Для новых записей добавить бейдж:

```txt
Ожидает подтверждения
```

Возможные колонки/индикаторы:

```txt
Номер
Название / модель
Регион
Статус техники
Проверка данных
Создано через
Дата создания
Создал
```

Для mobile-created vehicles:

```txt
created_source = mobile
created_by = inspector user id
vehicle_verification_status = pending_review
```

## Фильтры

Добавить фильтр:

```txt
Все
Подтверждённые
Ожидают подтверждения
Требуют исправления
```

Или в существующий фильтр статусов добавить отдельный фильтр проверки данных.

## В карточке авто

Добавить блок:

```txt
Проверка данных

Статус: Ожидает подтверждения
Создано через мобильное приложение
Добавил: Иван Иванов, инспектор
Дата: 30.06.2026

[Подтвердить данные]
[Редактировать]
```

Если есть ошибки:

```txt
[Отправить на исправление]
[Отклонить карточку]
```

Если оставляем минимальный вариант, достаточно:

```txt
[Редактировать]
[Подтвердить данные]
```

## Редактирование перед подтверждением

Manager/owner должны иметь возможность исправить:

```txt
number
name
brand
model
region
notes
overview_photo, если нужно заменить
```

После сохранения исправлений карточка всё ещё может оставаться `pending_review`, пока manager/owner явно не нажмёт **«Подтвердить данные»**.

---

# 4. Backend: модель данных для подтверждения авто

## Добавить поля в `vehicles`

Рекомендуемые поля:

```txt
verification_status TEXT DEFAULT 'confirmed'
created_source TEXT DEFAULT 'web'
created_by TEXT NULL
verified_at TEXT NULL
verified_by TEXT NULL
verification_comment TEXT NULL
overview_photo_id TEXT NULL
```

Для существующих авто миграция должна выставить:

```txt
verification_status = 'confirmed'
created_source = 'legacy'
```

Для новых авто из mobile:

```txt
verification_status = 'pending_review'
created_source = 'mobile'
created_by = current user id
```

## Возможные значения `verification_status`

```txt
pending_review
confirmed
needs_correction
rejected
```

Если нужно упростить первую реализацию:

```txt
pending_review
confirmed
```

## Новый endpoint подтверждения

Добавить endpoint:

```txt
POST /api/vehicles/:id/confirm
```

или:

```txt
POST /api/vehicles/:id/verification
```

Payload:

```json
{
  "status": "confirmed",
  "comment": "Данные проверены"
}
```

Backend должен:

* проверить tenant isolation;
* проверить роль owner/manager;
* запретить inspector подтверждать свои записи;
* проверить subscription/company guard;
* обновить `verification_status`;
* записать `verified_at`;
* записать `verified_by`;
* записать `verification_comment`, если передан;
* добавить audit log.

## Endpoint редактирования

Существующий:

```txt
PUT /api/vehicles/:id
```

должен позволять manager/owner исправить карточку перед подтверждением.

Важно:

* редактирование не должно автоматически подтверждать карточку, если это не оговорено явно;
* лучше оставить явное действие **«Подтвердить данные»**.

## Audit log

Фиксировать события:

```txt
vehicle.created_from_mobile
vehicle.overview_photo_uploaded
vehicle.edited_before_confirmation
vehicle.confirmed
vehicle.needs_correction
vehicle.rejected
```

---

# 5. Фото общего плана авто

## Цель

В карточке авто должно быть отдельное фото общего плана. Оно не должно выбираться из любых фото осмотров подряд.

## Разделение типов фото

Нужно явно разделить:

```txt
vehicle_overview_photo
  фото общего плана авто, используется в карточке техники

inspection_photo
  доказательные фото конкретного осмотра

defect_photo
  фото конкретного дефекта

accident_photo
  фото ДТП-сценария
```

## Backend-варианты реализации

Предпочтительный вариант:

```txt
vehicles.overview_photo_id
```

или:

```txt
vehicle_photos
  id
  company_id
  vehicle_id
  photo_id
  photo_type = 'overview'
  created_at
  created_by
```

Если в проекте уже есть `photo_type`, лучше использовать его и добавить тип:

```txt
vehicle_overview
```

или:

```txt
overview
```

Важно: тип должен быть однозначно отделён от фото осмотра.

## Правила для фото общего плана

* Фото привязано к `vehicle_id`.
* Фото доступно только внутри tenant.
* Фото проходит ту же безопасную загрузку, что и остальные изображения:

  * фактическая MIME-проверка;
  * `MAX_IMAGE_PIXELS`;
  * safe upload path;
  * protected access.
* Фото может иметь watermark/thumbnail, если текущая photo pipeline это поддерживает.
* Замена фото общего плана должна фиксироваться в audit/history.

## Mobile

При добавлении авто:

```txt
1. Пользователь вводит номер.
2. Делает фото общего плана.
3. Mobile создаёт авто.
4. Mobile загружает фото как overview.
5. Backend записывает overview_photo_id в карточку авто.
6. Карточка получает verification_status = pending_review.
```

При существующем авто:

Добавить действие:

```txt
Обновить фото общего плана
```

Оно должно:

* открыть камеру;
* загрузить фото как overview;
* обновить `overview_photo_id`;
* если авто уже confirmed, можно оставить confirmed;
* если авто pending_review, оставить pending_review до проверки manager/owner.

---

# 6. Быстрый осмотр в мобильной версии

## Цель

Сделать быстрый сценарий осмотра для инспектора: минимум действий, без лишнего выбора, но с сохранением доказательности.

## Сценарий

```txt
Mobile app
  ↓
Начать быстрый осмотр
  ↓
Выбрать авто или добавить новое
  ↓
Если авто новое, сделать фото общего плана
  ↓
Создать quick inspection
  ↓
Если авто pending_review, показать предупреждение
  ↓
Сделать обязательные фото quick-осмотра
  ↓
Заполнить короткий чек-лист
  ↓
Подтвердить пробег или указать причину недоступности
  ↓
Readiness
  ↓
Завершить
  ↓
Отправить на согласование
```

## UX быстрого осмотра

На главном экране mobile:

```txt
Быстрый осмотр

1. Выберите авто
2. Сделайте фото
3. Подтвердите состояние
4. Завершите осмотр
```

Кнопки:

```txt
[Начать быстрый осмотр]
[Добавить авто]
```

Если авто не найдено:

```txt
Авто не найдено.
[Добавить новое авто]
```

После добавления нового авто:

```txt
Авто добавлено.

Карточка ожидает подтверждения manager или owner.
Вы можете продолжить быстрый осмотр, но данные авто будут помечены как неподтверждённые.

[Продолжить быстрый осмотр]
[Позже]
```

## Тип осмотра

Использовать существующий тип:

```txt
quick
```

Не создавать новый тип, если `quick` уже есть в backend/readiness/PDF.

## Readiness

Быстрый осмотр должен использовать текущий readiness-контракт.

Нельзя завершить quick inspection, если не выполнены обязательные условия:

* обязательные фото;
* обязательные пункты чек-листа;
* дефект на каждый ответ «Нет», если это требуется текущими правилами;
* фото дефекта;
* подтверждённый пробег или причина недоступности.

---

# 7. Web-карточка авто: выбор только фото общего плана

## Текущая проблема

Сейчас в карточке авто можно выбрать фото из списка всех фото. Это создаёт риск, что в качестве основного фото авто будет выбрано фото дефекта, одометра, ДТП или технической детали.

## Новое правило

В карточке авто можно выбрать только фото общего плана.

## Требуемое изменение

Endpoint, который отдаёт варианты фото для карточки авто, должен фильтровать только:

```txt
photo_type = 'vehicle_overview'
```

или эквивалентный тип общего плана.

Если таких фото нет:

```txt
Пока нет фото общего плана.
Добавьте фото общего плана в мобильном приложении.
```

## Запрещено

Не показывать в списке выбора:

* фото дефектов;
* фото одометра;
* фото ДТП;
* фото документов;
* фото отдельных повреждений;
* любые inspection photos, которые не помечены как overview.

## Web UI

В карточке авто:

```txt
Основное фото авто

[Текущее фото общего плана]

Доступные фото общего плана:
[список только overview-фото]

Если список пуст:
Фото общего плана пока не добавлено.
Добавьте его через мобильное приложение.
```

Дополнительно можно оставить read-only подсказку:

```txt
Фото общего плана используется как основное изображение карточки техники. Доказательные фото осмотров остаются внутри конкретных осмотров и не используются как обложка авто.
```

---

# 8. Backend API

## Проверить существующие endpoints

Перед изменениями Codex должен найти текущие endpoints:

```txt
GET /api/vehicles
POST /api/vehicles
GET /api/vehicles/:id
PUT /api/vehicles/:id
GET /api/vehicles/:id/photo-options
POST /api/vehicles/:id/photos
POST /api/inspections
POST /api/inspections/:id/photos
```

Если endpoint names отличаются, использовать текущие контракты проекта.

## Добавить или уточнить endpoints

### Создание авто из mobile

Если `POST /api/vehicles` уже есть и подходит, использовать его.

Нужно убедиться, что endpoint:

* доступен owner/manager/inspector, если продуктово разрешаем инспектору добавлять авто;
* проверяет subscription guards;
* проверяет лимит техники;
* проверяет tenant isolation;
* пишет audit log;
* возвращает созданную карточку авто.

Для inspector-created vehicle:

```txt
verification_status = pending_review
created_source = mobile
created_by = current user id
```

### Загрузка фото общего плана

Добавить endpoint, если его нет:

```txt
POST /api/vehicles/:id/overview-photo
```

или использовать существующий upload endpoint с `photo_type=vehicle_overview`.

Endpoint должен:

* принимать multipart file;
* проверять tenant;
* проверять права;
* проверять subscription/company write guard;
* валидировать изображение;
* сохранять фото;
* обновлять `vehicles.overview_photo_id`;
* возвращать обновлённое фото и карточку авто.

### Подтверждение карточки авто

Добавить endpoint:

```txt
POST /api/vehicles/:id/confirm
```

Payload:

```json
{
  "comment": "Данные проверены"
}
```

Response:

```json
{
  "vehicle": {
    "id": "vehicle-id",
    "verification_status": "confirmed",
    "verified_at": "2026-06-30T00:00:00.000Z",
    "verified_by": "user-id"
  }
}
```

### Варианты фото для web-карточки

Уточнить endpoint:

```txt
GET /api/vehicles/:id/photo-options
```

Теперь он должен возвращать только overview-фото.

Response example:

```json
{
  "photos": [
    {
      "id": "photo-id",
      "url": "/uploads/...",
      "thumbnail_url": "/uploads/...",
      "photo_type": "vehicle_overview",
      "created_at": "2026-06-30T00:00:00.000Z"
    }
  ]
}
```

---

# 9. Mobile implementation

## Проверить текущую структуру

Ожидаемая структура после декомпозиции:

```txt
mobile/src/screens/
mobile/src/hooks/
mobile/src/components/
mobile/src/styles/
mobile/src/api.ts
```

Не возвращать всю бизнес-логику в `App.tsx`.

## Добавить экраны

```txt
mobile/src/screens/AddVehicleScreen.tsx
mobile/src/screens/QuickInspectionStartScreen.tsx
```

или встроить в текущий flow, если архитектурно лучше.

## Добавить hooks

```txt
mobile/src/hooks/useVehicleCreate.ts
mobile/src/hooks/useVehicleOverviewPhoto.ts
mobile/src/hooks/useQuickInspection.ts
```

## Добавить API methods

В `mobile/src/api.ts`:

```txt
createVehicle(payload)
uploadVehicleOverviewPhoto(vehicleId, file)
getVehicles()
createInspection(payload)
```

Если методы уже есть, расширить существующие.

## UX states

Обязательно обработать:

```txt
loading
saving
uploadingPhoto
uploadFailed
duplicateNumber
subscriptionBlocked
companyDisabled
networkError
success
pendingReview
```

## После создания авто

Показать выбор:

```txt
Авто добавлено

Карточка ожидает подтверждения manager или owner.

[Начать быстрый осмотр]
[Вернуться к списку]
```

---

# 10. Data model

## Минимальный вариант

Добавить поля в `vehicles`:

```txt
overview_photo_id
verification_status
created_source
created_by
verified_at
verified_by
verification_comment
```

## Более гибкий вариант для фото

Добавить таблицу:

```txt
vehicle_photos
  id
  company_id
  vehicle_id
  photo_id
  photo_type
  created_at
  created_by
```

Для текущей задачи достаточно:

```txt
photo_type = vehicle_overview
```

## Миграция

Миграция должна быть additive и repeat-safe.

Существующие записи техники:

```txt
verification_status = confirmed
created_source = legacy
```

Новые записи из mobile:

```txt
verification_status = pending_review
created_source = mobile
```

Если у авто уже есть выбранное фото из общего списка, можно оставить его как legacy, но новые варианты выбора должны быть только overview.

---

# 11. Права доступа

## Создание авто

Рекомендуемая политика:

```txt
owner: да
manager: да
inspector: да, только минимальное создание из mobile
admin/resource_manager: нет через tenant endpoints
```

Если проектная политика запрещает inspector создавать технику, Codex должен явно оставить создание только для owner/manager и показать понятную ошибку в mobile.

## Загрузка overview photo

```txt
owner: да
manager: да
inspector: да, если фото добавляется через mobile в рамках создания/осмотра
admin/resource_manager: нет через tenant endpoints
```

## Подтверждение данных авто

```txt
owner: да
manager: да
inspector: нет
admin/resource_manager: нет через tenant endpoints
```

## Web выбор основного фото

```txt
owner: да
manager: да
inspector: нет или read-only, в зависимости от текущей политики web
```

---

# 12. Acceptance criteria

## Mobile

* В mobile app есть кнопка `Добавить авто`.
* Пользователь может создать авто из mobile.
* При создании можно сделать фото общего плана.
* После создания авто можно сразу начать быстрый осмотр.
* Пользователь видит сообщение, что карточка ожидает подтверждения manager или owner.
* Быстрый осмотр создаётся с типом `quick`.
* Быстрый осмотр использует текущий readiness-контракт.
* При ошибке подписки/лимита/сети показывается понятное сообщение.
* `App.tsx` не превращается обратно в монолит.

## Backend

* Есть безопасный способ сохранить `overview_photo_id`.
* Есть статус `verification_status`.
* Авто, созданное из mobile, получает `pending_review`.
* Существующие авто получают `confirmed`.
* Manager/owner могут подтвердить авто.
* Inspector не может подтвердить авто.
* Фото общего плана проходит текущую image validation pipeline.
* `GET /api/vehicles/:id/photo-options` возвращает только overview-фото.
* Tenant isolation сохранён.
* Subscription guards сохранены.
* Лимит техники проверяется при создании авто.
* Smoke покрывает создание авто с overview photo и подтверждение карточки.

## Web

* Новое mobile-created авто появляется в разделе **Компания → Техника**.
* У нового авто есть бейдж **«Ожидает подтверждения»**.
* Manager/owner могут открыть карточку, исправить данные и подтвердить.
* Inspector не видит действие подтверждения.
* В карточке авто выбор фото показывает только фото общего плана.
* Фото дефектов, одометра, ДТП и технических деталей не попадают в список.
* Если overview-фото нет, показывается пустое состояние.
* Основная карточка авто не падает в 404 при отсутствии photo-options.

## Tests

Добавить или обновить:

```txt
backend smoke: vehicle overview photo
backend smoke: vehicle creation from mobile role
backend smoke: mobile-created vehicle has pending_review
backend smoke: owner/manager can confirm vehicle
backend smoke: inspector cannot confirm vehicle
backend smoke: photo-options returns only overview
web test: vehicle list shows pending review badge
web test: owner/manager can confirm vehicle
web test: vehicle card does not show non-overview photo options
mobile typecheck
mobile flow test/manual QA: add vehicle -> overview photo -> quick inspection
```

---

# 13. Проверки

После реализации выполнить:

```bash
npm --prefix backend run lint
npm --prefix backend run test:unit
npm --prefix backend run smoke
npm --prefix web run lint
npm --prefix web run build
npm run mobile:status
npm run mobile:eas:readiness
npm run verify:launch
```

Если добавлены новые smoke:

```bash
npm --prefix backend run smoke:vehicles
npm --prefix backend run smoke:vehicle-overview-photo
npm --prefix backend run smoke:vehicle-verification
```

---

# 14. Обновить документацию

Обновить:

```txt
CHANGELOG.md
docs/mobile.md
docs/web.md
docs/backend.md
docs/data-model.md
```

В `CHANGELOG.md` добавить:

```md
- **Mobile vehicle creation and quick inspection**: mobile app now allows adding a vehicle with a dedicated overview photo, then immediately starting a quick inspection. Vehicles created from mobile are marked as pending review until a manager or owner confirms the data.
- **Vehicle verification workflow**: manager and owner can review, edit and confirm vehicle records created from the mobile app, preventing incorrect plate, model or region data from becoming silently trusted.
- **Vehicle overview photo filtering**: web vehicle card photo selection now only shows dedicated overview photos, preventing defect, odometer, accident or other inspection evidence photos from being used as the vehicle card image.
```

---

# 15. Definition of Done

* Mobile позволяет добавить авто.
* Mobile позволяет начать быстрый осмотр после добавления авто.
* У авто есть отдельное фото общего плана.
* Новое авто из mobile появляется в web-разделе **«Техника»**.
* Новое авто получает статус **«Ожидает подтверждения»**.
* Manager/owner могут исправить и подтвердить данные.
* Inspector не может подтвердить карточку авто.
* Web-карточка авто выбирает фото только из overview-фото.
* Доказательные фото осмотров не используются как обложка авто.
* Tenant isolation сохранён.
* Subscription guards сохранены.
* PDF/readiness/photo validation не сломаны.
* `npm run verify:launch` проходит.
