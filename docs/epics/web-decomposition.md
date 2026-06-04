# Epic 3.8: Монолитные web-страницы

## Цель

Декомпозировать крупные client-компоненты и перевести часть на серверные
компоненты Next.js 16 где это возможно.

## Mini-Epic статус

| Sub-Epic | Файл | До | После | Статус |
|---|---|---|---|---|
| **3.8.1** | `web/src/app/vehicles/page.tsx` | 869 | **388** (−55%) | ✅ закрыт (2026-06-02) |
| **3.8.2** | `web/src/app/settings/page.tsx` | 826 | **194** (−76%) | ✅ закрыт (2026-06-02) |
| **3.8.3** | `web/src/app/page.tsx` (dashboard) | 646 | **192** (−70%) | ✅ закрыт (2026-06-02) |
| **3.8.4** | `web/src/app/saas-admin/dashboard/page.tsx` | 564 | **179** (−68%) | ✅ закрыт (2026-06-02) |
| **3.8.5** | `web/src/app/users/page.tsx` | 547 | **181** (−67%) | ✅ закрыт (2026-06-02) |
| **3.8.6** | `web/src/app/saas-admin/companies/page.tsx` | 450 | **113** (−75%) | ✅ закрыт (2026-06-02) |
| **3.8.7** | `web/src/app/vehicles/[id]/page.tsx` | 669 | **176** (−74%) | ✅ закрыт (2026-06-02) |
| **3.8.8** | `web/src/app/saas-admin/companies/[id]/page.tsx` | 445 | **168** (−62%) | ✅ закрыт (2026-06-02) |

## Текущее состояние (обновлено 2026-06-02 после Epic 3.8.8)

- `web/src/app/page.tsx` — **192 строки** ✅ (Epic 3.8.3).
- `web/src/app/vehicles/page.tsx` — **388 строк** ✅ (Epic 3.8.1).
- `web/src/app/vehicles/[id]/page.tsx` — **176 строк** ✅ (Epic 3.8.7).
- `web/src/app/saas-admin/dashboard/page.tsx` — **179 строк** ✅ (Epic 3.8.4).
- `web/src/app/saas-admin/companies/[id]/page.tsx` — **168 строк** ✅ (Epic 3.8.8, уточнено: 445, не 518).
- `web/src/app/users/page.tsx` — **181 строка** ✅ (Epic 3.8.5).
- `web/src/app/saas-admin/companies/page.tsx` — **113 строк** ✅ (Epic 3.8.6).
- `web/src/app/settings/page.tsx` — **194 строки** ✅ (Epic 3.8.2).
- `web/src/app/inspections/[id]/page.tsx` — 235 строк ✅ (Epic 3.5).

## Сводка Epic 3.8.1 (vehicles decomposition, 2026-06-02)

`web/src/app/vehicles/page.tsx`: 869 → **388 строк** (−55%, под целевой ≤ 400).
Декомпозиция на 8 новых файлов в приватных каталогах (Next.js 16 `_folderName` opt-out от routing):

- **`_lib/vehicles.ts`** 55 строк: types (`VehicleFormData`/`SortableVehicleKey`/`SortConfig`/`ColumnConfig`), константы (`ITEMS_PER_BATCH=20`/`INITIAL_FORM`/`COLUMNS`), pure helpers (`getStatusLabel`/`getStatusBadgeClass`/`getSortMarker`).
- **`_hooks/useVehiclesList.ts`** 159 строк: data fetch (`api.getVehicles` + `api.getRegions`), filter state (`searchQuery`/`statusFilter`/`regionFilter`), sort (`sortConfig`), batched pagination (`visibleCount` + `loadMore`), URL `searchParams` sync. Module-level `loadData` helper (принимает `setState`-функции явно) — `useEffect` deps `[searchQuery, statusFilter]` валидны без `eslint-disable` директивы (React 19 lint).
- **`_components/VehiclesFilters.tsx`** 83 строки, **`VehiclesTable.tsx`** 97 строк, **`VehicleRow.tsx`** 82 строки, **`VehicleModal.tsx`** 27 строк, **`VehicleForm.tsx`** 96 строк — все client components с `'use client'` (props включают function-callbacks).
- `page.tsx` стал тонким orchestrator: связки `useVehiclesList` + `useCompanyUsage` + UI state ↔ handlers ↔ sub-components ↔ `NewInspectionModal`.

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings о `<img>` vs `next/image` в `inspections/[id]/_components/*`), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 16.3s, 26 routes), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Сводка Epic 3.8.2 (settings decomposition, 2026-06-02)

