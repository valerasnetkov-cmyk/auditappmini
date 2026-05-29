# Изменения для отдельной панели администратора ресурса

## Контекст

Проект развивается как SaaS-ready система аудита автотранспортных средств. Панель администратора ресурса нужна не для операционной работы компаний, а для управления SaaS-уровнем: компаниями, владельцами, тарифами, лимитами, feature flags, запуском клиентов, монетизацией и техническим состоянием сервиса.

Текущая страница `/saas-admin` уже содержит базовые агрегаты: компании, активные компании, техника, осмотры, ДТП, MRR, ARR, ARPA, платные компании, контроль запуска, активность за 30 дней, сводку компаний, распределение по тарифам и выручку по тарифам.

Нужно расширить страницу до полноценного операционного центра владельца SaaS.

---

## Цель изменений

Сделать отдельную панель администратора ресурса, которая помогает:

1. Понимать, какие компании реально используют продукт.
2. Видеть проблемы запуска новых компаний.
3. Контролировать лимиты, тарифы и feature flags.
4. Находить компании-кандидаты на апсейл.
5. Контролировать качество данных и SaaS-health.
6. Видеть нагрузку на фото, хранилище и OCR.
7. Раньше замечать churn-risk и технические проблемы.

---

## Основная идея интерфейса

Панель должна быть не просто набором графиков, а рабочим экраном ресурсного администратора.

Главный принцип:

```txt
Статистика → Проблема → Действие
```

Каждая важная метрика должна отвечать на вопрос:

```txt
Что происходит?
Почему это важно?
Что администратор должен сделать дальше?
```

---

## Рекомендуемая структура страницы

```txt
/saas-admin
├── Header / Resource Operations
├── KPI Strip
├── Activation & Health
├── Revenue & Plans
├── Usage & Limits
├── Product Activity
├── OCR & Photo Storage
├── Risk Center
└── Companies Table
```

---

# 1. Верхняя KPI-панель

## Добавить KPI

### Бизнес-метрики

- `MRR` — месячная recurring-выручка.
- `ARR` — годовая recurring-выручка.
- `ARPA` — средняя выручка на активную компанию.
- `Paid companies` — платные компании.
- `Trial / Free companies` — бесплатные или тестовые компании.
- `Potential MRR` — потенциальная выручка от активных бесплатных компаний.
- `Activation rate` — доля компаний, дошедших до первого осмотра.
- `Churn risk companies` — компании с риском ухода.

### Продуктовые метрики

- `Active companies 7d` — активные компании за 7 дней.
- `Active companies 30d` — активные компании за 30 дней.
- `Inspections 7d` — осмотры за 7 дней.
- `Inspections 30d` — осмотры за 30 дней.
- `Avg inspections / active company` — среднее число осмотров на активную компанию.
- `Completion rate` — доля завершённых осмотров.
- `Open defects` — открытые дефекты.
- `Accident inspections` — ДТП-осмотры.

### Health-метрики

- `Companies without owner` — компании без владельца.
- `Companies without limits` — компании без лимитов.
- `Companies without plan` — компании без тарифа.
- `Orphan records` — записи без `company_id`.
- `Unfinished inspections` — незавершённые осмотры.
- `Storage used` — объём хранилища фото.

---

# 2. Activation Funnel

## Назначение

Показывает, где компания застревает после создания.

## Воронка

```txt
Компания создана
→ Владелец назначен
→ Владелец вошёл
→ Добавлена техника
→ Первый осмотр
→ 5+ осмотров
→ Активна 30 дней
```

## Метрики

```ts
activationFunnel: {
  companiesCreated: number;
  ownerAssigned: number;
  ownerLoggedIn: number;
  vehicleAdded: number;
  firstInspectionCreated: number;
  fiveInspectionsReached: number;
  active30d: number;
}
```

## График

Тип: horizontal funnel или stepped progress chart.

## Польза

Если много компаний создано, но мало дошло до первого осмотра — проблема не в продажах, а в onboarding.

---

# 3. Health Center

## Назначение

Показывает проблемы, которые мешают запуску, оплате или корректной работе компаний.

## Проверки

### Company health

- Компания без владельца.
- Компания без тарифа.
- Компания без лимитов.
- Компания без активных пользователей.
- Компания без техники.
- Компания с техникой, но без осмотров.
- Компания без активности более 14 дней.

