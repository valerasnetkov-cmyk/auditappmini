Реализуй подключение Telegram-бота к проекту AuditAvto только для администратора сервиса.

Контекст:
- Проект AuditAvto: backend Express, web Next.js, mobile Expo.
- Directus удалён, управление сервисом находится во встроенном resource-admin / `/saas-admin`.
- Есть роли `admin`, `resource_manager`, `owner`, `manager`, `inspector`.
- На этом этапе Telegram нужен только для внутренней команды сервиса.
- Telegram не должен использоваться для уведомлений владельцев компаний, менеджеров и инспекторов.
- Telegram не должен менять существующую систему in-app уведомлений.
- Telegram должен быть дополнительным каналом быстрых сервисных сигналов.

Главная цель:
Добавить Telegram-уведомления только для администратора сервиса / команды сервиса, чтобы получать оперативные сообщения о событиях в SaaS-контуре.

MVP-события для Telegram:
1. Новая заявка на пилот.
2. Компания создана.
3. Новый offline-платёж добавлен.
4. Подписка компании скоро заканчивается.
5. Подписка компании перешла в `expired`.
6. Подписка компании перешла в `suspended`.
7. Ошибка генерации PDF-отчёта.
8. Ошибка production readiness / health, если в проекте уже есть источник такого события.
9. Критический дефект, но только как сервисный сигнал администратору, без фото и без персональных данных.

Что НЕ делать:
- Не подключать Telegram для owner / manager / inspector.
- Не добавлять привязку Telegram-аккаунтов пользователей компаний.
- Не добавлять `/start` для клиентов.
- Не добавлять команды управления компанией через Telegram.
- Не отправлять клиентские персональные данные.
- Не отправлять фотографии.
- Не отправлять PDF.
- Не отправлять setup-ссылки владельцев.
- Не отправлять JWT, cookie, токены, payload_json, внутренние secrets.
- Не менять mobile app.
- Не менять проведение осмотров, осмотр остаётся только в mobile app.
- Не добавлять Telegraf/Nest/новый framework.

Реализация backend:
1. Добавить сервис:
   `backend/src/services/telegramBot.js`

2. Telegram должен работать через обычный `fetch` к Telegram Bot API:
   `https://api.telegram.org/bot<TOKEN>/sendMessage`

3. Добавить env-переменные:
   TELEGRAM_BOT_ENABLED=false
   TELEGRAM_BOT_TOKEN=
   TELEGRAM_ADMIN_CHAT_ID=
   TELEGRAM_RESOURCE_ALERTS_CHAT_ID=

4. Поведение:
   - если `TELEGRAM_BOT_ENABLED=false`, сервис ничего не отправляет и не ломает backend;
   - если token или chat_id не задан, отправка должна безопасно пропускаться с безопасным warning без раскрытия token;
   - в production при `TELEGRAM_BOT_ENABLED=true` doctor должен требовать `TELEGRAM_BOT_TOKEN` и хотя бы один chat id;
   - token никогда не логировать.

5. Добавить helper:
   `sendTelegramAdminAlert({ type, title, message, url, severity })`

6. Формат сообщения:
   - короткое русское сообщение;
   - без чувствительных данных;
   - с ссылкой на нужную страницу web-панели;
   - использовать HTML parse_mode или plain text, но без сложной разметки.

Пример сообщения:

[AuditAvto] Новая заявка на пилот

Компания: указать только название, если оно уже публично введено в заявке.
Статус: новая заявка.
Открыть: https://auditavto.ru/saas-admin/pilot-requests

7. Ссылки вести только в web/resource-admin:
   - `/saas-admin/pilot-requests`
   - `/saas-admin/companies`
   - `/saas-admin/companies/:id`
   - `/saas-admin/payments`
   - `/saas-admin/alerts`

8. Добавить дедупликацию или минимальный антиспам:
   - одинаковые события одного типа по одной компании не отправлять чаще одного раза за заданное окно;
   - для MVP можно хранить in-memory Map;
   - не ломать работу при рестарте.

9. Добавить resource-admin endpoints:
   GET /api/admin/resource/telegram/status
   POST /api/admin/resource/telegram/send-test

10. Доступ:
   - только `admin`;
   - если в проекте уже есть permissions для resource_manager, добавить permission `telegram.manage`, но не открывать по умолчанию всем;
   - owner / manager / inspector не имеют доступа.

11. `GET /status` должен возвращать:
   - enabled true/false;
   - configured true/false;
   - adminChatConfigured true/false;
   - resourceAlertsChatConfigured true/false;
   - tokenFingerprint только короткий безопасный отпечаток, например последние 4 символа hash, но не сам token.

12. `POST /send-test` должен отправлять тестовое сообщение:
   "Тестовое уведомление AuditAvto: Telegram-бот администратора сервиса подключён."

13. Добавить smoke-тест:
   `backend/scripts/smoke-telegram.mjs`

Проверить:
- при `TELEGRAM_BOT_ENABLED=false` backend не падает;
- production doctor ругается, если Telegram включён без token;
- `/api/admin/resource/telegram/status` доступен только admin;
- `/send-test` недоступен owner / manager / inspector;
- token не попадает в JSON response;
- mock transport получает ожидаемый payload.

14. Добавить npm script:
   `npm --prefix backend run smoke:telegram`

15. Обновить документацию:
   - `README.md`
   - `docs/backend.md`
   - `docs/launch-checklist.md`
   - `CHANGELOG.md`

16. Не ломать проверки:
   - `npm --prefix backend run lint`
   - `npm --prefix backend run test:unit`
   - `npm --prefix backend run smoke`
   - `npm --prefix backend run smoke:telegram`
   - `npm run verify:launch`

Критерии готовности:
- Telegram полностью optional.
- Без env-переменных проект работает как раньше.
- Администратор сервиса может отправить тестовое сообщение.
- Новые пилотные заявки и сервисные события приходят в Telegram.
- Клиентские роли и tenant-пользователи не подключены к Telegram.
- В Telegram не уходят чувствительные данные, фото, PDF, токены и setup-ссылки.