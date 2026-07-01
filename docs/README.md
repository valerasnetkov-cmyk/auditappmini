# Документация `auditappmini`

Сводный каталог проектной документации. Корневые `README.md` / `CHANGELOG.md` / `plan.md`
остаются в корне репозитория как основные точки входа; здесь — тематические,
операционные и архитектурные документы.

> **Состав каталога зафиксирован в Epic 3.10 (2026-06-02).** Удалены
> дублирующие root-stub'ы (`backend.md`, `data-model.md`, `mobile.md`,
> `product.md`, `web.md`) и черновик `docs/readmee.md`. Добавлены
> `docs/SECURITY.md` и `CODEOWNERS`.

## Точки входа

- `../README.md` — актуальная входная страница проекта: стек, запуск,
  проверки, архитектура backend, роли, API-группы и ссылки на operations docs.
- `../CHANGELOG.md` — журнал изменений (включая секции audit findings).
- `../plan.md` — рабочий roadmap реализации и audit findings remediation.

## Продукт и роли

- [`product.md`](./product.md) — продуктовая логика, роли, типы осмотров, правила.
- [`data-model.md`](./data-model.md) — модель данных (сокращённая).
- [`billing-and-tariffs.md`](./billing-and-tariffs.md) — тарифы, лимиты,
  ручные оплаты и billing statuses.
- [`architecture.md`](./architecture.md) — общая архитектура backend/web/mobile.
- [`inspection-types.md`](./inspection-types.md) — типы осмотров (быстрый / плановый / ДТП).
- [`inspection-approval.md`](./inspection-approval.md) — P1 согласование завершённых осмотров и история решений.
- [`inspection-schedule.md`](./inspection-schedule.md) — P1 план-график быстрых и плановых осмотров.
- [`defect-lifecycle.md`](./defect-lifecycle.md) — P1 статусы, критичность и история обработки дефектов.
- [`inspection-photo-requirements.md`](./inspection-photo-requirements.md) — обязательные фото по типам осмотра.
- [`inspection-photo-pipeline.md`](./inspection-photo-pipeline.md) — WebP-конвейер загрузки и хранения фото.
- [`reliable-evidence-inspection.md`](./reliable-evidence-inspection.md) — P0 readiness, offline draft, watermark и PDF-отчёт.
- [`accident-inspection.md`](./accident-inspection.md) — осмотр ДТП: обязательные место и время.
- [`planned-inspection-systems.md`](./planned-inspection-systems.md) — технические блоки планового осмотра.
- [`odometer-recognition.md`](./odometer-recognition.md) — фото одометра и фиксация километража.
- [`vehicle-number-format.md`](./vehicle-number-format.md) — формат российского госномера.
- [`vehicle-number-recognition.md`](./vehicle-number-recognition.md) — распознавание номера по фото.
- [`ocr-provider-architecture.md`](./ocr-provider-architecture.md) — выбор OCR/ANPR-провайдера по региону компании.
- [`checklist.md`](./checklist.md) — чек-листы осмотра.
- [`i18n.md`](./i18n.md) — мультиязычность интерфейса.
- [`measurement-units.md`](./measurement-units.md) — единицы измерения пробега (km / mi).

## Backend / Web / Mobile

- [`backend.md`](./backend.md) — backend API и проверки (сокращённый справочник).
- [`web.md`](./web.md) — web-интерфейс (сокращённый справочник).
- [`mobile.md`](./mobile.md) — мобильный сценарий (сокращённый справочник).
- [`mobile-app-retirement.md`](./mobile-app-retirement.md) — статус legacy `mobile-app/` контура.
- [`first-system-admin.md`](./first-system-admin.md) — историческая справка о web-first System Admin.

## UI / темизация

- [`frontend-styles.md`](./frontend-styles.md) — внешние CSS-файлы, без inline-стилей.
- [`theme.md`](./theme.md) — system/light/dark тема + Приложение A (историческая справка: унификация цветовых токенов).

## Региональность и хранение