### Data health

- Техника без `company_id`.
- Осмотры без `company_id`.
- Дефекты без `company_id`.
- Фото без `company_id`.
- Пользователи без роли.
- Дубли номеров техники внутри одной компании.
- Осмотры без обязательных фото.
- Дефекты без фото.
- ДТП-осмотры без места или времени ДТП.

### System health

- Ошибки загрузки фото.
- Ошибки WebP-конвертации.
- Ошибки OCR.
- Ошибки `403` по feature flags.
- Ошибки `409` по лимитам.
- Последний backup.
- Readiness status.

## Формат отображения

Не график, а список action-карточек:

```txt
3 компании без владельца
Действие: назначить владельца / выдать setup-ссылку

1 компания без лимитов
Действие: синхронизировать лимиты

7 незавершённых осмотров старше 24 часов
Действие: открыть список
```

## Структура данных

```ts
healthCenter: {
  companiesWithoutOwner: number;
  companiesWithoutOwnerList: CompanyHealthItem[];
  companiesWithoutLimits: number;
  companiesWithoutLimitsList: CompanyHealthItem[];
  companiesWithoutPlan: number;
  inactiveCompanies14d: number;
  orphanRecords: {
    vehicles: number;
    inspections: number;
    defects: number;
    photos: number;
    users: number;
  };
  unfinishedInspectionsOlderThan24h: number;
  defectsWithoutPhotos: number;
  accidentInspectionsWithoutRequiredData: number;
}
```

---

# 4. Revenue & Plans

## KPI

- MRR.
- ARR.
- ARPA.
- Paid companies.
- Free companies.
- Trial companies.
- Trial → Paid conversion.
- MRR по тарифам.
- Potential MRR.
- Expansion candidates.
- Churned MRR, если появится история оплат.

## Графики

### MRR trend

Линейный график по месяцам.

```ts
revenueTrend: Array<{
  month: string;
  mrr: number;
  arr: number;
  paidCompanies: number;
}>;
```

### MRR by plan

Bar chart.

```ts
mrrByPlan: Array<{
  planCode: string;
  planName: string;
  companies: number;
  mrr: number;
}>;
```

### Companies by plan

Donut chart.

```ts
companiesByPlan: Array<{
  planCode: string;
  planName: string;
  companies: number;
}>;
```

## Дополнительный блок

### Potential MRR

Считать по активным бесплатным компаниям:

```txt
Активная бесплатная компания = есть осмотры за последние 30 дней
```

```ts
potentialMrr = activeFreeCompanies * recommendedPlanPrice
```

---

# 5. Usage & Limits

## Назначение

Показывает, какие компании близки к лимитам и готовы к переходу на более высокий тариф.

## KPI

- Компании с использованием техники >80%.
- Компании с использованием пользователей >80%.
- Компании с отключённым OCR.
- Компании с отключённым ДТП-модулем.
- Компании с отключённой аналитикой.
- Количество блокировок по лимитам.
- Количество блокировок по feature flags.

## Heatmap

```txt
Компания | Тариф | Техника | Пользователи | OCR | ДТП | Аналитика | Риск
```

## Цветовая логика

```txt
0–60%    → нормальное использование
60–80%   → внимание
80–100%  → кандидат на апсейл
100%+    → лимит достигнут
```

## Структура данных

```ts
limitUsage: Array<{
  companyId: string;
  companyName: string;
  planCode: string;
  vehiclesUsed: number;
  vehiclesLimit: number | null;
  vehiclesUsagePercent: number | null;
  usersUsed: number;
  usersLimit: number | null;
  usersUsagePercent: number | null;
  ocrEnabled: boolean;
  accidentModuleEnabled: boolean;
  analyticsEnabled: boolean;
  riskLevel: 'ok' | 'watch' | 'upsell' | 'blocked';
}>;
```

---

# 6. Product Activity

## KPI

- Осмотров за 24 часа.
- Осмотров за 7 дней.
- Осмотров за 30 дней.
- Быстрые осмотры.
- Плановые осмотры.
- ДТП-осмотры.
- Завершённые осмотры.
- Незавершённые осмотры.
- Среднее фото на осмотр.
- Среднее дефектов на 100 осмотров.
- Активные инспекторы.

## Графики

