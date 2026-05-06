# Directus CMS / Data Studio

Directus добавляется в auditappmini как отдельный CMS/Data Studio слой рядом с текущим backend. Это не миграция проекта на Directus и не замена Express + SQLite API.

## Роль Directus

Directus нужен для удобного управления и просмотра данных:

- компании и настройки компаний;
- техника и привязка к компании;
- ДТП-заявки и их статусы;
- участники ДТП;
- повреждения;
- фото-метаданные;
- результаты OCR пробега и номера;
- antifraud-флаги;
- справочники и операторские роли.

## Что остается в custom backend

- OCR номера автомобиля.
- OCR одометра.
- Hash фотографий.
- Проверки гео и времени.
- Генерация PDF.
- ZIP-экспорт.
- Antifraud-логика.
- Webhooks.
- Бизнес-логика завершения ДТП-заявки.
- Защищенная фотофиксация.

## Архитектура

```txt
mobile-app / web
        |
custom backend
        |
OCR / hash / reports / fraud logic
        |
Directus REST API
        |
PostgreSQL + Directus Studio
```

## Коллекции

MVP-схема описана в `directus/schema/collections.md`:

- `companies`
- `vehicles`
- `accident_cases`
- `accident_participants`
- `damages`
- `photos`
- `odometer_recognitions`
- `plate_recognitions`
- `fraud_checks`

Связи строятся от `accident_cases` к компании, технике, участникам, повреждениям, фото, OCR и fraud-проверкам.

## Роли

MVP-роли описаны в `directus/schema/seed.md`:

- `Admin`
- `Company Manager`
- `Operator`
- `Auditor / Read-only`

Для MVP сложные permission filters можно настроить вручную в Directus UI после первого запуска. В production важно ограничить доступ по `company_id`.

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
DIRECTUS_DEFAULT_COMPANY_ID=
```

`DIRECTUS_DEFAULT_COMPANY_ID` опционален. Его можно заполнить UUID компании из Directus, когда будет создана связанная компания. Без него backend готовит и отправляет ДТП-карточку без прямой relation-привязки к `companies`, чтобы не смешивать SQLite id и Directus UUID.

Web не подключается к Directus напрямую. Все проверки и sync-операции идут через custom backend, чтобы service token и права Directus не попадали во frontend bundle.

## Safety rules

- Не удалять SQLite backend.
- Не переписывать весь API.
- Не переносить OCR в Directus.
- Не хранить OCR API tokens во frontend.
- Не давать mobile-app полный прямой доступ к Directus.
- Не делать Directus единственным backend для фотофиксации.
- Не хранить секреты в git.

## Следующие шаги

1. Запустить `docker compose up -d` из папки `directus/`.
2. Создать коллекции по `directus/schema/collections.md`.
3. Создать роли и permissions по `directus/schema/seed.md`.
4. Создать service token для backend.
5. Подключить точечную синхронизацию ДТП-карточки из backend в Directus после завершения серверной валидации.
6. Добавить smoke-проверку Directus integration, когда появится тестовый token в локальном `.env`.

## Bootstrap схемы

MVP-схема также описана машинно в `directus/schema/mvp-schema.json`. После запуска Directus можно выполнить:

```bash
cd directus
node scripts/bootstrap-schema.mjs
```

Для безопасной проверки без подключения к Directus:

```bash
node scripts/bootstrap-schema.mjs --dry-run
```

Скрипт:

- читает `directus/.env`;
- поддерживает dry-run режим для локальной проверки manifest;
- использует `DIRECTUS_TOKEN` или логин администратора из `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD`;
- создает отсутствующие коллекции;
- создает отсутствующие поля;
- не удаляет существующие данные;
- не настраивает relations и permission filters автоматически.

Relations и роли для MVP остаются ручным шагом в Directus Studio, чтобы не применять опасные permission-изменения вслепую.

## Backend endpoints

- `GET /api/integrations/directus/status` - показывает, настроен ли Directus token и какие коллекции ожидаются.
- `GET /api/integrations/directus/inspections/:id/preview` - собирает preview payload для выбранного осмотра без записи в Directus.
- `POST /api/integrations/directus/inspections/:id/sync` - отправляет ДТП-карточку, повреждения и фото-метаданные в Directus. Доступно менеджеру и требует `DIRECTUS_TOKEN`.

Повторный sync использует стабильные source-ключи:

- `accident_cases.case_number = inspection-<inspection_id>`;
- `accident_cases.source_inspection_id`;
- `damages.source_defect_id`;
- `photos.source_photo_id`.

Если запись с таким ключом уже есть в Directus, backend обновляет ее. Новая запись создается только при отсутствии стабильного ключа в Directus.
