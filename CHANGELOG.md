# Changelog

## 2026-05-07

### Changed
- **Directus accident case upsert**: повторный `/api/integrations/directus/inspections/:id/sync` теперь ищет `accident_cases` по стабильному `case_number = inspection-<id>` и обновляет существующую карточку, а не всегда создает новую. Дочерние `damages` и `photos` остаются append-only до введения стабильных внешних ключей.
- **Directus child upsert**: в MVP-схему и sync payload добавлены `source_inspection_id`, `source_defect_id` и `source_photo_id`; повторный sync теперь обновляет `damages` и `photos` по стабильным source-ключам вместо append-only дублей.
- **Directus service smoke**: добавлен offline smoke `backend/scripts/smoke-directus-service.mjs` с mocked `fetch`, который проверяет create/update ветки upsert для `accident_cases`, `damages` и `photos` без запущенного Directus.
- **Directus только через backend**: удален неиспользуемый frontend Directus SDK-клиент и `NEXT_PUBLIC_DIRECTUS_URL` из web env-примера. Web продолжает показывать статус CMS через backend endpoint, без прямого доступа к Directus и без service token во frontend bundle.
- **Импорт техники из Excel**: уязвимый `xlsx` заменен на `exceljs`; импорт `.xlsx/.xls` в настройках сохранен, а high-risk SheetJS dependency удалена из web dependency tree.

### Fixed
- **Изоляция smoke-тестов SQLite**: backend теперь уважает `DATABASE_PATH`, а smoke-скрипты запускают сервер на временных `.tmp-smoke/*.sqlite` базах и удаляют их после проверки. Повторные smoke-запуски больше не загрязняют основную `backend/src/database.sqlite`.
- **CORS env example**: `backend/.env.example` приведен к фактическому имени переменной `CORS_ORIGINS` и включает стандартный web-порт `3002`.

### Verified
- `node --check backend/src/services/directus.js`
- `node --check backend/src/routes/directus.js`
- `node --check backend/src/db.js`
- `node --check backend/scripts/smoke-*.mjs`
- `npm --prefix backend run smoke:directus:service`
- `npm --prefix backend run smoke:directus`
- `npm --prefix backend run smoke`
- `npm --prefix web run build`
- `npm --prefix web audit --audit-level=moderate` (остается только moderate advisory `postcss` внутри текущего `next`; `npm audit fix --force` предлагает несовместимый downgrade Next)
- `npm run verify`

## 2026-05-06

### Changed
- **Directus CMS/Data Studio слой**: добавлена изолированная папка `directus/` с Docker Compose для Directus + PostgreSQL, env-примером, описанием коллекций, ролей и стартовых статусов. Directus подключается как отдельный CMS/Data Studio слой рядом с текущим backend, без замены Express + SQLite API.
- **Directus integration helpers**: добавлен backend helper `backend/src/services/directus.js` для server-to-server REST-запросов в Directus и web helper `web/src/lib/directus.ts` на `@directus/sdk` для чтения `companies`, `vehicles` и `accident_cases`.
- **Directus sync endpoints**: добавлены опциональные backend endpoints `/api/integrations/directus/status`, `/preview` и `/sync` для безопасной проверки payload и ручной синхронизации ДТП-осмотра в Directus без автоматического вмешательства в основной поток.
- **Directus smoke coverage**: добавлен `backend/scripts/smoke-directus.mjs` и npm script `smoke:directus`; общий backend smoke теперь проверяет status/preview Directus-интеграции без требования запущенного Directus.
- **Directus status в настройках**: в web-настройки добавлена карточка Directus CMS для менеджера/администратора с состоянием backend-интеграции, URL и списком ожидаемых коллекций без передачи service token во frontend.
- **Directus schema bootstrap**: добавлены `directus/schema/mvp-schema.json` и `directus/scripts/bootstrap-schema.mjs` для создания MVP-коллекций и полей после первого запуска Directus без удаления существующих данных.
- **Directus bootstrap dry-run**: bootstrap-схема получила `--dry-run`/`--check` режим локальной валидации manifest без подключения к Directus; в корень проекта добавлены команды `directus:config`, `directus:bootstrap` и `directus:bootstrap:dry`.
- **Документация Directus**: добавлен `docs/directus-cms.md`, обновлены env-примеры backend/web и README с инструкциями запуска `cd directus && docker compose up -d`.
- **Идентификация техники по госномеру**: QR-код техники удален из UI и API-потока. Колонка QR-кода убрана из списка техники и настроек столбцов, поле удалено из форм добавления/редактирования и карточки техники, backend больше не принимает и не записывает `qr_code` при создании/обновлении техники.
- **SQLite-схема техники**: добавлена миграция старой базы, которая физически удаляет legacy-колонку `vehicles.qr_code` с сохранением номеров, названий, статусов, регионов и дат техники.
- **Карточка осмотра в web**: страница `web/src/app/inspections/[id]/page.tsx` приведена к читаемому русскому UI. Разделены блоки времени осмотра, данных ДТП, одометра, чек-листа, фото дефектов и сводки дефектов.
- **Темная тема и цветовые токены web**: добавлен единый файл `web/src/styles/tokens.css` с semantic design tokens, совместимостью со старыми переменными и базовыми helper-классами для card/button/input/badge/alert/progress. `Layout` и `ThemeSwitcher` переведены на токены вместо разрозненных прямых цветов.
- **Настройки регионов техники**: блок регионов в `web/src/app/settings/page.tsx` переработан без внутренней прокрутки. В списке отображаются только регионы с привязанной техникой, добавление идет в справочник, редактирование переименовывает регион у связанной техники, удаление отвязывает технику от региона.
- **Слияние регионов при редактировании**: если регион переименовывают в уже существующий, например `Moscow` в `Москва`, техника переносится в целевой регион, а исходный регион удаляется.
- **Дашборд web**: первая страница переписана без битой кодировки, с русскими подписями, токенизированными карточками, progress bar, уведомлениями, экспортом CSV и состояниями загрузки/ошибки.
- **Журнал осмотров web**: список осмотров переписан без битой кодировки, с русскими фильтрами, токенизированной таблицей, статусами типов осмотров, датами ДТП и действиями перехода в осмотр/дефекты.
- **Список техники web**: экран техники переведен на semantic-токены, нормальные русские подписи и единые статусы. Сохранены поиск, фильтры по статусу/региону, настройка столбцов, добавление/редактирование, удаление и быстрый запуск осмотра.
- **Карточка техники web**: страница `web/src/app/vehicles/[id]/page.tsx` приведена к единому русскому UI на токенах. Сохранены сводные метрики, история осмотров, одометр, дефекты с фото, история статуса и модальное изменение статуса техники.
- **Раздел дефектов web**: список дефектов и карточка дефекта переведены на общие semantic-токены. Сохранены фильтры по региону, типу осмотра, фото/описанию, связи с осмотром и техникой, ДТП-контекст, фото и история статуса.
- **Создание техники web**: форма `web/src/app/vehicles/new/page.tsx` переведена на общие токены, добавлена явная подсказка по разрешенным буквам российских госномеров, предпросмотр кириллической нормализации и выбор региона только из справочника.

