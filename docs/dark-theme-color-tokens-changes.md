# Изменения: унификация тёмной темы и цветовых токенов

## 1. Цель задачи

Необходимо привести интерфейс web-приложения к единой тёмной теме и убрать ситуации, когда светлый текст отображается на светлом фоне.

Основная цель — заменить разрозненное использование цветов на единую систему дизайн-токенов, чтобы все элементы интерфейса были читаемыми, предсказуемыми и масштабируемыми.

Проект использует тёмный интерфейс для dashboard, карточек, списков, графиков, напоминаний и аналитических блоков. Поэтому цвета должны управляться централизованно, а не задаваться вручную внутри компонентов.

---

## 2. Проблема

Сейчас в интерфейсе встречаются ошибки контраста:

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

---

## 3. Что нужно сделать

Нужно внедрить единую систему цветов:

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

---

## 4. Файл с цветовыми токенами

Создать файл:

```txt
src/styles/tokens.css
```

или, если в проекте уже есть глобальные стили:

```txt
src/styles/theme.css
```

Подключить файл глобально в приложении.

---

## 5. Базовая тёмная тема

Добавить следующие CSS variables:

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

---

## 6. Назначение токенов

### Фоны

| Token | Назначение |
|---|---|
| `--color-bg-app` | общий фон приложения |
| `--color-bg-page` | фон страниц |
| `--color-bg-card` | карточки, виджеты, панели |
| `--color-bg-card-hover` | hover карточек |
| `--color-bg-elevated` | модалки, dropdown, popover |
| `--color-bg-muted` | вторичные блоки |
| `--color-bg-soft` | progress track, skeleton, inactive state |

### Текст

| Token | Назначение |
|---|---|
| `--color-text-primary` | основной текст |
| `--color-text-secondary` | вторичный текст |
| `--color-text-muted` | подписи, даты, пояснения |
| `--color-text-disabled` | disabled-состояния |
| `--color-text-inverse` | тёмный текст на светлых/ярких кнопках |

### Статусы

| Token | Значение |
|---|---|
| `--color-success` | исправно, завершено, в работе |
| `--color-warning` | внимание, ремонт, плановый осмотр |
| `--color-danger` | дефект, ДТП, ошибка, просрочка |
| `--color-info` | быстрый осмотр, справочная информация |
| `--color-accent-purple` | дополнительная категория данных |

---

## 7. Tailwind config

Если проект использует Tailwind, добавить цвета через CSS variables.

Файл:

```txt
tailwind.config.js
```

Пример:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: {
          app: "var(--color-bg-app)",
          page: "var(--color-bg-page)",
          card: "var(--color-bg-card)",
          cardHover: "var(--color-bg-card-hover)",
          elevated: "var(--color-bg-elevated)",
          muted: "var(--color-bg-muted)",
          soft: "var(--color-bg-soft)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          disabled: "var(--color-text-disabled)",
          inverse: "var(--color-text-inverse)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          muted: "var(--color-border-muted)",
          strong: "var(--color-border-strong)",
          focus: "var(--color-border-focus)",
        },
        brand: {
          DEFAULT: "var(--color-brand-primary)",
          hover: "var(--color-brand-primary-hover)",
          active: "var(--color-brand-primary-active)",
          soft: "var(--color-brand-primary-soft)",
        },
        status: {
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          danger: "var(--color-danger)",
          info: "var(--color-info)",
        },
        chart: {
          blue: "var(--chart-blue)",
          green: "var(--chart-green)",
          orange: "var(--chart-orange)",
          red: "var(--chart-red)",
          purple: "var(--chart-purple)",
          cyan: "var(--chart-cyan)",
          track: "var(--chart-track)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
      },
    },
  },
};
```

---

## 8. Правила использования цветов в компонентах

### Layout

```css
.app {
  background: var(--color-bg-app);
  color: var(--color-text-primary);
}
```

### Page

```css
.page {
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}
```

### Card

```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
```

### Card title

```css
.card-title {
  color: var(--color-text-primary);
}
```

### Card description

```css
.card-description {
  color: var(--color-text-secondary);
}
```

### Muted text

```css
.muted {
  color: var(--color-text-muted);
}
```

---

## 9. Кнопки

### Primary button

```css
.button-primary {
  background: var(--color-brand-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-brand-primary);
}

