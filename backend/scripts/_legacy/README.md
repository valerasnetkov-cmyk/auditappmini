# Legacy Scripts (для исторической справки)

> Note: active backend dependencies no longer include `sql.js` after Epic 3.1.
> Scripts in this directory are archival references only and are not expected to
> run without manual restoration/migration of their historical dependencies.

Этот каталог содержит унаследованные ad-hoc скрипты, которые раньше
находились в `backend/tests/`. Они не запускаются через test runner и
предназначены только для исторической справки.

## Что внутри

- **debug-*** — одноразовые скрипты для отладки конкретных багов
  (логин, БД, vehicles, transliteration).
- **fix-db.mjs** — одноразовый repair-скрипт для БД.
- **diag*.mjs** — диагностика состояния БД.
- **reset-db.mjs / clean-db.mjs** — сброс/очистка БД.
- **add-*.mjs** — добавление тестовых данных.
- **check-*.mjs** — ad-hoc проверки пользователей/vehicles.
- **seed-*.mjs** — ручной seed данных.
- **test-*.mjs** — одноразовые smoke-скрипты.
- **quick-test.mjs, verify-pass.mjs, test-bind.mjs, test-wrapper.mjs** —
  ad-hoc верификации.
- **complete-inspections-tests.js** — старая тест-группа без runner.
- **transliteration.test.mjs, integration.resolve-number.test.mjs,
  role-tests.js** — оригинальные ad-hoc тесты, заменены на
  `backend/tests/unit/*.test.mjs` и `backend/tests/integration/*.test.mjs`
  (работают через `node --test`).

## Что использовать вместо

- **Unit-тесты:** `npm --prefix backend run test:unit`
- **Integration-тесты:** `npm --prefix backend run test:integration`
  (требует запущенный backend; `SKIP_INTEGRATION_TESTS=1` для пропуска)
- **Smoke-проверки:** `npm --prefix backend run smoke`
- **Production doctor:** `npm --prefix backend run doctor:production`

## Удаление

Эти скрипты сохранены для справки. Перед удалением рекомендуется
перепроверить, что вся их функциональность покрыта новыми
unit/integration/smoke скриптами.