### Fixed
- **Проваливание в дефекты из осмотра**: для выявленных дефектов добавлены ссылки на карточку дефекта, отображение времени фиксации, фото и контекст ДТП.
- **Данные ДТП в осмотре**: для ДТП-осмотров явно отображаются и сохраняются время ДТП, место ДТП и время самого осмотра; добавлена печатная карточка ДТП.
- **API регионов**: `/api/regions` возвращает только используемые регионы по умолчанию и поддерживает `includeEmpty=1` для выпадающих списков выбора региона в карточках техники.
- **История дефектов в карточке техники**: загрузка истории дефекта теперь идет через backend base URL, а не относительный frontend-путь `/api/...`, поэтому просмотр истории работает при отдельном порте API.
- **Редактирование регионов в настройках**: frontend передает старое имя региона при сохранении, а backend умеет восстановить регион по этому имени, если id из UI устарел или отсутствует в таблице `regions`. Это убирает 404 при `PUT /api/regions/:id` и сохраняет перенос техники при переименовании/слиянии.
- **Список регионов в модалках техники**: раздел `Техника` больше не запрашивает `includeEmpty=1` для фильтра и форм добавления/редактирования, поэтому в выпадающих списках показываются только текущие используемые регионы из настроек, а не весь расширенный справочник.

### Verified
- `docker compose -f directus/docker-compose.yml --env-file directus/.env.example config`
- Directus backend endpoints checked with a local spawned server: `/api/integrations/directus/status` and `/api/integrations/directus/inspections/:id/preview`
- `node --check directus/scripts/bootstrap-schema.mjs`
- `npm run directus:bootstrap:dry`
- `npm --prefix backend run smoke:directus`
- `npm --prefix web run build`
- `npm run verify`

## 2026-05-05

### Added
- **Импорт техники из Excel**: добавлена функция импорта vehicle в настройках. Поддерживает Excel (.xlsx, .xls) с колонками: номер, название, регион. Доступно только для manager/admin.

### Changed
- **Билингвальные номера**: Поддержка кириллицы и латиницы в номерах. Backend транслитерирует кириллицу в латиницу при поиске. API `/api/vehicles/resolve-number` принимает оба формата.

### Fixed
- **sql.js bind bug**: Исправлен метод `get()` - `step()` вызывался дважды, что ломало результат. Добавлена обработка массивов параметров.
- **company_id**: Унифицирован до `'default'` во всех таблицах.
- **PM2**: Переименован конфиг в `ecosystem.config.cjs` для совместимости с ES module.

---

## 2026-05-05

### Added
- **Импорт техники из Excel** (2026-05-05): добавлена функция импорта vehicle в настройках. Поддерживает Excel (.xlsx, .xls) с колонками: номер, название, регион. Новые регионы автоматически добавляются в справочник. Доступно только для manager/admin.
- **Управление регионами** (2026-05-05): добавлена возможность добавлять/удалять регионы в настройках.

### Changed
- **Билингвальные номера** (2026-05-05): Поддержка кириллицы и латиницы в номерах. Backend транслитерирует кириллицу в латиницу при поиске. API `/api/vehicles/resolve-number` принимает оба формата.

