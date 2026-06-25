# Задача Codex: разделение РФ и международного профиля AuditAvto / ProofFleet

## Контекст

Сейчас проект AuditAvto работает для РФ-пользователей на домене:

- `auditavto.ru`
- `api.auditavto.ru`

Для международного рынка выбран отдельный бренд и домен:

- `ProofFleet.com`
- `api.ProofFleet.com`

Международный контур должен быть отдельным runtime/deployment-контуром, но может использовать общую кодовую базу текущего проекта.

Проект уже имеет рабочие контуры:

- backend;
- web;
- mobile Expo;
- resource-admin;
- тарифы и лимиты;
- offline billing;
- PDF-отчёты;
- фотофиксацию;
- mobile-only проведение осмотров;
- роли `admin`, `resource_manager`, `owner`, `manager`, `inspector`;
- legal-контур РФ;
- публичный лендинг;
- demo-контур;
- production doctor / release readiness / backup verification.

Теперь необходимо подготовить архитектурное разделение проекта на два профиля:

1. **RF profile / AuditAvto** — текущий продукт для российского рынка.
2. **International profile / ProofFleet** — отдельный международный контур на домене `ProofFleet.com`, отдельном сервере и отдельной БД.

Важно: на этом этапе не нужно ломать текущий РФ production и не нужно переписывать проект с нуля.

---

## Главная цель

Подготовить проект к работе в двух независимых рыночных профилях:

```txt
RF profile:
auditavto.ru
api.auditavto.ru
AuditAvto brand
RU language
RUB tariffs
Russian legal documents
Russian market positioning

International profile:
ProofFleet.com
api.ProofFleet.com
ProofFleet brand
EN language
USD/EUR tariffs
International legal documents
GDPR/cookie-ready public contour
International fleet inspection positioning
```

Кодовая база может оставаться общей, но runtime-среды должны быть независимыми.

---

## Базовое архитектурное решение

Не создавать новый проект с нуля.

Использовать текущий репозиторий, но подготовить режимы/профили:

```txt
APP_MARKET_PROFILE=rf
APP_MARKET_PROFILE=international
```

РФ-контур должен остаться рабочим по умолчанию.

International-контур должен включаться только явной env-переменной.

Для international-профиля использовать бренд:

```txt
ProofFleet
```

и домены:

```txt
ProofFleet.com
api.ProofFleet.com
```

---

## Критические ограничения

1. Не менять текущий production-домен `auditavto.ru`.
2. Не менять текущий API-домен `api.auditavto.ru`.
3. Не ломать текущие РФ-тарифы в рублях.
4. Не смешивать РФ и international данные.
5. Не смешивать uploads, backups, SQLite database и PDF reports.
6. Не смешивать legal documents.
7. Не менять mobile production API для РФ-сборки.
8. Не включать публичную регистрацию по умолчанию.
9. Не добавлять Directus, Supabase, Firebase, Strapi, Payload CMS или другой CMS/backend без отдельного решения.
10. Не проводить осмотр через web: текущий контракт сохраняется — проведение осмотра только в mobile app, web остаётся контуром контроля, истории, согласования и отчётов.
11. Не использовать `ProofFleet.com` внутри РФ-профиля.
12. Не использовать `auditavto.ru` внутри international production-профиля, кроме документации миграции/истории.

---

## Что нужно реализовать

### 1. Market profile configuration

Добавить единый конфиг рыночного профиля.

Пример:

```env
APP_MARKET_PROFILE=rf
```

Допустимые значения:

```txt
rf
international
```

Поведение:

- если переменная не задана — использовать `rf`;
- если задано неизвестное значение — production doctor должен возвращать ошибку;
- international-режим должен быть явно включаемым;
- все зависящие от рынка настройки должны читаться централизованно, а не через scattered checks по коду.

Нужно создать helper/service, например:

```txt
backend/src/config/marketProfile.js
web/src/lib/marketProfile.ts
mobile/src/config/marketProfile.ts
```

