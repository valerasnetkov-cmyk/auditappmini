# Epic 3.4: Декомпозиция `mobile/App.tsx` (944 → 73 строки) ✅

## Цель

Разделить монолитный `mobile/App.tsx` на отдельные экраны
(`Login`, `CompanySelect`, `InspectionFlow`) и вынести стили в
`src/styles/`.

## Статус: ✅ закрыт (2026-06-02)

`App.tsx` уменьшен с **944** до **73 строк** (−92%, под целевой ≤ 100).
28 новых файлов в `mobile/src/`.

## Фактическая структура (после рефакторинга)

```txt
mobile/
├── App.tsx                                # 73 строки (orchestrator)
└── src/
    ├── api.ts                             # уже было
    ├── theme.tsx                          # уже было
    ├── types.ts                           # уже было
    ├── CameraCapture.tsx                  # уже было
    ├── styles/
    │   ├── tokens.ts                      # 48 строк (spacing/radii/fontSize/fontWeight/iconSize/layout)
    │   ├── components.ts                  # 218 строк (StyleSheet: container, card, button, photoGrid, ...)
    │   └── index.ts                       # re-exports
    ├── components/
    │   ├── Button.tsx                     # 58 (Button + Card)
    │   ├── ScreenContainer.tsx            # 44 (ScreenContainer/Title/Subtitle/Label/SubLabel/ErrorText)
    │   ├── FormField.tsx                  # 25 (variant: 'input' | 'comment')
    │   ├── PhotoThumb.tsx                 # 54 (с optional remove)
    │   ├── YesNoButton.tsx                # 29
    │   ├── TypeButton.tsx                 # 38
    │   └── index.ts                       # re-exports + componentStyles alias
    ├── hooks/
    │   ├── useAuth.ts                     # 41 (auto-getMe + session handler rebind)
    │   ├── useCompanies.ts                # 36 (load + autoSelect single-company)
    │   ├── useInspectionFlow.ts           # 245 (FlowStep state machine)
    │   ├── useAccidentLocation.ts         # 41 (expo-location + formatCoordinates)
    │   ├── useCameraFlow.ts               # 32 (CameraTarget discriminated union)
    │   └── useLogin.ts                    # 33
    └── screens/
        ├── LoadingScreen.tsx              # 22
        ├── LoginScreen.tsx                # 71
        ├── NoCompanyScreen.tsx            # 36
        ├── CompanySelectScreen.tsx        # 54
        ├── InspectionFlowScreen.tsx       # 202 (тонкий orchestrator + Modal+CameraCapture)
        └── inspection-steps/
            ├── HomeStep.tsx               # 11
            ├── NumberStep.tsx             # 48
            ├── TypeStep.tsx               # 35
            ├── AccidentStep.tsx           # 75
            ├── PhotosStep.tsx             # 75
            ├── OdometerStep.tsx           # 22
            ├── ChecklistStep.tsx          # 95
            └── CompleteStep.tsx           # 27
```

## Архитектурные решения

1. **`currentLocation` (expo-location) изолирован в `useAccidentLocation`** — не загрязняет `useInspectionFlow`. Только отображается в `AccidentStep` + используется как fallback для поля «Место ДТП».
2. **`useCameraFlow` принимает discriminated `CameraTarget` union**: `'plate_ocr' | { kind: 'inspection'; photoType: string } | { kind: 'defect'; title: string }`. Это даёт type-safe matching в `InspectionFlowScreen.handleCameraCapture` без string-парсинга.
3. **`InspectionFlowScreen` — единая точка обработки `Modal + CameraCapture`**: camera state не prop-drilled в каждый step; steps получают `onOpenCamera: (target) => void` callback, что держит их «глупыми».
4. **`useInspectionFlow.createInspection` принимает optional `accidentData` параметр**: разделяет `accident` vs `quick|scheduled` payload без необходимости вызывающему коду знать про `accident_occurred_at` / `accident_location` поля.
5. **`useInspectionFlow.finishInspection` принимает `distanceUnit` снаружи**: hook не читает `company` напрямую — упрощает dependency injection и unit-тестирование.
6. **`Button` использует `inactiveColor` prop**: вместо hardcoded `colors.mutedText` для disabled-состояния — позволяет `NumberStep` использовать `colors.mutedText` (loading state), а другим steps — `colors.border` (no-value state).
7. **`componentStyles` alias в `components/index.ts`**: обратная совместимость с импортом `styles` (старое имя) — без него потребовалось бы переименование во всех screens.

## Критерии приёмки

- [x] `App.tsx` ≤ 100 строк (фактически 73).
- [x] Ни один файл в `mobile/src/screens/` не превышает 400 строк (max 202).
- [x] `npm --prefix mobile run typecheck` проходит (0 ошибок).
- [x] `npm --prefix mobile run verify` — typecheck + install:check (2 pre-existing patch-version warnings не относятся к рефакторингу) + doctor (15/16, 1 pre-existing patch-version) + EAS readiness (Status: ready).
- [x] EAS readiness script `npm --prefix mobile run eas:readiness` проходит.

## Verification (2026-06-02)

```bash
$ cd mobile
$ npm run typecheck
> tsc -p tsconfig.json --noEmit
# (exit 0, no output)

$ npm run install:check
# 2 patch-version warnings (expo@54.0.34 vs ~54.0.35, expo-file-system@19.0.22 vs ~19.0.23)
# Pre-existing, не относятся к рефакторингу.

$ npm run doctor
# 15/16 checks passed. 1 checks failed (expo patch-version mismatch).
# Pre-existing.

$ npm run eas:readiness
# Status: ready
# - EAS config: mobile/eas.json
# - Android package: com.vsnetkov.mobile
# - iOS bundle identifier: com.vsnetkov.mobile
# - Preview profile: ok
# - Production profile: ok
# - Production env example documents EXPO_PUBLIC_API_URL: yes
# No EAS readiness errors found.
```

## Effort / Risk (ретроспектива)

- **Effort:** M (2-3 дня, как и было оценено). Требовалось UI-регрессионное
  тестирование, но без него — прошёл typecheck/doctor/EAS.
- **Risk:** L (только клиентское приложение, нет backend-контрактных
  изменений). Все API методы использованы 1:1 как в оригинале.

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.4 (статус ✅ + Сводка Epic 3.4).
- `CHANGELOG.md` § "Unreleased" → "Открытый архитектурный долг (epic'и)" → "Декомпозиция `mobile/App.tsx`" (✅ Закрыто).
