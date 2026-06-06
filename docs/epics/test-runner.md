# Epic 3.6: Тест-инфраструктура: единый runner + coverage

## Цель

Ввести единый test runner и coverage для backend, очистить унаследованные
debug-скрипты в `backend/tests/`.

## Текущее состояние (подтверждено в коде)

- `backend/tests/` — **27 файлов**, включая:
  - debug: `debug-db.mjs`, `debug-login.mjs`, `debug-translit.mjs`,
    `debug-vehicles.mjs`
  - fix: `fix-db.mjs`
  - diag: `diag.mjs`, `diag2.mjs`, `diag3.mjs`
  - reset/clean: `reset-db.mjs`, `clean-db.mjs`
  - add-test: `add-test-vehicle.mjs`, `add-vehicles.mjs`
  - check: `check-user-company.mjs`, `check-user-simple.mjs`, `check-users.mjs`,
    `check-vehicle.mjs`
  - seed: `seed-api.mjs`, `simple-seed.mjs`
  - test: `test-api.mjs`, `test-bind.mjs`, `test-wrapper.mjs`,
    `quick-test.mjs`, `verify-pass.mjs`
  - unit/integration: `role-tests.js`, `integration.resolve-number.test.mjs`,
    `transliteration.test.mjs`
- Нет единого runner.
- Нет coverage.
- `backend/package.json` имеет только `test:security` (запускает role-tests.js).

## Целевая структура

```txt
backend/tests/
├── unit/                     # переедут unit-тесты
│   ├── transliteration.test.mjs
│   └── ...
├── integration/              # переедут integration-тесты
│   ├── resolve-number.test.mjs
│   └── ...
├── helpers/                  # общие утилиты
│   ├── testDb.mjs
│   └── testAuth.mjs
└── *.spec.mjs                # новые тесты пишутся в стандартном формате
```

## Подзадачи

1. Выбрать test runner: **`vitest`** (быстрый, ESM-native, coverage из коробки)
   или **`node --test`** (zero-dependency, Node 18+).
2. Добавить test runner в `backend/package.json` (`test`, `test:unit`,
   `test:integration`, `test:coverage`).
3. Перенести unit/integration тесты из `backend/tests/` в `backend/tests/unit/`
   и `backend/tests/integration/`.
4. Перенести утилиты (`smoke-helpers.mjs`) в `backend/tests/helpers/`.
5. Перенести debug/fix/diag/check/reset/clean/add-test/seed/test-* в
   `backend/scripts/_legacy/` (или удалить, если они уже не нужны).
6. Добавить coverage:
   - Backend: `c8` (быстрый, no-config) или `vitest --coverage`.
   - Целевой coverage: ≥ 60% для `db.js`, `routes/*.js`, `utils/*.js`.
7. Прогнать `npm --prefix backend test` и зафиксировать baseline coverage.
8. Включить `npm --prefix backend test` в `npm run verify:launch`.

## Критерии приёмки

- `npm --prefix backend test` запускает все unit/integration тесты.
- `npm --prefix backend run test:coverage` показывает coverage отчёт.
- `backend/tests/` содержит только `unit/`, `integration/`, `helpers/`.
- `backend/scripts/_legacy/` содержит legacy debug-скрипты (или удалены).
- `npm run verify:launch` включает `npm --prefix backend test`.

## Effort / Risk

- **Effort:** M (2-3 дня, требует переноса ~20 файлов).
- **Risk:** L (test-инфраструктура не затрагивает runtime).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.6.
- `CHANGELOG.md` § "Unreleased" → "CI/CD и эксплуатация" → "Нет lint-команды
  для backend и mobile на верхнем уровне" (открытый backlog).
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Тесты
  разрозненные" (открытый backlog).
