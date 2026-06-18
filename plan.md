# План реализации: отказ от Directus и отдельный контур администратора ресурса

## Цель
- Убрать Directus из активной архитектуры проекта: без CMS, bootstrap, seed, provisioning sync и Directus endpoints.
- Перенести управление ресурсом в существующий custom backend/web.
- Выделить администратора всего ресурса в отдельный контур, не смешанный с операционными ролями компаний.

## Архитектурное решение
- Directus удаляется как runtime-зависимость, инфраструктурный контур и целевой CMS-layer.
- Backoffice проекта реализуется встроенным backend API и web-разделом `/saas-admin`, который переименовывается по смыслу в "Администрирование ресурса".
- Backend resource-admin API работает только с сервисным уровнем:
  - компании;
  - владельцы компаний;
  - тарифы;
  - лимиты;
  - статусы компаний;
  - health-индикаторы сервиса.
- Provisioning компаний, владельцев и лимитов выполняется через backend, а не через Directus seed/sync.

## Границы ролей
- `admin` является администратором ресурса и управляет компаниями, владельцами компаний, тарифами и лимитами.
- `admin` не видит технику, осмотры, дефекты, фотографии и пользовательские списки конкретной компании через tenant endpoints.
- `admin` не назначает `manager` и `inspector` внутри компаний.
- `owner` назначает `manager` и `inspector` только внутри своей компании.
- `manager` и `inspector` не имеют доступа к resource-admin панели и API.
- Tenant isolation smoke должен проверять, что `admin` не может читать операционные данные компании через пользовательские endpoints.

## Этапы реализации
1. Зафиксировать решение в `CHANGELOG.md` и обновить документацию запуска.
2. Удалить Directus runtime:
   - убрать backend route/service;
   - убрать регистрацию Directus routes;
   - удалить Directus scripts из npm smoke/CI gates;
   - убрать `DIRECTUS_*` из env examples, launch doctor и production checklist.
3. Удалить Directus docs/infrastructure:
   - удалить `directus/`;
   - удалить активные Directus docs;
   - заменить README/docs формулировками про встроенное администрирование ресурса.
4. Пересобрать resource-admin backend:
   - добавить CRUD/API для компаний;
   - добавить CRUD/API для владельцев компаний;
   - добавить CRUD/API для тарифов и лимитов;
   - отдавать только сервисные данные и health-индикаторы без операционных метрик компаний.
5. Обновить web `/saas-admin`:
   - переименовать экран по смыслу в "Администрирование ресурса";
   - убрать операционные показатели техники/осмотров/дефектов/фото;
   - подключить backend resource-admin API.
6. Уточнить access control:
   - исключить `admin` из tenant manager/owner checks;
   - оставить назначение пользователей компании только за `owner`;
   - закрыть resource-admin API для `manager` и `inspector`.
7. Сохранить pre-launch fixes:
   - закрыть backend/web audit vulnerabilities;
   - починить полноценный MFA login flow;
   - сделать `doctor:production`, backup/restore и release evidence обязательными перед пилотом.

## Проверки
- `npm --prefix backend run smoke`
- `npm --prefix backend run smoke:isolation`
- новый smoke для resource-admin CRUD компаний/владельцев/тарифов
- `npm --prefix web run lint`
- `npm --prefix web run build`
- `npm --prefix mobile run typecheck`
- `npm --prefix backend audit --audit-level=moderate`
- `npm --prefix web audit --audit-level=moderate`
- `npm --prefix mobile audit --audit-level=moderate`
- `npm run release:readiness`
- `npm run doctor:production` на реальном pilot env

## Статус реализации
- Выполнено в рамках публичного демо: создана изолированная тестовая компания
  `demo` с режимом `demo_readonly`, отдельным демо-пользователем, лимитами и
  запретом изменения операционных данных.
- Выполнено наполнение демо: добавлены 12 единиц техники, 36 осмотров,
  16 дефектов, чек-листы, пробег, ДТП-сценарии и безопасные демонстрационные
  изображения без реальных данных компаний.
- Выполнено наполнение аналитики: последние семь дней содержат 21 осмотр с
  дневными значениями `2, 3, 4, 3, 5, 3, 1`; оставшиеся записи формируют
  историю за предыдущие периоды.
- Выполнено уточнение географии демо-парка: вместо «Сахалинская область»
  используется «Невельск».
- Выполнено обновление лендинга: карточка осмотра ежедневно рассчитывает
  актуальную дату по часовому поясу Сахалина, следующий осмотр через семь
  дней, текущий пробег и месячную динамику. Основной заголовок возвращён к
  формулировке «Контроль автопарка без спорных фото и ручного хаоса».
