# Backend Tests

Юнит- и integration-тесты, работающие через `node --test` (zero-dependency
test runner из Node.js ≥ 18).

## Структура

```txt
backend/tests/
├── unit/                      # изолированные unit-тесты (без сети/БД)
│   ├── transliteration.test.mjs
│   ├── license-plate.test.mjs
│   └── secret-store.test.mjs
├── integration/               # тесты с реальным backend'ом
│   └── auth-and-resolve.test.mjs
├── helpers/                   # общие утилиты (для будущих тестов)
└── README.md                  # этот файл
```

## Запуск

```bash
# Все тесты
npm --prefix backend test

# Только unit
npm --prefix backend run test:unit

# Только integration
npm --prefix backend run test:integration

# С coverage
npm --prefix backend run test:coverage
```

## Конвенции

- Имена файлов: `*.test.mjs` для `node --test` совместимости.
- Используйте `import { test, describe, before, after } from 'node:test'`.
- Используйте `assert` из `node:assert/strict`.
- Integration-тесты должны проверять `process.env.SKIP_INTEGRATION_TESTS`
  и/или доступность backend через `BASE_URL`.
- Один `describe` блок на тестируемый модуль/функцию.
- Имена тестов — на английском, формат `module: behavior` или
  `module: behavior with condition`.

## Legacy

Унаследованные ad-hoc тесты и debug-скрипты перенесены в
`backend/scripts/_legacy/`. Они не запускаются через `node --test` и
сохранены только для исторической справки.