`web/src/app/settings/page.tsx`: 826 → **194 строки** (−76%, под целевой ≤ 200).
Декомпозиция на 9 новых файлов в приватных каталогах:

- **`_lib/settings.ts`** 89 строк: types (`ImportResult`/`StatusMessage`/`ParsedVehicle`), константа `COMPANY_USAGE_STALE_BACKEND_ERROR`, pure helpers (`formatCompanyUsageError`/`getRegionVehicleCount` с snake+case fallback/`parseToken`/`normalizePlateValue`/`isRussianPlateLike`/`formatNumber`/`formatPlanCode`/`formatUsageValue`/`getUsageBarWidth`/`getUsageTone`/`getUsageHint`/`getFeatureLabel`/`getFeatureClassName`/`recipientRoleLabel`) + `buildWriteBlockedMessage`/`pickRestriction` для orchestrator.
- **`_lib/excelParser.ts`** ~50 строк: `parseVehiclesExcel(buffer)` через `ExcelJS.Workbook` — firstRow detection по headers (`номер`/`гос`/`number`/`название`/`марка`/`регион`/`область`), number/name/regionIdx поиск, фильтр `isRussianPlateLike` или non-empty name/region.
- **`_hooks/useCompanyUsagePanel.ts`**: `Dispatch<SetStateAction<StatusMessage | null>>` сигнатура для functional setState в auto-clear stale-backend error. **`useRegions.ts`**: CRUD + edit-mode state, `getBlock: () => BlockInfo` callback (а не прямая BlockInfo). **`useServiceRecipients.ts`**: load+toggle with optimistic update + rollback on error. **`useVehicleImport.ts`**: file ref + parse+import через `api.importVehicles`.
- **`_components/CompanyUsagePanel.tsx`**: inline `ResourceUsageCard`+`FeatureStatusCard`. **`ServiceNotificationRecipientsPanel.tsx`**: role-locked checkbox list. **`ImportPanel.tsx`**: Excel `file input` + result display. **`RegionsPanel.tsx`**: CRUD modal с inline edit.
- `page.tsx` стал чистым orchestrator: auth check → role-gate → hook wiring → section render. `useRef` для hook callbacks внутри `useEffect` — actions object пересоздаётся каждый render, без ref был бы infinite loop.

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings вне settings), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 11.0s, 26 routes включая `/settings`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Сводка Epic 3.8.3 (page dashboard decomposition, 2026-06-02)

`web/src/app/page.tsx`: 646 → **192 строки** (−70%, под целевой ≤ 200).
Декомпозиция на 10 новых файлов в приватных каталогах `web/src/app/_lib/`, `_hooks/`, `_components/`:

- **`_lib/dashboard.ts`** 90 строк: types (`DateRange`/`ProgressTone`/`ToastTone`/`ToastMessage`), константы (`RANGE_LABELS`/`TOAST_CLASS_NAME`/`STAT_TONE_CLASS_NAME`), pure helpers (`getAnalyticsParams`/`getRangeStart`/`makeCsv` с BOM + quote-escape/`buildExportFilename`/`getChartTitleToneClassName`).
- **`_hooks/useDashboard.ts`** 177 строк: `useDashboard` (parallel `Promise.all` для stats+notif+me+usage, conditional analytics load, error/auth-expired handling) + `useDashboardExport` (`exportData`/`seedData` с role/restriction guard + `window.confirm` + auto-reload).
- **`_hooks/useToast.ts`** 17 строк: toast state + 3-sec auto-dismiss с `typeof window` SSR-guard.
- **`_components/`** (8 файлов): `DashboardFilters` 80, `DashboardLoading` 10, `EmptyDashboard` 36, `StatCard` 21, `AccidentCard` 36, `ChartCard` 13, `NotificationsCard` 45 — все client components с `'use client'`.
- `page.tsx` стал чистым orchestrator: state setup → hook composition → role/restriction derivation → `triggerLoad` через `useRef(dashboard.load)` + sync в `useEffect` → handlers → render.

