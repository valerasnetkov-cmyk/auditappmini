# Directus seed and roles

Этот файл описывает стартовые значения и роли для ручной настройки MVP в Directus Studio.

## accident_cases.status

- `draft` - черновик заявки.
- `photo_required` - нужны обязательные фотографии.
- `submitted` - заявка отправлена.
- `review` - проверка оператором или менеджером.
- `need_more_data` - нужны дополнительные данные.
- `closed` - случай закрыт.

## Роли

- `Admin` - полный доступ ко всем коллекциям и настройкам.
- `Company Manager` - доступ только к данным своей компании; в MVP фильтры можно настроить вручную через Directus permissions.
- `Operator` - просмотр и редактирование ДТП-заявок, повреждений, участников и metadata; без удаления фото.
- `Auditor / Read-only` - только просмотр доказательных карточек, фото, OCR-результатов и antifraud-флагов.

## Рекомендуемые справочники

- Типы компаний: `insurance`, `leasing`.
- Типы участников ДТП: `owner`, `driver`, `second_party`, `witness`.
- Статусы техники: `active`, `inactive`, `repair`, `archived`.
- Результаты antifraud: `passed`, `warning`, `failed`, `manual_review`.

## Первые действия

1. Создать администратора при первом запуске через `.env`.
2. Создать роли и базовые permissions.
3. Создать service token для custom backend.
4. Добавить token в `backend/.env` как `DIRECTUS_TOKEN`.
5. Проверить, что mobile-app не получает полный прямой доступ к Directus.