### Activity 30 days

Line chart:

```txt
Осмотры / Дефекты / ДТП / Фото
```

### Inspection types by day

Stacked bar:

```txt
Дата | Быстрый | Плановый | ДТП
```

### Company workload

Horizontal bar chart:

```txt
Компания | Техника | Осмотры | Дефекты
```

## Структура данных

```ts
activitySeries30d: Array<{
  date: string;
  inspections: number;
  defects: number;
  accidents: number;
  photos: number;
}>;

inspectionTypesSeries: Array<{
  date: string;
  quick: number;
  planned: number;
  accident: number;
}>;
```

---

# 7. OCR Analytics

## Назначение

Показывает использование и качество распознавания номера и одометра.

## KPI

- OCR попыток номера.
- OCR успешных распознаваний номера.
- OCR success rate номера.
- Ручные исправления номера.
- OCR попыток одометра.
- OCR успешных распознаваний одометра.
- OCR success rate одометра.
- Средний confidence.
- Ошибки OCR.
- Компании с отключённым OCR.

## Графики

### OCR success rate

Line chart по дням.

### OCR usage by company

Horizontal bar chart.

### Manual vs OCR

Donut или stacked bar:

```txt
Ручной ввод / OCR подтверждён / OCR исправлен
```

## Структура данных

```ts
ocrStats: {
  plateAttempts: number;
  plateSuccess: number;
  plateSuccessRate: number;
  plateManualCorrections: number;
  odometerAttempts: number;
  odometerSuccess: number;
  odometerSuccessRate: number;
  avgConfidence: number | null;
  errors: number;
};
```

---

# 8. Photo & Storage Analytics

## Назначение

Фото — ключевая доказательная база продукта и потенциальная статья расходов. Нужно видеть рост хранилища и проблемы загрузок.

## KPI

- Всего фото.
- Фото за 30 дней.
- Размер хранилища.
- Средний размер оригинала.
- Средний размер WebP.
- Экономия после WebP.
- Ошибки загрузки фото.
- Ошибки генерации WebP.
- Топ компаний по объёму фото.
- Прогноз роста хранилища.

## Графики

### Storage growth

Line chart:

```txt
Дата | Размер хранилища
```

### Photos by type

Donut chart:

```txt
Осмотр / Дефект / ДТП / Одометр
```

### Top companies by storage

Horizontal bar chart.

## Структура данных

```ts
storageStats: {
  totalPhotos: number;
  photos30d: number;
  totalStorageBytes: number;
  avgOriginalSizeBytes: number;
  avgWebpSizeBytes: number;
  estimatedSavedBytes: number;
  uploadErrors: number;
  webpErrors: number;
};

storageByCompany: Array<{
  companyId: string;
  companyName: string;
  photos: number;
  storageBytes: number;
}>;
```

---

# 9. Risk Center

## Назначение

Показывает компании, которые могут уйти, застряли в запуске или требуют внимания.

## Churn-risk критерии

Компания попадает в риск, если выполняется одно или несколько условий:

- Нет активности 14 дней.
- Активность упала более чем на 50% относительно предыдущего периода.
- Есть техника, но нет осмотров.
- Владелец ни разу не вошёл.
- Компания достигла лимита и не перешла на тариф выше.
- Много ошибок загрузки фото/OCR.
- Много незавершённых осмотров.

## Таблица

```txt
Компания | Тариф | Последняя активность | Осмотры 30д | Изменение | Риск | Рекомендуемое действие
```

## Структура данных

```ts
riskCompanies: Array<{
  companyId: string;
  companyName: string;
  planCode: string;
  lastActivityAt: string | null;
  inspections30d: number;
  previousInspections30d: number;
  activityDropPercent: number | null;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  recommendedAction: string;
}>;
```

---

# 10. Upsell Candidates

## Назначение

Показывает компании, которым можно предложить платный тариф или расширение.

## Критерии апсейла

Компания считается кандидатом, если:

- Использует более 70% лимита техники.
- Использует более 70% лимита пользователей.
- Имеет 30+ осмотров за 30 дней.
- Активно использует ДТП-модуль.
- Активно использует OCR.
- Часто получает блокировку `409` по лимитам.
- Пользуется сервисом регулярно, но находится на бесплатном тарифе.

## Таблица