- Выполнены проверки публичного демо: API аналитики возвращает недельную
  динамику, smoke-тест подтверждает режим только для чтения и защищённую
  выдачу фотографий, ESLint страницы лендинга проходит без ошибок.
- Выполнено: решение об отказе от Directus зафиксировано в `CHANGELOG.md`, README и launch/release docs.
- Выполнено: Directus runtime routes/services, scripts, env-переменные, docs и каталог `directus/` удалены из активного контура.
- Выполнено: resource-admin backend API поддерживает компании, владельцев компаний, тарифы и лимиты.
- Выполнено: `/saas-admin` показывает "Администрирование ресурса" и работает с сервисными сущностями без техники, осмотров, дефектов и фото компаний.
- Выполнено: роль `admin` отделена от tenant endpoints, а resource-admin API закрыт для `owner`, `manager` и `inspector`.
- Выполнено: MFA login challenge, backend/web/mobile audit gates, smoke-проверки и полный локальный `npm run verify:launch` проходят.
- Выполнено P0: durable mobile draft, неблокирующая очередь фото, единый
  readiness, неизменяемость завершённого акта, watermark и авторизованный PDF
  с проверкой SHA-256/размера.
- Выполнено P1 согласование: отдельный `approval_status`, tenant/RBAC
  переходы, история решений, адресные in-app уведомления, web-карточка и
  отображение решения в PDF. `completed` остаётся технической полнотой.
- Выполнено P1 план-график: tenant-интервалы quick/planned, переопределения
  техники, единый расчёт сроков и рисков, backend-фильтрация, dashboard
  напоминания и web UI списка/карточки/настроек.
- Выполнено P1 lifecycle дефекта: критичность, управленческие статусы,
  обязательный комментарий, tenant-история, RBAC, critical-уведомления,
  ручное создание и web-фильтры. Доказательная часть завершённого акта
  остаётся неизменной.
- Выполнено RC-gates 2026-06-18: `npm run verify:launch`,
  `npm run backup:local`, `npm run backup:verify`,
  `npm run release:readiness`, `npm run release:evidence` и
  `npm run mobile:eas:readiness` проходят локально. Release readiness
  возвращает `pilot-ready-after-release-actions`.
- Выполнено RC dependency hardening: web/mobile audits закрыты через
  транзитивные `overrides` для `@babel/core`, `js-yaml`, `tmp` и `ws` без
  React Native/Expo major upgrade перед пилотом.
- Freeze перед RC: не расширять SaaS/P1-функции и не продолжать крупную
  декомпозицию до внешнего pilot/staging `doctor:production`, кроме точечных
  исправлений найденных release gate failures.
- Осталось перед пилотом: запустить `npm run doctor:production` на реальном
  pilot/staging окружении с production secrets и persistent paths,
  создать/проверить backup уже на pilot/staging данных, приложить release
  evidence JSON к release notes и собрать mobile EAS artifact отдельным
  решением.
- В работе после отказа от Directus: resource-admin контур разделяется на операционные страницы; добавлен MVP оффлайн-платежей и подписок (`company_payments`, `company_subscriptions`, `/api/admin/resource/payments`, `/saas-admin/payments`) как основа для ручного продления тарифов, MRR и будущих уведомлений.
- Выполнено в рамках разделения resource-admin: `/saas-admin` стал обзором ресурса, `/saas-admin/companies` отвечает за реестр компаний/владельцев/лимиты, `/saas-admin/plans` — за тарифы, `/saas-admin/payments` — за оффлайн-платежи и подписки.
- Выполнено в рамках offline billing: добавлен сканер сроков подписок, API `/api/admin/resource/alerts`, команда `npm --prefix backend run subscriptions:check` и страница `/saas-admin/alerts` для уведомлений о 14/7/3/1 днях до окончания, grace period, просрочке и приостановке.
- Выполнено в рамках карточки клиента: добавлен API `/api/admin/resource/companies/:id` и страница `/saas-admin/companies/[id]` с сервисным обзором компании, владельцами, тарифом/лимитами, платежами, уведомлениями и журналом действий без обращения к tenant endpoints.
- Выполнено в рамках subscription guard: backend блокирует новые операционные действия при `expired` и переводит tenant-контур в read-only при `suspended`, сохраняя чтение истории; добавлен `npm --prefix backend run smoke:subscription-guard`.