Ключевые архитектурные решения: (a) `triggerLoad` через `useRef` — функция `load` пересоздаётся каждый render, но ref всегда указывает на актуальную версию, `useEffect` deps остаются стабильными; (b) `useDashboard` принимает deps object как runtime-args — упрощает test-ability; (c) `analyticsEnabled` computed inline — derived value, не source of truth.

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 17.3s, 26 routes включая `/`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Сводка Epic 3.8.4 (saas-admin dashboard decomposition, 2026-06-02)

`web/src/app/saas-admin/dashboard/page.tsx`: 564 → **179 строк** (−68%, под целевой ≤ 200).
Декомпозиция на 13 новых файлов в приватных каталогах:

- **`_lib/resourceDashboard.ts`** 63 строки: formatters (`formatNumber`/`formatCurrency`/`formatPercent`/`formatLimit`/`formatDate`/`formatBytes`), severity helpers (`severityClass`/`riskLabel`/`moduleLabel`).
- **`_hooks/useResourceAdminStats.ts`** 78 строк: `useResourceAdminStats` (fetch + cancelled flag pattern) + `useCompaniesFilter` (search/plan/status state + `useMemo` для `planOptions`/`filteredCompanies` с 6-статус filter).
- **`_components/`** (12 файлов): `EmptyState` 9, `MetricCard` 19, `SectionHeader` 10, `ActivationFunnel` 32, `HealthItemCard` 25, `CompaniesTable` 103 (11-column table), `LimitsTable` 57, `ChurnList` 29, `UpsellList` 31, `StorageMetrics` 20, `CompaniesFilters` 46.
- `page.tsx` стал чистым orchestrator: state setup → hook composition → derived values → render.

Ключевые архитектурные решения: (a) типы `SaasLimitUsageCompany`/`SaasChurnRiskCompany`/`SaasUpsellCandidate` импортированы из существующего `@/lib/types`; (b) `CompaniesTable` принимает `totalCount` prop — различает empty states; (c) `useCompaniesFilter` инкапсулирует filter state + `useMemo` derivations.

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 11.4s, 26 routes включая `/saas-admin/dashboard`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Сводка Epic 3.8.5 (users page decomposition, 2026-06-02)

`web/src/app/users/page.tsx`: 547 → **181 строка** (−67%, под целевой ≤ 200).
Декомпозиция на 6 новых файлов в приватных каталогах:

- **`_lib/users.ts`** 50 строк: types + `EMPTY_FORM`/`PANEL_MANAGED_ROLES`/`USER_COLUMNS` + `getRoleLabel`/`getRoleBadgeClass`/`canManagePanelUser`.
- **`_hooks/useUsers.ts`** 155 строк: `useUsersList` (list state) + `useUsersFilter` (`useMemo` с search/roleFilter/sortConfig) + `useUserForm` (modal+form state) + `useCreateUser`/`useUpdateUser`/`useDeleteUser` (API wrappers).
- **`_components/UsersFilters.tsx`** 65 строк: search input + role select + column visibility menu. **`UsersTable.tsx`** 99 строк: `SortableHeader` helper + hidden column checks + action buttons. **`UserFormModal.tsx`** 65 строк: reusable create/edit modal.
- `page.tsx` стал чистым orchestrator: state setup → hook composition → filter+sort → `useEffect` для auto-load → handlers → render.

