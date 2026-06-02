# Epic 3.10: Объединение документации в `docs/`

## Цель

Свести разрозненные `.md` файлы в корне проекта и mojibake-артефакты в
`docs/` в единое чистое содержание с корректной UTF-8 кодировкой.

## Текущее состояние

### Корневые `.md` (после cleanup-волны 2026-06-02)

- `README.md` — основной, остаётся в корне.
- `CHANGELOG.md` — журнал изменений, остаётся в корне.
- `plan.md` — рабочий roadmap, остаётся в корне.
- `backend.md`, `data-model.md`, `mobile.md`, `product.md`, `web.md` —
  краткие справочники. Дублируют `docs/backend.md`, `docs/data-model.md`,
  `docs/mobile.md`, `docs/product.md`, `docs/web.md` (с mojibake).

### Mojibake в `docs/`

- `docs/dark-theme-color-tokens-changes.md` (702 строки, mojibake).
- `docs/release-runbook.md` (167 строк, частично mojibake).
- `docs/production-env.md` (частично mojibake).
- `docs/backup-restore.md`, `docs/launch-checklist.md` (частично).
- `docs/architecture.md` (164 строки, mojibake).
- `docs/implementation-plan.md` (169 строк, mojibake).
- `docs/security-github.md` (153 строки, mojibake).
- `docs/checklist.md` (87 строк, mojibake).
- `docs/storage.md` (mojibake).
- `docs/sql-outline.md` (mojibake).
- `docs/do-not-do.md` (mojibake).
- `docs/frontend-styles.md`, `docs/i18n.md`, `docs/theme.md` (частично).
- `docs/data-model.md` (mojibake).
- `docs/QA-MFA-UI.md` (mojibake).
- `docs/regional-deployment.md`, `docs/tenant-routing.md`,
  `docs/data-residency.md` (mojibake).
- `docs/vehicle-number-format.md`, `docs/vehicle-number-recognition.md`,
  `docs/odometer-recognition.md` (mojibake).
- `docs/inspection-types.md`, `docs/inspection-photo-requirements.md`,
  `docs/accident-inspection.md`, `docs/planned-inspection-systems.md` (mojibake).
- `docs/ocr-provider-architecture.md` (mojibake).
- `docs/measurement-units.md` (mojibake).
- `docs/production-server-commands.md` (mojibake).
- `docs/first-production-start.md` (mojibake).
- `docs/mobile-app-retirement.md` (mojibake).
- `docs/readmee.md` (mojibake).

## Подзадачи

1. **Декодировать mojibake-файлы** в `docs/`: конвертировать из CP1251/UTF-8 mix
   в чистый UTF-8 (например, через `iconv` или ручной маппинг).
2. **Объединить дубликаты**: оставить одну версию из
   `backend.md` (root) + `docs/backend.md`, аналогично для остальных.
3. **Удалить `docs/readmee.md`** (явная опечатка в имени, заменена
   `docs/README.md`).
4. **Объединить `docs/dark-theme-color-tokens-changes.md` + `docs/theme.md`**
   в единый `docs/theme.md`.
5. **Переписать mojibake-файлы** с актуальным содержимым (где документ
   отражает устаревший контекст — обновить под текущее состояние кода).
6. **Добавить `docs/SECURITY.md`** (открытый backlog в audit findings).
7. **Добавить `CODEOWNERS`** в корне репозитория.
8. **Прогнать `git grep` для поиска** всех `docs/*.md` ссылок в коде,
   обновить перекрёстные ссылки.

## Критерии приёмки

- Все `.md` в `docs/` чистый UTF-8 без mojibake.
- `docs/README.md` отражает фактическое содержимое `docs/`.
- В корне остаются только `README.md`, `CHANGELOG.md`, `plan.md`.
- Добавлен `docs/SECURITY.md` и `CODEOWNERS`.
- Все перекрёстные ссылки работают.

## Effort / Risk

- **Effort:** S-L (1-5 дней в зависимости от объёма переписывания).
- **Risk:** L (только документация, не runtime).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.10.
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Документация
  раздроблена" (открытый backlog).
- `CHANGELOG.md` § "Unreleased" → "CI/CD и эксплуатация" → "Отсутствует
  `SECURITY.md` и `CODEOWNERS`" (открытый backlog).
