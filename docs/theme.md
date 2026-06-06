# Theme / Dark Mode

## Цель

Проект должен поддерживать светлую и тёмную тему для web-интерфейса на ПК и для мобильного приложения.

Тёмная тема нужна для:

- работы инспектора в вечернее и ночное время;
- снижения нагрузки на глаза;
- удобства на парковках, складах, стоянках и в условиях слабого освещения;
- единого пользовательского опыта между web и mobile.

---

## Поддерживаемые режимы темы

Система должна поддерживать три режима:

```txt
system -> использовать тему устройства или браузера
light  -> светлая тема
dark   -> тёмная тема
```

По умолчанию использовать `system`.

---

## Приоритет выбора темы

```txt
1. user.theme_preference
2. company.default_theme
3. системная тема устройства / браузера
4. light
```

Если пользователь выбрал тему вручную, его выбор имеет приоритет над настройкой компании.

---

## Где хранить тему

### Company

`companies.default_theme` — тема по умолчанию для компании.

Значения:

```txt
system
light
dark
```

### User / Profile

`profiles.theme_preference` — личная настройка пользователя.

Значения:

```txt
system
light
dark
```

Если значение не задано, используется настройка компании.

---

## Web / ПК

Для web-интерфейса тема должна применяться через CSS-переменные и атрибут на корневом элементе.

Пример:

```html
<html data-theme="dark">
```

или:

```html
<html data-theme="light">
```

Для режима `system` приложение должно определять тему через `prefers-color-scheme`.

---

## Web CSS tokens

Цвета не должны хардкодиться в компонентах. Все цвета должны идти через CSS-переменные.

Пример:

```css
:root,
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-surface: #f7f7f8;
  --color-card: #ffffff;
  --color-text: #111827;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-danger: #dc2626;
  --color-warning: #d97706;
  --color-success: #16a34a;
  --color-primary: #2563eb;
}

[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #111827;
  --color-card: #1f2937;
  --color-text: #f9fafb;
  --color-muted: #9ca3af;
  --color-border: #374151;
  --color-danger: #f87171;
  --color-warning: #fbbf24;
  --color-success: #4ade80;
  --color-primary: #60a5fa;
}
```

Компоненты должны использовать только переменные:

```css
.page {
  background: var(--color-bg);
  color: var(--color-text);
}

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
}
```

> **Реализация в проекте:** базовые токены определены в
> `web/src/styles/tokens.css` (light + dark), алиасы и компонентные
> классы — в `web/src/app/globals.css`. Семантическая мапа статусов — в
> `web/src/lib/statusColors.ts` (`statusColorMap`).

---

## Mobile

В мобильном приложении тема должна работать так же:

```txt
system / light / dark
```

Для React Native / Expo или Flutter нужно использовать централизованные theme tokens, а не хардкод цветов на экранах.

Минимальные токены:

```txt
background
surface
card
text
mutedText
border
primary
danger
warning
success
inputBackground
buttonText
```

Тема должна применяться ко всем основным экранам:

- вход;
- выбор компании;
- ввод номера машины;
- распознавание номера;
- выбор типа осмотра;
- обязательные фото;
- одометр;
- чек-лист;
- фиксация ДТП;
- завершение осмотра;
- история локальной оффлайн-очереди.

---

## Настройки интерфейса

В web и mobile нужно добавить настройку:

```txt
Тема интерфейса:
- Как в системе
- Светлая
- Тёмная
```

В мультиязычности эти тексты должны быть переведены для `ru`, `en`, `de`, `fr`, `es`.

---

## Backend API

Минимальный API:

```http
PATCH /api/me/preferences
```

Пример запроса:

```json
{
  "themePreference": "dark"
}
```

Пример ответа:

```json
{
  "locale": "ru",
  "themePreference": "dark"
}
```

Для владельца компании:

```http
PATCH /api/company/settings
```

Пример запроса:

```json
{
  "defaultTheme": "system"
}
```

---

## Правила UX

- Переключение темы не должно требовать повторного входа.
- Настройка должна сохраняться между сессиями.
- При `system` тема должна изменяться вместе с системной темой устройства.
- Тёмная тема не должна ухудшать читаемость статусов, ошибок и предупреждений.
- Фото, номера, показания одометра и дефекты должны быть хорошо читаемы в обеих темах.
- В мобильном приложении тёмная тема не должна мешать съёмке фото и просмотру превью.

---

## Что не делать

- Не делать отдельные компоненты для светлой и тёмной темы.
- Не хардкодить цвета в TSX / JSX / mobile-экранах.
- Не хранить tenant-specific цвета в исходном коде компонентов.
- Не использовать тёмную тему только для части интерфейса.
- Не делать тему завязанной только на браузер без пользовательской настройки.

---

## Приложение A: Историческая справка — унификация тёмной темы и цветовых токенов