.button-primary:hover {
  background: var(--color-brand-primary-hover);
}
```

### Secondary button

```css
.button-secondary {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}

.button-secondary:hover {
  background: var(--color-bg-soft);
}
```

### Danger button

```css
.button-danger {
  background: var(--color-danger);
  color: var(--color-text-primary);
  border: 1px solid var(--color-danger);
}

.button-danger:hover {
  background: var(--color-danger-hover);
}
```

---

## 10. Inputs / Selects / Textarea

```css
.input,
.select,
.textarea {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}

.input::placeholder,
.textarea::placeholder {
  color: var(--color-text-muted);
}

.input:focus,
.select:focus,
.textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-brand-primary-soft);
}

.input:disabled,
.select:disabled,
.textarea:disabled {
  background: var(--color-bg-muted);
  color: var(--color-text-disabled);
}
```

---

## 11. Таблицы

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

.table tr:hover {
  background: var(--color-bg-card-hover);
}
```

---

## 12. Напоминания и alerts

Важно исправить проблему светлых alert-блоков.

### Danger alert

```css
.alert-danger {
  background: var(--color-danger-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(244, 63, 94, 0.32);
}
```

### Warning alert

```css
.alert-warning {
  background: var(--color-warning-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(245, 158, 11, 0.32);
}
```

### Success alert

```css
.alert-success {
  background: var(--color-success-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(34, 197, 94, 0.32);
}
```

### Info alert

```css
.alert-info {
  background: var(--color-info-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(59, 130, 246, 0.32);
}
```

---

## 13. Badges / статусы

Создать единую мапу статусов.

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

Пример компонента badge:

```tsx
type StatusTone = "success" | "warning" | "danger" | "info";

const badgeClassName: Record<StatusTone, string> = {
  success: "bg-status-success/15 text-status-success border-status-success/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  danger: "bg-status-danger/15 text-status-danger border-status-danger/30",
  info: "bg-status-info/15 text-status-info border-status-info/30",
};
```

Если Tailwind не поддерживает opacity для CSS variables, использовать CSS-классы:

```css
.badge-success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border: 1px solid rgba(34, 197, 94, 0.32);
}

.badge-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border: 1px solid rgba(245, 158, 11, 0.32);
}

.badge-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid rgba(244, 63, 94, 0.32);
}

.badge-info {
  background: var(--color-info-soft);
  color: var(--color-info);
  border: 1px solid rgba(59, 130, 246, 0.32);
}
```

---

## 14. Progress bars

Track должен быть всегда тёмным.

```css
.progress {
  background: var(--chart-track);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill-success {
  background: var(--color-success);
}

.progress-fill-warning {
  background: var(--color-warning);
}

.progress-fill-danger {
  background: var(--color-danger);
}

.progress-fill-info {
  background: var(--color-info);
}

.progress-fill-purple {
  background: var(--color-accent-purple);
}
```

Нельзя использовать светлый track внутри тёмной темы.

---

## 15. Графики dashboard

Использовать только chart tokens:

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

---

## 16. Dashboard cards

Для dashboard-карточек использовать:

```css
.dashboard-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
}

.dashboard-card-title {
  color: var(--color-brand-primary);
}

.dashboard-card-title.success {
  color: var(--color-success);
}

.dashboard-card-title.warning {
  color: var(--color-warning);
}

.dashboard-card-title.danger {
  color: var(--color-danger);
}

.dashboard-card-title.info {
  color: var(--color-info);
}
```

---

## 17. Блок напоминаний