Ключевые архитектурные решения: (a) `useUsersList` — единый hook для всего list state; (b) `useUserForm` инкапсулирует modal+form state с shared `formData`; (c) `useCreateUser`/`useUpdateUser`/`useDeleteUser` — pure API wrappers; (d) `hiddenColumns` lifted в orchestrator (нужно и для table).

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 18.7s, 26 routes включая `/users`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Сводка Epic 3.8.6 (saas-admin/companies page decomposition, 2026-06-02)

`web/src/app/saas-admin/companies/page.tsx`: 450 → **113 строк** (−75%, под целевой ≤ 200).
Декомпозиция на 10 новых файлов в приватных каталогах:

- **`_lib/companies.ts`** 118 строк: types + form constants + formatters + setup helpers + `filterCompanies` pure function.
- **`_hooks/useCompaniesList.ts`** 81 строка: `useCompaniesList` (single source of truth для stats + loading + saving + error + message + ownerSetupLinks + actions + derived `companies`/`plans`).
- **`_hooks/useCompanyForms.ts`** 24 строки: `useCompanyFormState`/`useOwnerFormState`/`useLimitFormState`.
- **`_hooks/useCompanyActions.ts`** 147 строк: 7 factory-hooks `useCreateCompany`/`useCreateOwner`/`useSaveLimits`/`useToggleCompanyStatus`/`useDeactivateOwner`/`useIssueOwnerSetupLink`/`useCopySetupLink`.
- **`_components/CreateCompanyForm.tsx`** 43 строки, **`CreateOwnerForm.tsx`** 52 строки, **`LimitsForm.tsx`** 108 строк, **`CompaniesTable.tsx`** 61 строка, **`CompanyTableRow.tsx`** 129 строк (8-column row + inline `OwnerCell` sub-component), **`CompaniesRegistry.tsx`** 66 строк.

Ключевые архитектурные решения: (a) `useCompaniesList` — single source of truth; (b) `useCompanyActions` — factory-hooks с form-data args, не замыкающие на state; (c) `useCompanyForms` — три отдельных hooks для трёх форм; (d) `CompanyTableRow` инкапсулирует `OwnerCell`; (e) `filterCompanies` — pure function для test-ability; (f) `setForm` — `Dispatch<SetStateAction<T>>`.

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 16.4s, 26 routes включая `/saas-admin/companies`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Сводка Epic 3.8.7 (vehicles/[id] page decomposition, 2026-06-02)

`web/src/app/vehicles/[id]/page.tsx`: 669 → **176 строк** (−74%, под целевой ≤ 200).
Декомпозиция на 10 новых файлов в приватных каталогах:

- **`_lib/vehicleDetail.ts`** 65 строк: type `DefectHistoryEntry` + 6 helpers + `StatTone` type + `statusOptions` const.
- **`_hooks/useVehicleDetailData.ts`** 87 строк: data state + loadData + reloadDefects + reloadHistory + auto-load.
- **`_hooks/useToast.ts`** 12 строк: toast state + auto-clear.
- **`_hooks/useDefectActions.ts`** 87 строк: defectHistories state + closeDefect + reopenDefect + toggleDefectHistory.
- **`_hooks/useStatusModal.ts`** 95 строк: modal state + handleStatusChange.
- **`_components/StatCard.tsx`** 22 строки, **`VehicleInfoCard.tsx`** 33 строки, **`InspectionsHistory.tsx`** 71 строка, **`DefectsSection.tsx`** 158 строк (с inline `DefectCard` sub-component), **`StatusHistory.tsx`** 43 строки, **`StatusModal.tsx`** 86 строк.

Ключевые архитектурные решения: (a) `useVehicleDetailData` — single source of truth с auto-load; (b) `useDefectActions` принимает `Guard` object; (c) `closeDefect`/`reopenDefect` callbacks bind `data.reloadDefects` + `showToast`; (d) `useStatusModal.handleStatusChange` callback bind page-specific state; (e) `eslint-disable` для `<img>` перенесён в `DefectsSection.tsx`.

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 10.6s, 26 routes включая `/vehicles/[id]`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Сводка Epic 3.8.8 (saas-admin/companies/[id] page decomposition, 2026-06-02)