или более подходящую структуру по текущей архитектуре проекта.

---

### 2. Brand profile configuration

Добавить разделение бренда по профилю.

RF:

```txt
brandName=AuditAvto
publicDomain=auditavto.ru
apiDomain=api.auditavto.ru
```

International:

```txt
brandName=ProofFleet
publicDomain=ProofFleet.com
apiDomain=api.ProofFleet.com
```

Бренд должен использоваться в:

- title/meta;
- public landing;
- footer;
- legal pages;
- email/service notification templates;
- PDF report footer/CTA;
- mobile app display configuration where applicable;
- resource-admin display.

Не хардкодить `AuditAvto` там, где текст зависит от market profile.

---

### 3. Разделить публичное позиционирование

Для РФ сохранить текущую логику и тексты AuditAvto.

Для ProofFleet подготовить англоязычное позиционирование.

Основная формулировка:

```txt
ProofFleet — fleet inspections with photo evidence, mileage history and defect tracking.
```

Дополнительные формулировки:

```txt
Photo-based fleet inspections without lost evidence, spreadsheet chaos or disputed damage.
```

```txt
Digital fleet inspection reports with verifiable photos, odometer records and defect history.
```

```txt
ProofFleet helps fleet owners control vehicle inspections, defects, incidents and mileage with structured mobile evidence.
```

International landing должен использовать английские тексты, но не должен удалять или ломать текущий РФ landing.

---

### 4. i18n foundation

Добавить основу локализации.

Минимальная структура:

```txt
locales/
  ru.json
  en.json
```

или существующий архитектурно корректный вариант для текущего Next.js / Expo проекта.

На первом этапе не обязательно переводить абсолютно всё, но нужно заложить правильный слой для:

- public landing;
- login;
- MFA;
- owner setup;
- dashboard;
- vehicles;
- inspections;
- defects;
- PDF labels;
- service notifications;
- validation errors.

Не делать простую замену русских строк на английские в компонентах. Нужно подготовить расширяемый механизм.

---

### 5. Company-level international settings

Добавить настройки компании/tenant, которые нужны международному рынку:

```txt
locale
country
timezone
currency
distance_unit
vehicle_identifier_label
```

Рекомендуемые значения:

```txt
locale: ru | en
currency: RUB | USD | EUR | GBP
distance_unit: km | mi
country: ISO country code or text field
timezone: IANA timezone
```

Для РФ-профиля дефолты:

```txt
locale=ru
currency=RUB
distance_unit=km
timezone=Asia/Sakhalin или текущая логика проекта
```

Для ProofFleet international-профиля дефолты:

```txt
locale=en
currency=USD
distance_unit=mi или km — через env/default setting
timezone=UTC
```

---

### 6. Vehicle number / license plate policy

Сейчас в проекте есть российский контекст номеров и регионов.

Для international-профиля нельзя требовать российский формат госномера.

Нужно:

- сохранить РФ-валидацию там, где она нужна РФ-профилю;
- добавить international-friendly режим свободного vehicle identifier;
- не ломать поиск техники по номеру;
- не ломать существующие vehicle APIs;
- не ломать smoke-тесты РФ-контура.

Пример поведения:

```txt
rf:
vehicle number может иметь российскую нормализацию/валидацию.

international:
vehicle number / plate / unit ID — свободная строка с базовой sanitization.
```

В ProofFleet UI поле можно называть:

```txt
Vehicle ID / Plate number
```

---

### 7. Tariffs and billing profile

Сохранить текущие РФ-тарифы:

```txt
pilot: 5 000 ₽
standard: 15 000 ₽
enterprise: 50 000 ₽
```

Для ProofFleet подготовить отдельную тарифную конфигурацию.

Начальная сетка:

```txt
Starter / Pilot: 49–99 USD
Growth / Standard: 149–299 USD
Business / Enterprise: 499+ USD
Enterprise: custom
```