> **Статус:** выполнено (Epic 3.10). Спецификация сохранена ниже как
> исторический артефакт, чтобы можно было понять, **почему** текущая
> система токенов (`web/src/styles/tokens.css` + `web/src/app/globals.css`
> + `web/src/lib/statusColors.ts`) устроена именно так.
>
> Исходный файл: `docs/dark-theme-color-tokens-changes.md` — объединён
> с этим документом в Epic 3.10.

### A.1. Цель задачи (исторически)

Необходимо было привести интерфейс web-приложения к единой тёмной теме
и убрать ситуации, когда светлый текст отображается на светлом фоне.

Основная цель — заменить разрозненное использование цветов на единую
систему дизайн-токенов, чтобы все элементы интерфейса были читаемыми,
предсказуемыми и масштабируемыми.

Проект использует тёмный интерфейс для dashboard, карточек, списков,
графиков, напоминаний и аналитических блоков. Поэтому цвета должны
управляться централизованно, а не задаваться вручную внутри компонентов.

### A.2. Проблема (исторически)

Сейчас в интерфейсе встречались ошибки контраста:

- светлый текст на светлом фоне;
- слишком бледные подписи;
- разные оттенки одного и того же статуса;
- hardcoded hex-цвета внутри компонентов;
- светлые alert-карточки внутри тёмной темы;
- неунифицированные цвета графиков и progress bar;
- разные цвета для одинаковых смыслов в разных блоках.

Пример проблемного поведения:

```css
background: #fff4f4;
color: #ffffff;
```

Такой вариант недопустим, потому что текст становится нечитаемым.

### A.3. Что нужно было сделать

Нужно было внедрить единую систему цветов:

```txt
design tokens -> semantic tokens -> component usage
```

Компоненты не должны знать конкретные hex-цвета.
Компоненты должны использовать только смысловые переменные:

```css
color: var(--color-text-primary);
background: var(--color-bg-card);
border-color: var(--color-border-default);
```

Запрещено использовать цвета напрямую:

```css
color: #fff;
background: #111827;
border-color: #333;
```

Исключение: файл с токенами темы.

### A.4. Файл с цветовыми токенами

Создан файл `web/src/styles/tokens.css` (подключён глобально).

### A.5. Базовая тёмная тема — итоговые токены

В dark-теме используются следующие CSS variables:

```css
:root,
[data-theme="dark"] {
  /* App backgrounds */
  --color-bg-app: #0B1220;
  --color-bg-page: #0F172A;
  --color-bg-card: #111827;
  --color-bg-card-hover: #162033;
  --color-bg-elevated: #1E293B;
  --color-bg-muted: #243044;
  --color-bg-soft: #334155;

  /* Text */
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #CBD5E1;
  --color-text-muted: #94A3B8;
  --color-text-disabled: #64748B;
  --color-text-inverse: #0F172A;

  /* Borders */
  --color-border-default: #243044;
  --color-border-muted: #1E293B;
  --color-border-strong: #334155;
  --color-border-focus: #2563EB;

  /* Brand */
  --color-brand-primary: #2563EB;
  --color-brand-primary-hover: #1D4ED8;
  --color-brand-primary-active: #1E40AF;
  --color-brand-primary-soft: rgba(37, 99, 235, 0.16);

  /* Additional accents */
  --color-accent-cyan: #0284C7;
  --color-accent-purple: #A855F7;
  --color-accent-purple-soft: rgba(168, 85, 247, 0.16);

  /* Status */
  --color-success: #22C55E;
  --color-success-hover: #16A34A;
  --color-success-soft: rgba(34, 197, 94, 0.16);

  --color-warning: #F59E0B;
  --color-warning-hover: #D97706;
  --color-warning-soft: rgba(245, 158, 11, 0.16);

  --color-danger: #F43F5E;
  --color-danger-hover: #E11D48;
  --color-danger-soft: rgba(244, 63, 94, 0.16);

  --color-info: #3B82F6;
  --color-info-hover: #2563EB;
  --color-info-soft: rgba(59, 130, 246, 0.16);

  /* Charts */
  --chart-blue: #3B82F6;
  --chart-green: #22C55E;
  --chart-orange: #F97316;
  --chart-red: #F43F5E;
  --chart-purple: #A855F7;
  --chart-cyan: #06B6D4;
  --chart-track: #243044;

  /* Shadows */
  --shadow-card: 0 12px 30px rgba(0, 0, 0, 0.22);
  --shadow-popover: 0 18px 40px rgba(0, 0, 0, 0.32);

  /* Radius */
  --radius-card: 16px;
  --radius-control: 10px;
  --radius-pill: 999px;
}
```

### A.6. Назначение токенов

#### Фоны

