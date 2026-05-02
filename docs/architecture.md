# Architecture

## Цель архитектуры

Проект должен остаться простым MVP, но не заблокировать рост до multi-company SaaS.

---

## Текущий принцип

```txt
Один код -> одна база -> много компаний через company_id
```

Не создаются отдельные копии проекта для каждой компании.

---

## Основные потоки

### Осмотр техники

```txt
Инспектор -> ввод номера -> подтверждение техники -> тип осмотра -> фото -> одометр -> чек-лист -> дефекты -> завершение
```

### ДТП

```txt
Инспектор -> тип ДТП -> общий план -> фото сторон авто -> повреждения close-up -> одометр -> завершение
```

### OCR номера

```txt
Фото номера -> распознавание -> нормализация -> подтверждение инспектором
```

### OCR одометра

```txt
Фото одометра -> распознавание -> подтверждение/исправление инспектором -> карточка осмотра
```

---

## Основные сущности

```txt
companies
company_users
vehicles
inspections
inspection_items
defects
photos
photo_requirements
vehicle_number_recognitions
odometer_recognitions
audit_logs
```

---

## Требования к фото

Обязательные фото должны определяться по типу осмотра. Backend должен выполнять финальную проверку перед завершением.

---

## SaaS-ready слой

- `company_id` во всех бизнес-таблицах;
- tenant middleware;
- storage path с `company_id`;
- для ДТП отдельно сохраняются место и время ДТП;
- роли внутри компании;
- audit logs;
- i18n на уровне пользователя и компании.

---

## Frontend styles

Web-интерфейс использует внешние CSS-файлы. Компоненты не должны хранить inline-стили.

---

## Что важно не сломать

- Ручной ввод номера должен работать всегда.
- OCR номера и одометра — только помощник, не источник истины.
- Осмотр нельзя завершить без обязательных фото.
- Данные разных компаний не должны пересекаться.
- Фото должны быть доступны только пользователям своей компании.

## Плановый осмотр

Плановый осмотр расширяет базовую фотофиксацию и использует технические секции чек-листа:

```txt
exterior -> внешнее состояние
undercarriage -> ходовая часть
brake_system -> тормозная система
electrical -> электрика
lighting -> световые приборы
```

Каждый пункт планового осмотра сохраняется с `section_key` и `component_area`. Это позволяет показывать осмотр в web по разделам, фильтровать дефекты и строить отчёт без внедрения модуля ремонта.

---

## Theme layer

Архитектура должна поддерживать светлую и тёмную тему для web/ПК и мобильного приложения.

Поддерживаемые режимы:

```txt
system
light
dark
```

Тема не должна быть частью бизнес-логики осмотра. Это пользовательская настройка интерфейса.

Общий поток:

```txt
user preference -> company default -> system preference -> UI theme tokens
```

Для web тема применяется через CSS variables и `data-theme`. Для mobile — через единый theme provider / theme tokens.

Системные цвета статусов, дефектов, ошибок и предупреждений должны быть читаемыми в обеих темах.

## Regional multi-tenant architecture

Проект должен поддерживать региональную multi-tenant модель:

```txt
Один код -> несколько региональных деплоев -> tenant закреплён за регионом
```

Рекомендуемые контуры:

```txt
ru     -> РФ-компании
 eu    -> EU / EEA компании
intl   -> остальные компании
```

Для MVP можно запустить:

```txt
ru
intl
```

Компоненты каждого региона:

```txt
regional API
regional PostgreSQL
regional Storage
regional OCR
regional workers
regional logs
regional backups
```

Глобальный слой содержит только `tenant_registry` для маршрутизации. Он не хранит рабочие данные осмотров.

---

### Routing

```txt
<tenant>.<project-domain>
  -> tenant registry
  -> region_code
  -> regional API
  -> regional DB / Storage / OCR
```

Backend всегда повторно проверяет `company_id`, `region_code` и доступ пользователя. Нельзя полагаться только на frontend или поддомен.

## Единицы измерения пробега

Единицы измерения пробега являются company-level настройкой.

```txt
company.distance_unit -> km / mi
```

Поток:

```txt
Company settings -> mobile odometer screen -> OCR value -> inspector confirmation -> inspection.odometer_value + inspection.odometer_unit
```

Backend должен использовать единицу компании для новых осмотров и хранить её снимок в карточке осмотра, чтобы история не менялась неконтролируемо после смены настройки.

---

## OCR / ANPR architecture

Распознавание номера выполняется через заменяемый provider layer.

```txt
mobile/web
-> /api/vehicle-number/recognize
-> tenant middleware
-> region resolver
-> OCR provider registry
-> regional OCR / ANPR
-> normalization and validation
-> inspector confirmation
```

Система не должна напрямую привязывать mobile-приложение к конкретному OCR-сервису. Провайдера можно заменить на backend без изменения UX.

Региональное правило:

```txt
RU tenant   -> RU OCR provider
EU tenant   -> EU OCR provider
INTL tenant -> INTL OCR provider
```

---

## Связанные документы по распознаванию номера

```txt
docs/vehicle-number-format.md
docs/vehicle-number-recognition.md
docs/ocr-provider-architecture.md
```