На этом этапе не обязательно подключать Stripe/Paddle, но нужно подготовить структуру, чтобы:

- тарифы не были жёстко привязаны к RUB;
- currency отображалась корректно;
- resource-admin видел профиль рынка;
- tenant usage показывал валюту текущей компании;
- РФ billing не изменился.

---

### 8. Legal contour separation

Сейчас есть РФ legal-контур.

Нужно подготовить структуру для ProofFleet international legal pages:

```txt
Privacy Policy
Terms of Service
Cookie Policy
Data Processing Addendum / DPA
Acceptable Use Policy
Subscription Terms
```

На этом этапе можно добавить placeholder-документы с явной пометкой:

```txt
Draft international legal document for ProofFleet. Requires legal review before production launch.
```

Но нельзя показывать РФ-оферту как международные terms.

Для international-профиля footer должен вести на ProofFleet legal pages.

Для РФ-профиля footer должен остаться на текущих РФ-документах.

---

### 9. Cookie consent separation

Для ProofFleet international-профиля подготовить cookie consent, совместимый с международным запуском:

- Accept all;
- Reject all;
- Manage preferences;
- strictly necessary cookies отдельно;
- analytics/marketing cookies только после согласия.

Для РФ-профиля текущий cookie banner не ломать.

---

### 10. Environment examples

Добавить env examples для ProofFleet international production.

Пример backend env:

```env
APP_MARKET_PROFILE=international

APP_PUBLIC_URL=https://ProofFleet.com
API_PUBLIC_URL=https://api.ProofFleet.com
CORS_ORIGINS=https://ProofFleet.com

DATABASE_PATH=/var/lib/prooffleet/data/database.sqlite
UPLOAD_DIR=/var/lib/prooffleet/uploads
BACKUP_DIR=/var/lib/prooffleet/backups

JWT_SECRET=
TRUST_PROXY=1

PUBLIC_REGISTRATION_ENABLED=false
PUBLIC_DEMO_ENABLED=false
PUBLIC_DEMO_PASSWORD=
```

Пример web env:

```env
APP_MARKET_PROFILE=international
NEXT_PUBLIC_APP_MARKET_PROFILE=international
NEXT_PUBLIC_APP_BRAND=ProofFleet
NEXT_PUBLIC_APP_URL=https://ProofFleet.com
NEXT_PUBLIC_API_URL=https://api.ProofFleet.com/api
```

Нужно убедиться, что `doctor:production` проверяет:

- корректный `APP_MARKET_PROFILE`;
- production URLs без placeholder;
- persistent absolute paths;
- strong secrets;
- корректный CORS;
- отсутствие смешивания `auditavto.ru` в international-профиле, если это production international env;
- отсутствие смешивания `ProofFleet.com` в РФ production-профиле.

---

### 11. Mobile profile separation

Подготовить mobile к двум API-контурам.

РФ mobile:

```txt
EXPO_PUBLIC_API_URL=https://api.auditavto.ru/api
```

ProofFleet mobile:

```txt
EXPO_PUBLIC_API_URL=https://api.ProofFleet.com/api
```

Не менять текущий package/bundle id без отдельного решения.

Но подготовить документацию, где указать, что ProofFleet mobile build должен иметь:

```txt
new package name
new app name: ProofFleet
new store assets
new privacy policy URL: https://ProofFleet.com/privacy
new support URL: https://ProofFleet.com/support или https://ProofFleet.com
```

---

### 12. Resource-admin awareness

Resource-admin должен понимать market profile компании или deployment.

Нужно добавить отображение:

```txt
Market profile: RF / International
Brand: AuditAvto / ProofFleet
Locale
Currency
Distance unit
Country
Timezone
Public domain
API domain
```

Важно: resource-admin не должен получать доступ к tenant operational endpoints. Текущую tenant isolation не ломать.

---

### 13. Documentation

Обязательно обновить документацию:

```txt
AGENTS.md
CHANGELOG.md
docs/YYYY.MM.DD.md
docs/international-profile.md
docs/prooffleet.md
docs/production-env.md
docs/launch-checklist.md
docs/mobile.md
docs/web.md
docs/backend.md
```

Если файла `docs/YYYY.MM.DD.md` на текущий день нет — создать.

В документации зафиксировать:

- РФ и ProofFleet international — разные runtime-среды;
- общая кодовая база допустима;
- данные не смешиваются;
- ProofFleet запускается на отдельном сервере, домене и БД;
- production env должен проходить doctor до запуска;
- ProofFleet international legal documents требуют юридической проверки перед публичным запуском;
- `ProofFleet.com` является международным доменом;
- `api.ProofFleet.com` является международным API-доменом.

---

## Проверки после реализации

Выполнить:

```bash
npm run lint
npm run verify:launch
npm run release:readiness
npm run doctor:production
```

Если `doctor:production` невозможно выполнить локально без реальных production env, это нужно явно зафиксировать в отчёте.

Также добавить или обновить targeted tests/smoke:

```bash
npm --prefix backend run smoke:market-profile
npm --prefix backend run smoke:billing-policy
npm --prefix backend run smoke:saas-admin
npm --prefix web run build
npm --prefix mobile run typecheck
```

Если новых smoke-команд ещё нет, добавить минимальный smoke для проверки:

- `APP_MARKET_PROFILE=rf`;
- `APP_MARKET_PROFILE=international`;
- неизвестный profile падает в production doctor;
- РФ-тарифы остаются в RUB;
- ProofFleet international-тарифы отображаются в USD/EUR;
- international vehicle identifier не требует российского формата;
- РФ vehicle behavior не сломан;
- РФ production env не содержит `ProofFleet.com`;
- ProofFleet production env не содержит `auditavto.ru`, кроме явно разрешённых исторических/документационных ссылок.

---

## Acceptance criteria

Задача считается выполненной, если:

1. Текущий РФ-контур сохраняет прежнее поведение.
2. International profile включается только явной настройкой.
3. Есть единая точка чтения market profile.
4. Есть единая точка чтения brand profile.
5. `ProofFleet.com` используется как international public domain.
6. `api.ProofFleet.com` используется как international API domain.
7. Публичные тексты можно разделять по профилю.
8. Legal footer может вести на разные документы для РФ и ProofFleet.
9. Тарифы и currency не смешиваются.
10. Vehicle identifier для international не требует российского формата.
11. Production doctor проверяет profile-sensitive env.
12. Документация обновлена.
13. `npm run verify:launch` проходит или все blockers честно зафиксированы.
14. В `CHANGELOG.md` есть запись о разделении AuditAvto RF / ProofFleet International.
15. В daily docs есть запись о выполненных изменениях и технических решениях.

---

## Важные запреты

Не делать:

- не создавать новый backend с нуля;
- не добавлять CMS;
- не смешивать РФ и international данные;
- не переносить текущий production на ProofFleet.com;
- не менять `auditavto.ru` без отдельного задания;
- не удалять РФ legal documents;
- не заменять все русские тексты английскими напрямую;
- не ломать mobile-only inspection contract;
- не включать публичную регистрацию по умолчанию;
- не хранить production secrets в Git;
- не использовать одну и ту же SQLite БД для РФ и ProofFleet;
- не использовать один и тот же uploads/backups каталог для РФ и ProofFleet.

---

## Ожидаемый результат

После выполнения должен появиться фундамент для двухконтурного запуска:

```txt
RF deployment:
APP_MARKET_PROFILE=rf
brand=AuditAvto
auditavto.ru
api.auditavto.ru
RUB
RU legal
RU landing

International deployment:
APP_MARKET_PROFILE=international
brand=ProofFleet
ProofFleet.com
api.ProofFleet.com
USD/EUR
EN legal
EN landing
independent server/database/uploads/backups
```

Кодовая база остаётся общей, но production-среды, данные, домены, legal, brand и billing-профили разделены.