```txt
Компания | Тариф | Причина | Использование | Потенциальный тариф | Потенциальный MRR | Действие
```

## Структура данных

```ts
upsellCandidates: Array<{
  companyId: string;
  companyName: string;
  currentPlanCode: string;
  recommendedPlanCode: string;
  reason: string;
  potentialMrr: number;
  vehiclesUsagePercent: number | null;
  usersUsagePercent: number | null;
  inspections30d: number;
}>;
```

---

# 11. Companies Table

## Назначение

Главная рабочая таблица администратора ресурса.

## Колонки

```txt
Компания
Статус
Тариф
MRR
Владелец
Пользователи
Техника / лимит
Осмотры 30д
Дефекты
ДТП
OCR
Аналитика
Последняя активность
Health
Risk
Действие
```

## Действия

- Открыть карточку компании.
- Назначить владельца.
- Выдать setup-ссылку владельцу.
- Синхронизировать лимиты.
- Изменить тариф.
- Включить/выключить OCR.
- Включить/выключить ДТП-модуль.
- Включить/выключить аналитику.
- Открыть usage.
- Открыть health компании.
- Пометить как пилот/платная/заморожена.

## Фильтры

- Поиск по компании.
- Тариф.
- Статус.
- Есть владелец / нет владельца.
- Есть лимиты / нет лимитов.
- Активные / неактивные.
- Churn-risk.
- Upsell candidates.
- Лимит техники >80%.
- Лимит пользователей >80%.

---

# Backend: расширение `/api/admin/saas/stats`

## Текущий endpoint

```txt
GET /api/admin/saas/stats
```

Endpoint остаётся admin-only.

## Рекомендуемая структура ответа

```ts
export type AdminSaasStatsResponse = {
  generatedAt: string;

  totals: {
    companies: number;
    activeCompanies7d: number;
    activeCompanies30d: number;
    paidCompanies: number;
    freeCompanies: number;
    trialCompanies: number;
    users: number;
    owners: number;
    managers: number;
    inspectors: number;
    vehicles: number;
    inspections: number;
    defects: number;
    accidents: number;
    photos: number;
  };

  revenue: {
    mrr: number;
    arr: number;
    arpa: number;
    potentialMrr: number;
    trialToPaidConversionRate: number | null;
    byPlan: Array<{
      planCode: string;
      planName: string;
      companies: number;
      mrr: number;
    }>;
    trend: Array<{
      month: string;
      mrr: number;
      arr: number;
      paidCompanies: number;
    }>;
  };

  activation: {
    activationRate: number | null;
    funnel: {
      companiesCreated: number;
      ownerAssigned: number;
      ownerLoggedIn: number;
      vehicleAdded: number;
      firstInspectionCreated: number;
      fiveInspectionsReached: number;
      active30d: number;
    };
  };

  activity: {
    series30d: Array<{
      date: string;
      inspections: number;
      defects: number;
      accidents: number;
      photos: number;
    }>;
    inspectionTypesSeries30d: Array<{
      date: string;
      quick: number;
      planned: number;
      accident: number;
    }>;
    companyWorkload: Array<{
      companyId: string;
      companyName: string;
      vehicles: number;
      inspections: number;
      defects: number;
      accidents: number;
    }>;
  };

  limits: {
    companiesNearVehicleLimit: number;
    companiesNearUserLimit: number;
    featureFlagBlocks: number;
    resourceLimitBlocks: number;
    usage: Array<{
      companyId: string;
      companyName: string;
      planCode: string;
      vehiclesUsed: number;
      vehiclesLimit: number | null;
      vehiclesUsagePercent: number | null;
      usersUsed: number;
      usersLimit: number | null;
      usersUsagePercent: number | null;
      ocrEnabled: boolean;
      accidentModuleEnabled: boolean;
      analyticsEnabled: boolean;
      riskLevel: 'ok' | 'watch' | 'upsell' | 'blocked';
    }>;
  };

  health: {
    companiesWithoutOwner: number;
    companiesWithoutLimits: number;
    companiesWithoutPlan: number;
    inactiveCompanies14d: number;
    orphanRecords: {
      vehicles: number;
      inspections: number;
      defects: number;
      photos: number;
      users: number;
    };
    unfinishedInspectionsOlderThan24h: number;
    defectsWithoutPhotos: number;
    accidentInspectionsWithoutRequiredData: number;
    items: Array<{
      severity: 'info' | 'warning' | 'critical';
      title: string;
      description: string;
      count: number;
      actionLabel: string;
      actionHref?: string;
    }>;
  };

  ocr: {
    plateAttempts: number;
    plateSuccess: number;
    plateSuccessRate: number | null;
    plateManualCorrections: number;
    odometerAttempts: number;
    odometerSuccess: number;
    odometerSuccessRate: number | null;
    avgConfidence: number | null;
    errors: number;
  };

  storage: {
    totalPhotos: number;
    photos30d: number;
    totalStorageBytes: number;
    avgOriginalSizeBytes: number | null;
    avgWebpSizeBytes: number | null;
    estimatedSavedBytes: number | null;
    uploadErrors: number;
    webpErrors: number;
    byCompany: Array<{
      companyId: string;
      companyName: string;
      photos: number;
      storageBytes: number;
    }>;
  };

  risks: {
    churnRiskCompanies: number;
    upsellCandidates: number;
    churn: Array<{
      companyId: string;
      companyName: string;
      planCode: string;
      lastActivityAt: string | null;
      inspections30d: number;
      previousInspections30d: number;
      activityDropPercent: number | null;
      riskLevel: 'low' | 'medium' | 'high';
      reasons: string[];
      recommendedAction: string;
    }>;
    upsell: Array<{
      companyId: string;
      companyName: string;
      currentPlanCode: string;
      recommendedPlanCode: string;
      reason: string;
      potentialMrr: number;
      vehiclesUsagePercent: number | null;
      usersUsagePercent: number | null;
      inspections30d: number;
    }>;
  };

  companies: Array<{
    companyId: string;
    companyName: string;
    status: string;
    planCode: string | null;
    mrr: number;
    ownerEmail: string | null;
    users: number;
    vehicles: number;
    vehiclesLimit: number | null;
    inspections30d: number;
    defects: number;
    accidents: number;
    ocrEnabled: boolean;
    analyticsEnabled: boolean;
    accidentModuleEnabled: boolean;
    lastActivityAt: string | null;
    healthStatus: 'ok' | 'warning' | 'critical';
    riskStatus: 'low' | 'medium' | 'high';
  }>;
};
```