`web/src/app/saas-admin/companies/[id]/page.tsx`: 445 → **168 строк** (−62%, под целевой ≤ 200).
Декомпозиция на 9 новых файлов в приватных каталогах:

- **`_lib/companyDetail.ts`** 115 строк: types + 9 helpers + form mappers.
- **`_hooks/useCompanyDetails.ts`** 95 строк: data + forms + saving + setup links + loadData.
- **`_components/CompanyHeader.tsx`** 73 строки (header + `MetricCard` + `CompanyMetrics`).
- **`_components/CompanyEditForm.tsx`** 67 строк, **`OwnersSection.tsx`** 138 строк (с inline `OwnerCard`), **`LimitsForm.tsx`** 95 строк, **`PaymentsList.tsx`** 56 строк, **`AlertsList.tsx`** 47 строк, **`AuditLogs.tsx`** 50 строк.

Ключевые архитектурные решения: (a) `useCompanyDetails` — single source of truth; (b) 6 handlers в orchestrator; (c) `CompanyEditForm` принимает `Dispatch<SetStateAction<CompanyEditForm | null>>` с null-safe update; (d) `OwnersSection` инкапсулирует `OwnerCard`; (e) `MetricCard`/`CompanyMetrics` экспортированы из `CompanyHeader.tsx`; (f) `PaymentsList`/`AlertsList`/`AuditLogs` — pure display.

Verification: `npx tsc --noEmit` (0 errors в нашем коде, 2 pre-existing в `e2e/tests/*` по `speakeasy@types`), `npm run lint` (0 errors, 3 pre-existing warnings вне наших файлов), `npm run build` (Next.js 16.2.6 / Turbopack, ✓ Compiled successfully in 12.6s, 26 routes включая `/saas-admin/companies/[id]`), `npm --prefix backend run smoke:health` (все checks OK включая `redis: true`), `npm --prefix backend run test:unit` (41 passed, 0 failed).

## Целевые правила

- Каждая client-страница ≤ 400 строк.
- Server-страницы: только композиция server components + data fetching.
- Данные через серверные функции (`fetch` с revalidate) где возможно.

## Подзадачи (по mini-epic)

1. ✅ **Epic 3.8.1** — `web/src/app/vehicles/page.tsx` (869 → 388).
2. ✅ **Epic 3.8.2** — `web/src/app/settings/page.tsx` (826 → 194).
3. ✅ **Epic 3.8.3** — `web/src/app/page.tsx` (dashboard, 646 → 192).
4. ✅ **Epic 3.8.4** — `web/src/app/saas-admin/dashboard/page.tsx` (564 → 179).
5. ✅ **Epic 3.8.5** — `web/src/app/users/page.tsx` (547 → 181).
6. ✅ **Epic 3.8.6** — `web/src/app/saas-admin/companies/page.tsx` (450 → 113).
7. ✅ **Epic 3.8.7** — `web/src/app/vehicles/[id]/page.tsx` (669 → 176).
8. ✅ **Epic 3.8.8** — `web/src/app/saas-admin/companies/[id]/page.tsx` (445 → 168).

## Критерии приёмки (для каждого mini-epic)

- Соответствующий `page.tsx` ≤ 400 строк.
- Ни один файл в `_lib/`, `_hooks/`, `_components/` не превышает 200 строк.
- `npx tsc --noEmit` — 0 ошибок в нашем коде.
- `npm run lint` — 0 errors.
- `npm run build` — успешный Next.js 16 build.
- `npm --prefix backend run smoke:health` — все checks OK.
- `npm --prefix backend run test:unit` — все passed.

## Effort / Risk

- **Effort:** M (1-2 дня на mini-epic).
- **Risk:** L (только клиентский рефакторинг).

## Связанные документы

- `docs/audit-2026-06-02.md` § 3.5, 3.8.
- `CHANGELOG.md` § "Unreleased" → "Качество кода и поддержка" → "Толстые
  страницы web-клиента" (✅ Epic 3.8.1–3.8.8 все закрыты, 2026-06-02).
