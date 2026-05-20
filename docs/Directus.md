# Directus CMS integration note

Актуальная продуктовая модель для Directus в auditappmini — **Plan B: SaaS backoffice администратора ресурса**.

Directus не является панелью владельцев компаний, менеджеров или инспекторов. Владельцы компаний работают только в пользовательской web-панели и могут назначать менеджеров/инспекторов только внутри своей компании.

## Что делает Directus

Администратор ресурса управляет SaaS-уровнем:

- компании;
- владельцы компаний;
- тарифы;
- лимиты;
- feature flags;
- служебные заметки;
- опциональные snapshots агрегированной статистики.

## Что не переносится в Directus

Операционные данные компаний остаются в custom backend:

- техника;
- осмотры;
- дефекты;
- ДТП-поток;
- фото;
- OCR номера/одометра;
- hash фото;
- проверки гео/времени;
- PDF/ZIP/Excel экспорт;
- antifraud-логика;
- webhooks и бизнес-валидация.

## Актуальные файлы

- `docs/directus-cms.md` - основная архитектура и runbook.
- `directus/schema/mvp-schema.json` - активная SaaS-схема для bootstrap.
- `directus/schema/collections.md` - описание активных коллекций.
- `directus/schema/seed.md` - роли и стартовые справочники.
- `directus/schema/legacy-operational-schema.json` - историческая operational-схема; bootstrap не создает её как активную SaaS-схему, но скрывает уже существующие legacy-коллекции из меню Directus Studio без удаления данных.

## Актуальные endpoints

- `GET /api/integrations/directus/status`
- `POST /api/integrations/directus/provisioning/sync`
- `GET /api/admin/saas/stats`

Legacy endpoints preview/sync осмотра в Directus сохранены только для совместимости/диагностики и не входят в активную CMS-схему Plan B.