Текущий блок напоминаний нужно привести к тёмной теме.

### Было условно плохо

```css
.reminder-card {
  background: #fff7f7;
  color: #ffffff;
}
```

### Должно быть

```css
.reminder-card {
  background: var(--color-danger-soft);
  color: var(--color-text-primary);
  border: 1px solid rgba(244, 63, 94, 0.32);
  border-radius: var(--radius-card);
}

.reminder-card-title {
  color: var(--color-text-primary);
}

.reminder-card-description {
  color: var(--color-text-secondary);
}
```

Для обычных / плановых напоминаний:

```css
.reminder-card.warning {
  background: var(--color-warning-soft);
  border-color: rgba(245, 158, 11, 0.32);
}

.reminder-card.info {
  background: var(--color-info-soft);
  border-color: rgba(59, 130, 246, 0.32);
}
```

---

## 18. Модальные окна / dropdown / popover

```css
.modal,
.dropdown,
.popover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-popover);
}
```

---

## 19. Empty states

```css
.empty-state {
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-strong);
  color: var(--color-text-secondary);
}

.empty-state-title {
  color: var(--color-text-primary);
}

.empty-state-description {
  color: var(--color-text-muted);
}
```

---

## 20. Loading / skeleton

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

---

## 21. Что проверить и заменить

Проверить и привести к токенам:

```txt
src/app
src/pages
src/components
src/widgets
src/features
src/entities
src/shared
```

Особенно:

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

---

## 22. Запрещено

Запрещено:

```txt
- использовать hex-цвета напрямую в компонентах;
- использовать белый текст на светлом фоне;
- использовать светлые alert-card в dark theme;
- задавать разные цвета для одного и того же статуса;
- использовать disabled-text для важной информации;
- использовать chart colors вне общей палитры;
- хранить цвета в нескольких разных файлах без необходимости.
```

---

## 23. Разрешено

Разрешено:

```txt
- использовать hex только в файле tokens.css / theme.css;
- использовать rgba для soft-токенов только внутри файла темы;
- использовать CSS variables в Tailwind config;
- создавать semantic helper-классы;
- создавать statusColorMap для компонентов.
```

---

## 24. Acceptance criteria

Задача считается выполненной, если:

```txt
1. Создан единый файл цветовых токенов.
2. Глобальная тёмная тема подключена в приложение.
3. Основные layout/card/table/form/button компоненты используют токены.
4. Dashboard приведён к единой палитре.
5. Напоминания больше не используют светлый фон со светлым текстом.
6. Progress bars используют тёмный track.
7. Статусы используют единую statusColorMap.
8. В компонентах нет hardcoded hex-цветов.
9. Все основные экраны читаются на тёмном фоне.
10. Hover / active / disabled состояния визуально различимы.
11. UI готов к добавлению light theme в будущем.
```

---

## 25. Ручная проверка экранов

Проверить:

```txt
- dashboard;
- список техники;
- карточку техники;
- блок статистики;
- графики;
- блоки по регионам;
- напоминания;
- формы создания / редактирования;
- фильтры;
- таблицы;
- модальные окна;
- адаптивную версию.
```

На каждом экране проверить:

```txt
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
```

---

## 26. Рекомендуемый порядок внедрения

```txt
1. Добавить tokens.css / theme.css.
2. Подключить глобально.
3. Обновить Tailwind config, если используется Tailwind.
4. Создать statusColorMap.
5. Обновить базовые компоненты: Button, Card, Input, Badge, Alert.
6. Обновить layout.
7. Обновить dashboard.
8. Обновить таблицы и карточки.
9. Обновить напоминания.
10. Проверить все экраны вручную.
11. Удалить hardcoded цвета из компонентов.
```

---

## 27. Итоговая формулировка задачи для коммита

```txt
Unify dark theme color tokens and fix contrast issues across web UI
```

или на русском:

```txt
Унификация тёмной темы и исправление контраста интерфейса
```