---

# Frontend: структура компонентов

## Рекомендуемые компоненты

```txt
web/src/app/saas-admin/page.tsx
web/src/app/saas-admin/SaasAdminPage.tsx
web/src/app/saas-admin/components/KpiStrip.tsx
web/src/app/saas-admin/components/ActivationFunnel.tsx
web/src/app/saas-admin/components/HealthCenter.tsx
web/src/app/saas-admin/components/RevenueCharts.tsx
web/src/app/saas-admin/components/LimitUsageHeatmap.tsx
web/src/app/saas-admin/components/ProductActivityCharts.tsx
web/src/app/saas-admin/components/OcrAnalytics.tsx
web/src/app/saas-admin/components/StorageAnalytics.tsx
web/src/app/saas-admin/components/RiskCenter.tsx
web/src/app/saas-admin/components/CompaniesTable.tsx
web/src/app/saas-admin/saas-admin.css
```

## Важно по стилям

- Не использовать inline styles.
- Использовать существующие CSS tokens.
- Светлая тема должна быть основной.
- Поддержать тёмную тему через токены.
- Не перегружать экран цветами.
- Для критичных статусов использовать цвет только как дополнительный маркер, не единственный способ считывания.

---

# UI-направление

## Общий стиль

```txt
Светлая SaaS-панель в стиле Apple / Linear / Vercel.
Много воздуха, аккуратные карточки, сильная типографика, минимум декоративности.
```

## Визуальный принцип

- Верх — бизнес-состояние сервиса.
- Центр — активация, health и использование.
- Низ — таблица компаний с действиями.

## Цветовые акценты

```txt
Синий     → основная активность / осмотры / техника
Зелёный   → paid / healthy / growth
Жёлтый    → warning / near limit
Красный   → critical / blocked / churn-risk
Фиолетовый → тарифы / premium / expansion
```

## Карточки KPI

Каждая KPI-карточка должна иметь:

```txt
Label
Value
Delta / Context
Optional status
```

Пример:

```txt
Activation Rate
42%
+8% к прошлой неделе
```