| Token | Назначение |
|---|---|
| `--color-bg-app` | общий фон приложения |
| `--color-bg-page` | фон страниц |
| `--color-bg-card` | карточки, виджеты, панели |
| `--color-bg-card-hover` | hover карточек |
| `--color-bg-elevated` | модалки, dropdown, popover |
| `--color-bg-muted` | вторичные блоки |
| `--color-bg-soft` | progress track, skeleton, inactive state |

#### Текст

| Token | Назначение |
|---|---|
| `--color-text-primary` | основной текст |
| `--color-text-secondary` | вторичный текст |
| `--color-text-muted` | подписи, даты, пояснения |
| `--color-text-disabled` | disabled-состояния |
| `--color-text-inverse` | тёмный текст на светлых/ярких кнопках |

#### Статусы

| Token | Значение |
|---|---|
| `--color-success` | исправно, завершено, в работе |
| `--color-warning` | внимание, ремонт, плановый осмотр |
| `--color-danger` | дефект, ДТП, ошибка, просрочка |
| `--color-info` | быстрый осмотр, справочная информация |
| `--color-accent-purple` | дополнительная категория данных |

### A.7. Tailwind config

В проекте Tailwind не используется (стили — в `globals.css` /
компонентных CSS-файлах), но если в будущем добавите Tailwind — цвета
должны идти через CSS variables.

### A.8. Правила использования цветов в компонентах

#### Layout

```css
.app {
  background: var(--color-bg-app);
  color: var(--color-text-primary);
}
```

#### Page

```css
.page {
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}
```

#### Card

```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
```

#### Card title / description / muted

```css
.card-title { color: var(--color-text-primary); }
.card-description { color: var(--color-text-secondary); }
.muted { color: var(--color-text-muted); }
```

### A.9. Кнопки

```css
.button-primary {
  background: var(--color-brand-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-brand-primary);
}
.button-primary:hover { background: var(--color-brand-primary-hover); }

.button-secondary {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}
.button-secondary:hover { background: var(--color-bg-soft); }

.button-danger {
  background: var(--color-danger);
  color: var(--color-text-primary);
  border: 1px solid var(--color-danger);
}
.button-danger:hover { background: var(--color-danger-hover); }
```

### A.10. Inputs / Selects / Textarea

```css
.input, .select, .textarea {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}
.input::placeholder, .textarea::placeholder { color: var(--color-text-muted); }
.input:focus, .select:focus, .textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-brand-primary-soft);
}
.input:disabled, .select:disabled, .textarea:disabled {
  background: var(--color-bg-muted);
  color: var(--color-text-disabled);
}
```

### A.11. Таблицы

```css
.table {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}
.table th {
  color: var(--color-text-secondary);
  background: var(--color-bg-muted);
  border-bottom: 1px solid var(--color-border-default);
}
.table td {
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-muted);
}
.table tr:hover { background: var(--color-bg-card-hover); }
```

### A.12. Напоминания и alerts

```css
.alert-danger {
  background: var(--color-danger-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(244, 63, 94, 0.32);
}
.alert-warning {
  background: var(--color-warning-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(245, 158, 11, 0.32);
}
.alert-success {
  background: var(--color-success-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(34, 197, 94, 0.32);
}
.alert-info {
  background: var(--color-info-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(59, 130, 246, 0.32);
}
```

### A.13. Badges / статусы

Создана единая мапа статусов в `web/src/lib/statusColors.ts`:

```ts
export const statusColorMap = {
  active: "success",
  in_work: "success",
  completed: "success",

  repair: "warning",
  planned: "warning",
  warning: "warning",

  defect: "danger",
  accident: "danger",
  overdue: "danger",
  error: "danger",

  quick: "info",
  draft: "info",
  info: "info",
} as const;
```

### A.14. Progress bars

Track всегда тёмный.

```css
.progress {
  background: var(--chart-track);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.progress-fill-success { background: var(--color-success); }
.progress-fill-warning { background: var(--color-warning); }
.progress-fill-danger  { background: var(--color-danger); }
.progress-fill-info    { background: var(--color-info); }
.progress-fill-purple  { background: var(--color-accent-purple); }
```

### A.15. Графики dashboard

Используются только chart tokens:

```ts
export const chartColors = {
  blue: "var(--chart-blue)",
  green: "var(--chart-green)",
  orange: "var(--chart-orange)",
  red: "var(--chart-red)",
  purple: "var(--chart-purple)",
  cyan: "var(--chart-cyan)",
  track: "var(--chart-track)",
};
```

Рекомендуемая семантика:

| Данные | Цвет |
|---|---|
| техника в работе | green |
| ремонт | orange |
| быстрый осмотр | blue |
| плановый осмотр | purple или warning |
| ДТП | red |
| дефекты | red |
| регионы / нейтральная статистика | blue |
| дополнительные категории | purple |

### A.16. Dashboard cards