- [`data-residency.md`](./data-residency.md) — правила хранения данных по регионам.
- [`regional-deployment.md`](./regional-deployment.md) — региональные окружения.
- [`tenant-routing.md`](./tenant-routing.md) — маршрутизация компаний по регионам.
- [`storage.md`](./storage.md) — структура и правила хранения uploads / backups.

## Operational / Production

- [`launch-checklist.md`](./launch-checklist.md) — чеклист пилотного запуска.
- [`production-env.md`](./production-env.md) — production env (backend / web / mobile).
- [`deploy-vps.md`](./deploy-vps.md) — стабильный деплой на VPS `/opt/auditappmini`, PM2/502 диагностика.
- [`production-server-commands.md`](./production-server-commands.md) — шпаргалка оператора.
- [`deployment.md`](./deployment.md) — порядок выкладки.
- [`backup-restore.md`](./backup-restore.md) — backup / restore / verify.
- [`release-runbook.md`](./release-runbook.md) — release runbook (code → env → backup → build → UAT → rollback).
- [`first-production-start.md`](./first-production-start.md) — чеклист первого production-старта.
- [`operations-process-map.md`](./operations-process-map.md) — карта service-level процессов пилота.
- [`operations-workers.md`](./operations-workers.md) — целевая worker/queue архитектура и heartbeat-ready contract.
- [`observability-alerts.md`](./observability-alerts.md) — request id, structured logs, Sentry-ready env, Telegram alert dry-run и incident workflow.
- [`telegram_admin.md`](./telegram_admin.md) — Telegram-бот для service-admin сигналов без подключения tenant-пользователей.
- [`resource-admin-processes.md`](./resource-admin-processes.md) — resource-admin как service operations center без доступа к tenant endpoints.
- [`client-success-support.md`](./client-success-support.md) — support/customer-success сценарии пилота.
- [`sql-outline.md`](./sql-outline.md) — SQL-схема основных таблиц.

## Планирование и история

- [`implementation-plan.md`](./implementation-plan.md) — общий план реализации (исторический).
- [`do-not-do.md`](./do-not-do.md) — антипаттерны и запрещённые приёмы.
- [`security-github.md`](./security-github.md) — правила безопасного хранения секретов в GitHub.

## Качество и аудит

- [`QA-MFA-UI.md`](./QA-MFA-UI.md) — QA-сценарии MFA UI.
- [`audit-2026-06-02.md`](./audit-2026-06-02.md) — **полный отчёт аудита от 2026-06-02** (состояние, расхождения, epic'и).
- [`audit-2026-06-03.md`](./audit-2026-06-03.md) — продолжение backend decomposition.
- [`audit-2026-06-04.md`](./audit-2026-06-04.md) — Epic 3.1 и Epic 3.3 launch verification.
- [`audit-2026-06-05.md`](./audit-2026-06-05.md) — синхронизация README/security/epic docs после крупных правок.
- [`epics/`](./epics/) — track-only документы архитектурного долга (Epic 3.1–3.10). Сводный index в [`epics/README.md`](./epics/README.md). Закрытые epic'ы: 3.1 (`better-sqlite3`), 3.2 (Redis rate limit), 3.3 (backend decomposition), 3.4 (mobile decomposition), 3.5 (web inspections decomposition), 3.6 (test runner), 3.7 (mojibake cleanup), 3.8 (web decomposition), 3.9 (JWT secret store), 3.10 (docs consolidation).

## Контекстные изменения (changelog-документы)

Эти документы описывают точечные изменения отдельных контуров и могут
содержать исторически-значимые фрагменты, которые сейчас уже отражены в
`CHANGELOG.md`. Сохранены как контекст.

- [`saas-admin-kpi-dashboard-changes.md`](./saas-admin-kpi-dashboard-changes.md) — изменения KPI-дашборда resource-admin.
- [`saas-admin-without-directus-offline-payments.md`](./saas-admin-without-directus-offline-payments.md) — отказ от Directus и offline-payments MVP.

## Дополнительные документы

- [`SECURITY.md`](./SECURITY.md) — security policy, модель угроз, контакты для disclosure.
- [`../CODEOWNERS`](../CODEOWNERS) — назначение ревьюеров по контурам.