### Fixed
- **sql.js bind bug** (2026-05-05): Исправлен метод `get()` - `step()` вызывался дважды, что ломало результат. Добавлена обработка массивов параметров.
- **company_id** (2026-05-05): Унифицирован до `'default'` во всех таблицах.
- **PM2** (2026-05-05): Переименован конфиг в `ecosystem.config.cjs` для совместимости с ES module.
- **Layout hydration** (2026-05-05): Исправлен className - заменён `.join(' ')` на template literal.

---

## [Unreleased]

### Fixed
- Карточка дефекта в web переписана без битой кодировки: теперь показывает данные ДТП, время осмотра, время фиксации дефекта, фото, историю статуса и связанные записи.
- Исправлены общие компоненты `Timeline` и `PhotoGallery`: русские подписи больше не отображаются mojibake, фото строят URL через backend base URL.
- Приведена логика российских госномеров к единому правилу: канонический формат в данных и UI теперь кириллический, например `А123ВС77` или `А123ВС177`.
- Backend и frontend принимают латинские аналоги `A, B, E, K, M, H, O, P, C, T, Y, X`, но нормализуют их в разрешенные кириллические символы `А, В, Е, К, М, Н, О, Р, С, Т, У, Х`.
- Исправлена миграция существующей SQLite-базы: при старте добавляются отсутствующие поля `created_at`, `company_id`, поля одометра, ДТП и дефектов.
- Исправлен backend smoke-сбой `/api/users`: существующая база без `users.created_at` теперь корректно обновляется при инициализации.
- Исправлена валидация ДТП-осмотров: неполные данные ДТП возвращают `400`, а не приводят к sql.js ошибке с `undefined`.
- Исправлены русские сообщения в маршрутах одометра, распознавания номера и завершения осмотра.
- Исправлены PM2 scripts: команды используют `ecosystem.config.cjs`, который совместим с ES module проектом.
- Audit logger теперь импортирует `crypto` явно и пишет `company_id` из текущего пользователя.

### Changed
- Demo-номера в seed-данных генерируются кириллицей.
- `/api/vehicles/resolve-number` ищет технику по кириллическому каноническому номеру.
- OCR/ANPR endpoints остаются MVP-заглушками и требуют ручного подтверждения инспектором.
- Проверка планового осмотра теперь считает незаполненными только пункты без результата, а не пункты с результатом `false`, потому что `false` означает выявленный дефект.

### Verified
- `npm run verify` проходит полностью: backend smoke и production build frontend.

## [1.0.0] - 2024-05-XX

### Added
- Initial release of Audit Tech application.
- Vehicle inspection and defect tracking system.
- QR code based vehicle identification.
- Multi-role user support.
- Photo documentation for inspections and defects.
- Odometer tracking.
- Analytics dashboard.

## [Unreleased]

### Fixed
- Карточка дефекта в web переписана без битой кодировки: теперь показывает данные ДТП, время осмотра, время фиксации дефекта, фото, историю статуса и связанные записи.
- Исправлены общие компоненты `Timeline` и `PhotoGallery`: русские подписи больше не отображаются mojibake, фото строят URL через backend base URL.
- Приведена логика российских госномеров к единому правилу: канонический формат в данных и UI теперь кириллический, например `А123ВС77` или `А123ВС177`.
- Backend и frontend принимают латинские аналоги `A, B, E, K, M, H, O, P, C, T, Y, X`, но нормализуют их в разрешенные кириллические символы `А, В, Е, К, М, Н, О, Р, С, Т, У, Х`.
- Исправлена миграция существующей SQLite-базы: при старте добавляются отсутствующие поля `created_at`, `company_id`, поля одометра, ДТП и дефектов.
- Исправлен backend smoke-сбой `/api/users`: существующая база без `users.created_at` теперь корректно обновляется при инициализации.
- Исправлена валидация ДТП-осмотров: неполные данные ДТП возвращают `400`, а не приводят к sql.js ошибке с `undefined`.
- Исправлены русские сообщения в маршрутах одометра, распознавания номера и завершения осмотра.
- Исправлены PM2 scripts: команды используют `ecosystem.config.cjs`, который совместим с ES module проектом.
- Audit logger теперь импортирует `crypto` явно и пишет `company_id` из текущего пользователя.

### Changed
- Demo-номера в seed-данных генерируются кириллицей.
- `/api/vehicles/resolve-number` ищет технику по кириллическому каноническому номеру.
- OCR/ANPR endpoints остаются MVP-заглушками и требуют ручного подтверждения инспектором.
- Проверка планового осмотра теперь считает незаполненными только пункты без результата, а не пункты с результатом `false`, потому что `false` означает выявленный дефект.

### Verified
- `npm run verify` проходит полностью: backend smoke и production build frontend.

## [1.0.0] - 2024-05-XX

### Added
- Initial release of Audit Tech application.
- Vehicle inspection and defect tracking system.
- QR code based vehicle identification.
- Multi-role user support.
- Photo documentation for inspections and defects.
- Odometer tracking.
- Analytics dashboard.
