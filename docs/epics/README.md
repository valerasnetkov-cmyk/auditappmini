# Epic'и архитектурного долга — 2026-06-02

Документы ниже описывают архитектурный долг, выявленный в ходе аудита
`docs/audit-2026-06-02.md`. Каждый epic — track-only на данной итерации
(без немедленных правок кода), с целями, рисками, критериями приёмки и
оценкой effort.

## Список epic'ов

| # | Epic | Файл | Приоритет | Effort | Risk | Статус |
|---|---|---|---|---|---|---|
| 3.1 | `sql.js` → `better-sqlite3` (или внешний RDBMS) | [`sqlite-driver-migration.md`](./sqlite-driver-migration.md) | High | L | M | открыт |
| 3.2 | Распределённый rate limit (Redis) | [`rate-limit-redis.md`](./rate-limit-redis.md) | Medium | M | M | ✅ закрыт |
| 3.3 | Декомпозиция `backend/src/server.js` (3 367 строк) | [`server-decomposition.md`](./server-decomposition.md) | Medium | L | M | открыт |
| 3.4 | Декомпозиция `mobile/App.tsx` (944 → 73 строки) | [`mobile-decomposition.md`](./mobile-decomposition.md) | Medium | M | L | ✅ закрыт (2026-06-02) |
| 3.5 | Декомпозиция `web/.../inspections/[id]/page.tsx` (1 143 → 235 строк) | [`web-inspections-decomposition.md`](./web-inspections-decomposition.md) | Low | M | L | ✅ закрыт (2026-06-02) |
| 3.6 | Тест-инфраструктура: единый runner + coverage | [`test-runner.md`](./test-runner.md) | Medium | M | L | ✅ закрыт (2026-06-02) |
| 3.7 | Mojibake-словари в `db.js` | [`mojibake-cleanup.md`](./mojibake-cleanup.md) | Low | S | L | ✅ закрыт (2026-06-02) |
| 3.8 | Монолитные web-страницы (vehicles 714, page 581, settings 826) | [`web-decomposition.md`](./web-decomposition.md) | Low | M | L | 3.8.1 ✅ + 3.8.2 ✅ + 3.8.3 ✅ + 3.8.4 ✅ + 3.8.5 ✅ + 3.8.6 ✅ + 3.8.7 ✅ + 3.8.8 ✅ (2026-06-02), epic полностью закрыт |
| 3.9 | Удаление `DEFAULT_JWT_SECRET` fallback | [`jwt-secret-store.md`](./jwt-secret-store.md) | Low | S | M | ✅ закрыт (2026-06-02) |
| 3.10 | Объединение документации в `docs/` | [`documentation-consolidation.md`](./documentation-consolidation.md) | Low | S | L | ✅ закрыт (2026-06-02) |

## Current status overrides

- Epic 3.1 is closed for Variant A (`better-sqlite3`) on 2026-06-04.
- Epic 3.3 is closed through launch verification on 2026-06-04.

## Effort-шкала

- **S** — < 1 дня (1-2 подзадачи).
- **M** — 1-3 дня (3-7 подзадач, требует coordination).
- **L** — > 3 дней (требует отдельного планирования и acceptance tests).

## Risk-шкала

- **L** — локальное изменение, легко откатить.
- **M** — затрагивает runtime-конфигурацию, требует production doctor.
- **H** — затрагивает multi-replica / миграцию данных / observability.

## Пилотные ограничения

Все epic'и **не блокируют пилот**. Пилот можно начинать сразу после:
1. `npm run doctor:production` на реальном production/staging env → `ok: true`.
2. `npm run backup:local` + `npm run backup:verify` → manifest в release-нотах.
3. `npm run release:evidence` → JSON приложен к release-нотам.
4. `npm run release:first-start` → read-only checklist.

Реализацию epic'ов начинать **после** успешного пилота и стабилизации UAT.
