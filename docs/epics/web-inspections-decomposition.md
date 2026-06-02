# Epic 3.5: Декомпозиция `web/src/app/inspections/[id]/page.tsx` ✅

**Статус: закрыт.** Подробная сводка изменений в `CHANGELOG.md` (Unreleased → «Открытый архитектурный долг» → строка про Epic 3.5) и в `docs/audit-2026-06-02.md` (раздел «Сводка Epic 3.5»).

**Результат:** 1 143 → **235 строк** (−79%, под целевой ≤ 400).

## Цель

Выделить хуки данных и презентационные компоненты из монолитной страницы
осмотра, чтобы сократить размер файла до ≤ 400 строк и улучшить читаемость
и тестируемость.

## Текущее состояние (подтверждено в коде)

- `web/src/app/inspections/[id]/page.tsx` — **1 020 строк** (вырос с 922 по
  audit findings).
- Содержит: блоки времени осмотра, данных ДТП, одометра, чек-листа, фото
  дефектов, сводки дефектов, состояний, печатной карточки ДТП.

## Целевая структура

```txt
web/src/app/inspections/[id]/
├── page.tsx                  # главный ~300 строк
├── hooks/
│   ├── useInspection.ts      # GET /api/inspections/:id
│   ├── useDefects.ts         # GET /api/inspections/:id/defects
│   ├── useOdometer.ts        # POST /api/inspections/:id/odometer
│   ├── useAccidentFields.ts  # для ДТП-осмотров
│   └── usePhotoUpload.ts
├── components/
│   ├── InspectionHeader.tsx
│   ├── AccidentCard.tsx
│   ├── OdometerCard.tsx
│   ├── ChecklistCard.tsx
│   ├── DefectsList.tsx
│   ├── DefectForm.tsx
│   └── PrintCard.tsx
└── types.ts
```

## Подзадачи

1. Создать `hooks/useInspection.ts` (загрузка, кэш, мутации).
2. Создать `hooks/useDefects.ts` (создание, закрытие, переоткрытие).
3. Создать `hooks/useOdometer.ts` (распознавание + подтверждение).
4. Создать `hooks/useAccidentFields.ts`.
5. Создать `hooks/usePhotoUpload.ts`.
6. Вынести `InspectionHeader`, `AccidentCard`, `OdometerCard`, `ChecklistCard`,
   `DefectsList`, `DefectForm`, `PrintCard` в `components/`.
7. `page.tsx` сводится к композиции: header + tabbed sections + handlers.
8. Прогнать `npm --prefix web run lint` + `npm --prefix web run build`.

## Критерии приёмки

- `page.tsx` ≤ 400 строк.
- Каждый под-компонент ≤ 250 строк.
- `npm --prefix web run lint` проходит без warnings.
- `npm --prefix web run build` проходит.
- E2E `web/e2e/tests/defect-*.spec.ts`, `web/e2e/tests/inspections-*.spec.ts`
  проходят.

## Effort / Risk

- **Effort:** M (2-3 дня).
- **Risk:** L (только рефакторинг клиента, без backend-изменений).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.5.
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Толстые
  страницы web-клиента" (открытый backlog).