---

# Порядок реализации

## Этап 1 — MVP панели

Добавить:

1. KPI strip.
2. Activation funnel.
3. Health Center.
4. Companies table с health/risk/status.
5. Limit usage summary.

## Этап 2 — Монетизация

Добавить:

1. Revenue trend.
2. MRR by plan.
3. Potential MRR.
4. Upsell candidates.
5. Trial/free → paid conversion.

## Этап 3 — Продуктовая аналитика

Добавить:

1. Activity by inspection type.
2. Company workload.
3. Completion rate.
4. Defects per 100 inspections.
5. Unfinished inspections.

## Этап 4 — Техническая аналитика

Добавить:

1. OCR analytics.
2. Photo/storage analytics.
3. Upload/WebP errors.
4. Readiness/backup status.
5. Security/audit events.

---

# Acceptance Criteria

## Backend

- `GET /api/admin/saas/stats` доступен только роли `admin`.
- `manager`, `owner`, `inspector` получают `403`.
- Все агрегаты считаются tenant-safe.
- Нет смешивания данных разных компаний.
- Все проверки health учитывают `company_id`.
- Пустые данные возвращаются как `0` или пустые массивы, а не ломают UI.
- Метрики корректно работают на MVP-данных, где MRR может быть `0`.

## Frontend

- `/saas-admin` доступен только роли `admin`.
- Есть понятное состояние загрузки.
- Есть понятное состояние ошибки.
- Есть empty state для отсутствия данных.
- Графики не ломаются при нулевых значениях.
- Таблица компаний фильтруется и сортируется.
- Health Center показывает действие для каждой проблемы.
- UI использует внешние CSS-файлы, без inline styles.
- Поддерживается светлая и тёмная тема.

## UX

- Администратор за 10 секунд понимает:
  - сколько компаний живые;
  - кто не запущен;
  - где проблемы;
  - кого можно продавать;
  - где риск ухода;
  - сколько растёт нагрузка.

---

# Приоритет для ближайшего спринта

Реализовать в первую очередь:

```txt
1. Activation Funnel
2. Health Center
3. Limit Usage Heatmap
4. Upsell Candidates
5. Companies Table 2.0
```

Причина: пока MRR равен 0 ₽, главная метрика — не выручка, а доказательство регулярного использования продукта компаниями.

---

# Короткий промт для Codex

```txt
Реализуй расширение страницы /saas-admin как отдельной панели администратора SaaS-ресурса.

Цель: превратить текущую страницу статистики в операционный центр владельца SaaS.

Добавь блоки:
1. KPI strip: MRR, ARR, ARPA, active companies 7d/30d, activation rate, churn risk, storage used.
2. Activation funnel: company created → owner assigned → owner logged in → vehicle added → first inspection → 5+ inspections → active 30d.
3. Health Center: companies without owner, without limits, without plan, inactive 14d, orphan records, unfinished inspections, defects without photos, accident inspections without required accident data.
4. Limit Usage Heatmap: vehicles/users usage percent, OCR, accident module, analytics, risk level.
5. Revenue & Plans: MRR by plan, companies by plan, potential MRR.
6. Product Activity: inspections/defects/accidents/photos over 30 days, inspection types by day, company workload.
7. OCR Analytics: plate/odometer attempts, success rate, manual corrections, errors.
8. Photo & Storage Analytics: total photos, storage bytes, avg original/WebP size, estimated saved bytes, top companies by storage.
9. Risk Center: churn-risk companies and upsell candidates.
10. Companies Table 2.0 with health, risk, limits, plan, owner and actions.

Backend:
- Extend GET /api/admin/saas/stats.
- Keep endpoint admin-only.
- Return safe empty values for missing data.
- Do not mix tenants.
- Calculate metrics using company_id boundaries.

Frontend:
- Use Chart.js/Recharts consistent with current project.
- Use existing CSS tokens and external CSS files.
- No inline styles.
- Support light/dark theme.
- Add loading, error and empty states.
- Keep design clean, light, SaaS-style, with strong hierarchy and clear actions.

Acceptance:
- Admin sees SaaS health, activation, monetization, usage limits and risks on one page.
- Non-admin roles cannot access the page or endpoint.
- Charts do not break with zero values.
- Health Center shows problem + recommended action.
```