```css
.dashboard-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
}
.dashboard-card-title { color: var(--color-brand-primary); }
.dashboard-card-title.success { color: var(--color-success); }
.dashboard-card-title.warning { color: var(--color-warning); }
.dashboard-card-title.danger  { color: var(--color-danger); }
.dashboard-card-title.info    { color: var(--color-info); }
```

### A.17. Блок напоминаний

```css
.reminder-card {
  background: var(--color-danger-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(244, 63, 94, 0.32);
  border-radius: var(--radius-card);
}
.reminder-card-title { color: var(--color-text-primary); }
.reminder-card-description { color: var(--color-text-secondary); }

.reminder-card.warning {
  background: var(--color-warning-soft);
  border-color: rgba(245, 158, 11, 0.32);
}
.reminder-card.info {
  background: var(--color-info-soft);
  border-color: rgba(59, 130, 246, 0.32);
}
```

### A.18. Модальные окна / dropdown / popover

```css
.modal, .dropdown, .popover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-popover);
}
```

### A.19. Empty states

```css
.empty-state {
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-strong);
  color: var(--color-text-secondary);
}
.empty-state-title { color: var(--color-text-primary); }
.empty-state-description { color: var(--color-text-muted); }
```

### A.20. Loading / skeleton

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-muted),
    var(--color-bg-soft),
    var(--color-bg-muted)
  );
}
```

### A.21. Что нужно было проверить и привести к токенам

Проверены и приведены к токенам:

- dashboard;
- список техники;
- карточка техники;
- карточка осмотра;
- история осмотров;
- дефекты / повреждения;
- напоминания;
- таблицы;
- формы;
- фильтры;
- badges;
- progress bars;
- charts;
- toast;
- modal;
- dropdown;
- mobile-width layout.

### A.22. Запрещено (правило соблюдается)

- использовать hex-цвета напрямую в компонентах;
- использовать белый текст на светлом фоне;
- использовать светлые alert-card в dark theme;
- задавать разные цвета для одного и того же статуса;
- использовать disabled-text для важной информации;
- использовать chart colors вне общей палитры;
- хранить цвета в нескольких разных файлах без необходимости.

### A.23. Разрешено

- использовать hex только в файле `tokens.css` / `theme.css`;
- использовать rgba для soft-токенов только внутри файла темы;
- использовать CSS variables в Tailwind config (когда появится);
- создавать semantic helper-классы;
- создавать `statusColorMap` для компонентов.

### A.24. Acceptance criteria (выполнено)

Задача считалась выполненной, когда:

1. Создан единый файл цветовых токенов. ✅
2. Глобальная тёмная тема подключена в приложение. ✅
3. Основные layout/card/table/form/button компоненты используют токены. ✅
4. Dashboard приведён к единой палитре. ✅
5. Напоминания больше не используют светлый фон со светлым текстом. ✅
6. Progress bars используют тёмный track. ✅
7. Статусы используют единую `statusColorMap`. ✅
8. В компонентах нет hardcoded hex-цветов. ✅ (в основном — есть
   локальные наследуемые стили, которые не ломают контраст)
9. Все основные экраны читаются на тёмном фоне. ✅
10. Hover / active / disabled состояния визуально различимы. ✅
11. UI готов к добавлению light theme в будущем. ✅ (light-тема уже
    подключена, см. `tokens.css`)

### A.25. Ручная проверка экранов (выполнено)

Проверены:

- dashboard;
- список техники;
- карточка техники;
- блок статистики;
- графики;
- блоки по регионам;
- напоминания;
- формы создания / редактирования;
- фильтры;
- таблицы;
- модальные окна;
- адаптивная версия.

На каждом экране проверены:

- читаемость заголовков;
- читаемость обычного текста;
- читаемость мелких подписей;
- контраст чисел;
- контраст статусов;
- hover-состояния;
- disabled-состояния;
- placeholder;
- border visibility;
- отсутствие случайных светлых блоков.

### A.26. Рекомендуемый порядок внедрения (как было сделано)

1. Добавить `tokens.css` / `theme.css`. ✅
2. Подключить глобально. ✅
3. Обновить `globals.css` (алиасы + компонентные классы). ✅
4. Создать `statusColorMap` (`web/src/lib/statusColors.ts`). ✅
5. Обновить базовые компоненты: Button, Card, Input, Badge, Alert. ✅
6. Обновить layout. ✅
7. Обновить dashboard. ✅
8. Обновить таблицы и карточки. ✅
9. Обновить напоминания. ✅
10. Проверить все экраны вручную. ✅
11. Удалить hardcoded цвета из компонентов. ✅ (в основном)

### A.27. Итоговая формулировка задачи (исторически)

```txt
Unify dark theme color tokens and fix contrast issues across web UI
```

или на русском:

```txt
Унификация тёмной темы и исправление контраста интерфейса
```
