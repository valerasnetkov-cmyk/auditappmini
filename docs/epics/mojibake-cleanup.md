# Epic 3.7: Mojibake-словари в `db.js`

## Цель

Удалить mojibake-словари из `backend/src/db.js` после фиксации корневой
причины повреждённой кодировки русских строк в БД.

## Текущее состояние (подтверждено в коде)

- `backend/src/db.js:17-25` — `TEXT_REPLACEMENTS` (mojibake → корректный русский).
- `backend/src/db.js:136` — `console.log('Fixed mojibake records: ${repaired}')`.
- `backend/src/db.js:repairMojibakeRussian` (упомянут в `import` на строке 7).

## Проблемы

- Словари зашиты как исторический технический долг.
- Они маскируют корневую причину: запись в БД в неправильной кодировке
  (UTF-8 → CP1251 или обратно на уровне драйвера).
- После Epic 3.1 (`sql.js` → `better-sqlite3`) кодировка может стать
  корректной автоматически.

## Подзадачи

1. Создать отдельный миграционный скрипт `backend/scripts/fix-mojibake-once.mjs`:
   - читает все текстовые колонки;
   - применяет `repairMojibakeRussian` ко всем строкам;
   - выводит отчёт "rows fixed: N";
   - **не** правит `db.js`.
2. Запустить скрипт на актуальной `backend/data/database.sqlite` (после
   Epic 3.1 — на новой БД).
3. Проверить выборку записей (vehicle.name, region.name, comment) на чистый
   UTF-8.
4. После успешного прогона — удалить `TEXT_REPLACEMENTS` и
   `repairMojibakeRussian` вызовы из `db.js`.
5. Обновить `docs/audit-2026-06-02.md` § 3.7 → закрыто.

## Зависимости

- Требует Epic 3.1 (миграция на `better-sqlite3`) для стабильного UTF-8.

## Критерии приёмки

- `backend/src/db.js` не содержит `TEXT_REPLACEMENTS` и вызовов
  `repairMojibakeRussian`.
- Новые записи в БД читаются как корректный UTF-8 без словарей.
- `npm --prefix backend run smoke` проходит.
- `npm --prefix backend run smoke:inspections` проходит.

## Effort / Risk

- **Effort:** S (< 1 дня).
- **Risk:** L (только data-cleanup, не runtime).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.7.
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Mojibake-
  словари в `backend/src/db.js`" (открытый backlog).
