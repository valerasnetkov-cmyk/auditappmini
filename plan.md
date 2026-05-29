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
- Выполнено: решение об отказе от Directus зафиксировано в `CHANGELOG.md`, README и launch/release docs.
- Выполнено: Directus runtime routes/services, scripts, env-переменные, docs и каталог `directus/` удалены из активного контура.
- Выполнено: resource-admin backend API поддерживает компании, владельцев компаний, тарифы и лимиты.
- Выполнено: `/saas-admin` показывает "Администрирование ресурса" и работает с сервисными сущностями без техники, осмотров, дефектов и фото компаний.
- Выполнено: роль `admin` отделена от tenant endpoints, а resource-admin API закрыт для `owner`, `manager` и `inspector`.
- Выполнено: MFA login challenge, backend/web/mobile audit gates, smoke-проверки и полный локальный `npm run verify:launch` проходят.
- Осталось перед пилотом: запустить `npm run doctor:production` на реальном pilot/staging окружении, создать и проверить backup, приложить release evidence и собрать mobile EAS artifact.
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
- Осталось: миграция с `sql.js`, распределенный rate limit, укрупненный рефакторинг backend/web/mobile монолитов.

## Допущения
- Выполнено в рамках tenant UX: журналы и карточки осмотров/техники/дефектов, импорт, справочники и сервисные настройки показывают баннер тарифа и блокируют создание, удаление, закрытие/переоткрытие дефектов, сохранение/завершение осмотра, загрузку и удаление фото при `suspended`, отключенной компании или `expired` там, где создается новая операционная запись.
- Directus удаляется как активная часть проекта, а не остается optional CMS.
- Для MVP-пилота управление компаниями, владельцами и тарифами живет в существующем custom backend/web.
- Администратор ресурса видит только сервисный уровень и не участвует в операционной работе компаний.
