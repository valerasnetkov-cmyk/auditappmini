Ты senior fullstack / devops разработчик. Нужно аккуратно интегрировать Directus CMS в существующий проект auditappmini.

Репозиторий:
https://github.com/valerasnetkov-cmyk/auditappmini

Контекст проекта:
- Проект уже существует локально и на GitHub.
- Текущая структура:
  - backend/ — Node.js + Express + SQLite API
  - web/ — Next.js frontend
  - mobile/ — Flutter / Supabase prototype
  - mobile-app/ — Expo / React Native client
- Не удаляй и не ломай существующие backend/, web/, mobile/, mobile-app/.
- Directus нужно добавить как отдельный CMS / Data Studio слой рядом с текущим backend.

Продуктовый фокус:
Проект развивается в B2B-сервис доказательной фиксации ДТП для страховых и лизинговых компаний.

Главный процесс:
ДТП → фиксация фактов → фото-доказательства → карточка случая → отчёт / передача компании

Важно:
- Не делаем управление ремонтом.
- Не делаем расчёт стоимости ущерба.
- Не делаем выплаты.
- Не делаем юридическое сопровождение.
- Фокус только на фиксации факта ДТП и доказательном пакете.

Что должен делать Directus:
Использовать Directus как CMS / admin panel / Data Studio для управления данными:
- компании
- автомобили
- ДТП-заявки
- участники ДТП
- повреждения
- фото-метаданные
- OCR-результаты
- антифрод-флаги
- статусы
- справочники
- пользователи кабинета
- настройки компании

Что НЕ переносить в Directus:
Оставить в кастомном backend:
- OCR номера
- OCR одометра
- hash фото
- проверка гео / времени
- генерация PDF
- ZIP-экспорт
- антифрод-логика
- webhooks
- сложная бизнес-логика завершения ДТП-заявки

Целевая архитектура:
mobile-app / web
        ↓
custom backend
        ↓
OCR / hash / reports / fraud logic
        ↓
Directus API
        ↓
PostgreSQL + Directus Studio

Нужно реализовать:

1. Создать новую ветку:
feature/directus-cms

2. Добавить папку:
directus/

Структура:
directus/
  docker-compose.yml
  .env.example
  README.md
  schema/
    collections.md
    seed.md

3. Поднять Directus через Docker Compose:
- Directus
- PostgreSQL
- volume для базы
- volume для uploads
- volume для extensions
- порт Directus: 8055
- порт PostgreSQL наружу: 5433
- CORS для:
  - http://localhost:3000
  - http://localhost:3002
  - http://localhost:3001

4. Подготовить directus/.env.example

Переменные:
DIRECTUS_PORT=8055
POSTGRES_PORT=5433
POSTGRES_DB=directus
POSTGRES_USER=directus
POSTGRES_PASSWORD=change-me
DIRECTUS_SECRET=change-me-long-random-secret
DIRECTUS_ADMIN_EMAIL=admin@example.com
DIRECTUS_ADMIN_PASSWORD=change-me
CORS_ORIGIN=http://localhost:3000,http://localhost:3002,http://localhost:3001

5. Подготовить Directus collections

Минимальный набор коллекций:

companies
- id
- name
- type: insurance / leasing
- country
- region
- settings
- created_at

vehicles
- id
- company_id
- plate_number
- vin
- brand
- model
- year
- status
- created_at

accident_cases
- id
- company_id
- vehicle_id
- case_number
- accident_date
- accident_time
- accident_geo
- accident_address
- accident_type
- status
- comment
- created_at

accident_participants
- id
- accident_case_id
- type: owner / driver / second_party / witness
- name
- phone
- vehicle_number
- comment

damages
- id
- accident_case_id
- vehicle_zone
- description
- severity
- photo_id
- created_at

photos
- id
- accident_case_id
- damage_id
- type
- url
- geo
- device_time
- server_time
- hash
- created_at

odometer_recognitions
- id
- accident_case_id
- photo_id
- recognized_value
- confirmed_value
- confirmed_by_user
- created_at

plate_recognitions
- id
- accident_case_id
- photo_id
- recognized_plate
- confirmed_plate
- confirmed_by_user
- created_at

fraud_checks
- id
- accident_case_id
- check_type
- result
- score
- details
- created_at

6. Настроить статусы accident_cases

Значения:
- draft
- photo_required
- submitted
- review
- need_more_data
- closed

7. Подготовить роли Directus

Роли:
Admin
- полный доступ

Company Manager
- доступ только к данным своей компании

Operator
- просмотр и редактирование ДТП-заявок
- нельзя удалять фото

Auditor / Read-only
- только просмотр

Для MVP можно описать роли в документации, а не реализовывать сложные permission filters, если это требует ручной настройки через UI.

8. Добавить backend integration

В backend добавить файл:
backend/src/services/directus.js

Он должен:
- читать DIRECTUS_URL
- читать DIRECTUS_TOKEN
- делать request в Directus REST API
- иметь методы:
  - directusRequest(path, options)
  - createAccidentCase(payload)
  - getAccidentCase(id)
  - updateAccidentCase(id, payload)
  - createPhotoMetadata(payload)
  - createFraudCheck(payload)

Добавить в backend/.env.example:
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=change-me-service-token

Важно:
- Не заменять текущие API endpoints полностью.
- Directus подключить как внешний data layer.
- Existing backend должен продолжать запускаться.

9. Добавить web integration

В web добавить:
web/src/lib/directus.ts

Установить пакет:
@directus/sdk

Добавить в web/.env.example:
NEXT_PUBLIC_DIRECTUS_URL=http://localhost:8055

Создать минимальный helper для чтения:
- accident_cases
- vehicles
- companies

Не переписывать весь web-интерфейс.
Только подготовить интеграционный слой.

10. Обновить README.md

Добавить раздел:
"Directus CMS"

В разделе описать:
- зачем добавлен Directus
- как запустить
- какие порты используются
- где открыть админку
- какие env переменные нужны
- как Directus связан с backend и web

Команды:

cd directus
cp .env.example .env
docker compose up -d

Directus URL:
http://localhost:8055

11. Добавить документацию

Создать:
docs/directus-cms.md

Описать:
- роль Directus в проекте
- что хранится в Directus
- что остаётся в custom backend
- коллекции
- связи
- роли
- ограничения
- дальнейшие шаги

12. Добавить safety rules

Не делать:
- не удалять SQLite backend
- не переписывать весь API
- не переносить OCR в Directus
- не хранить OCR API tokens во frontend
- не давать mobile-app прямой полный доступ к Directus
- не делать Directus единственным backend для фотофиксации
- не хранить секреты в git

13. Проверка готовности

После реализации проверь:

- docker compose up -d запускает Directus
- Directus открывается на http://localhost:8055
- backend запускается как раньше
- web запускается как раньше
- .env.example обновлены
- README содержит инструкции
- docs/directus-cms.md создан
- структура directus/ добавлена
- git status показывает только ожидаемые изменения

14. Финальный результат

В конце выведи:
- список созданных файлов
- список изменённых файлов
- команды запуска
- что нужно сделать вручную в Directus UI после первого запуска
- возможные риски
- следующий шаг после интеграции CMS