- Выполнено в рамках tenant visibility: `/api/company/usage` расширен безопасным статусом подписки, предупреждениями и последними сервисными уведомлениями текущей компании; dashboard и настройки компании показывают баннер тарифа без обращения к resource-admin endpoints.
- Выполнено в рамках сервисных уведомлений: owner получает уведомления по тарифу всегда, выбранные manager подключаются через `/api/company/service-notification-recipients`, а scanner подписок создает tenant-уведомления параллельно с resource-admin уведомлениями.
- Выполнено в рамках tenant UX: web-контур компании заранее переводит создание техники, запуск новых осмотров, Excel-импорт, demo-data, редактирование/архивирование техники, управление пользователями и справочник регионов в недоступное состояние при `suspended` подписке или отключенной компании; при `expired` блокируются новые операционные записи. Причина ограничения показывается до backend 403.

## Audit findings remediation
- Выполнено: унифицированы ошибки `/api/auth/login`, чтобы не раскрывать существование email при неверных учетных данных.
- Выполнено: web-клиент переведен с постоянного JWT в `localStorage` на httpOnly session-cookie; Bearer-token оставлен для mobile/smoke/API-совместимости, старые web-токены удаляются из `localStorage` при первом чтении.
- Выполнено: поток выдачи доступа владельцу компании оформлен через одноразовые setup-ссылки со статусами, повторной генерацией, копированием ссылки и mailto-приглашением в resource-admin UI; пароль владелец задает самостоятельно.
- Выполнено: загрузка фото проверяет фактический формат изображения через `sharp`, сверяет его с заявленным MIME-типом и ограничивает декодирование через `MAX_IMAGE_PIXELS`.
- Выполнено: `MAX_IMAGE_PIXELS` добавлен в env examples, production docs и backend launch doctor.
- Выполнено: добавлены CSP/COOP/CORP security headers, smoke-проверки этих заголовков и параметры в env/production docs/launch doctor.
- Выполнено: `PUBLIC_REGISTRATION_ENABLED` больше не зависит от `NODE_ENV` по умолчанию; публичная регистрация отключена и включается только явным opt-in.
- Выполнено: `smoke:production-guard` расширен реальным коротким стартом backend в `NODE_ENV=production` с валидным env.
- Выполнено: `.gitignore` очищен от дублей и явно исключает runtime SQLite, uploads/backups/logs, `.tmp-*`, `.tmp-runtime`, `.tmp-e2e` и release artifacts.
- Миграция с `sql.js` на `better-sqlite3` и распределённый Redis rate limit
  уже выполнены и покрыты unit/smoke-проверками.
- В работе: укрупнённый рефакторинг backend/web/mobile модулей. Из
  `adminSaas.js` выделен самостоятельный `subscriptionAlerts` service с
  unit-тестами и сохранением resource-admin API.
- Продолжение backend-декомпозиции: payment queries, billing summary, MRR и
  перерасчёт подписки выделены в `resourceBilling` service; `adminSaas.js`
  уменьшен до 1799 строк.
- Тарифы и лимиты выделены в `resourcePlans` service; resource-admin RBAC и
  аудит сохранены в route-слое, `adminSaas.js` уменьшен до 1646 строк.
- Владельцы компаний и состояния setup-link выделены в `resourceOwners`
  service; `adminSaas.js` уменьшен до 1550 строк.
- Реестр компаний и resource-admin health/risk mapping выделены в
  `resourceCompanies` service; `adminSaas.js` уменьшен до 1346 строк.
- Уведомления resource/company scope и чтение audit log выделены в
  `resourceActivity` service; `adminSaas.js` уменьшен до 1258 строк.
- Limit usage, billing summary и churn/upsell расчёты выделены в
  `resourceInsights` service; `adminSaas.js` уменьшен до 1152 строк.
- Dashboard totals, plan breakdown, activity trend, product activity, storage,
  OCR stats, service health, health center и activation funnel выделены в
  `resourceDashboard` service; `adminSaas.js` уменьшен до 712 строк, backend
  unit suite содержит 80 тестов.
- Сборка resource-admin `/stats` response и карточки компании выделена в
  `resourceAdminStats` service; `adminSaas.js` уменьшен до 642 строк, backend
  unit suite содержит 81 тест.

## Допущения
- Выполнено в рамках tenant UX: журналы и карточки осмотров/техники/дефектов, импорт, справочники и сервисные настройки показывают баннер тарифа и блокируют создание, удаление, закрытие/переоткрытие дефектов, сохранение/завершение осмотра, загрузку и удаление фото при `suspended`, отключенной компании или `expired` там, где создается новая операционная запись.
- Directus удаляется как активная часть проекта, а не остается optional CMS.
- Для MVP-пилота управление компаниями, владельцами и тарифами живет в существующем custom backend/web.
- Администратор ресурса видит только сервисный уровень и не участвует в операционной работе компаний.
