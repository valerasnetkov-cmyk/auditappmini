# Изменение темы: перенос цветовой гаммы из референса в проект

## 1. Цель

Перенести в проект цветовую гамму из приложенного референса: тёмный технический интерфейс в стиле node/workflow editor.

Новая тема должна заменить текущую более контрастную black/blue схему на более мягкую тёмную палитру:

- тёмный графитовый фон;
- серо-синие карточки;
- приглушённые границы;
- яркие, но не кислотные акценты;
- синий как основной action / info;
- зелёный как success / активное состояние;
- оранжевый как warning / ремонт;
- красный как danger / дефект / ДТП / ошибка;
- фиолетовый как дополнительный тип данных / плановый сценарий;
- без светлых карточек внутри dark UI.

---

## 2. Визуальный ориентир

Референс похож на интерфейс workflow-редактора:

```txt
тёмный canvas
+ мелкая сетка
+ карточки-узлы
+ тонкие серые линии
+ цветные иконки
+ аккуратные акцентные состояния
```

Главное ощущение:

```txt
не чисто чёрный интерфейс,
а профессиональный dark graphite UI.
```

---

## 3. Новая палитра проекта

Цвета ниже подобраны по приложенному референсу и адаптированы под dashboard / таблицы / карточки / формы проекта.

## 3.1. Core background

```css
:root,
[data-theme="dark"] {
  --color-bg-app: #202027;
  --color-bg-page: #24262D;
  --color-bg-canvas: #25272E;
  --color-bg-grid-dot: rgba(255, 255, 255, 0.055);

  --color-bg-card: #2F3740;
  --color-bg-card-hover: #37414B;
  --color-bg-card-active: #3E4954;

  --color-bg-elevated: #343D47;
  --color-bg-muted: #293039;
  --color-bg-soft: #404A55;

  --color-bg-input: #272E36;
  --color-bg-input-hover: #303943;
}
```

### Назначение

| Token | Назначение |
|---|---|
| `--color-bg-app` | общий фон приложения |
| `--color-bg-page` | фон страницы / dashboard |
| `--color-bg-canvas` | фон рабочих областей, dashboard sections |
| `--color-bg-grid-dot` | цвет точек сетки, если нужна workflow/grid эстетика |
| `--color-bg-card` | карточки, виджеты, панели |
| `--color-bg-card-hover` | hover карточек |
| `--color-bg-card-active` | active/selected карточка |
| `--color-bg-elevated` | модалки, dropdown, popover |
| `--color-bg-muted` | вторичные блоки |
| `--color-bg-soft` | progress track, skeleton, inactive state |
| `--color-bg-input` | input/select/textarea |
| `--color-bg-input-hover` | hover input/select/textarea |

---

## 3.2. Text

```css
:root,
[data-theme="dark"] {
  --color-text-primary: #F5F7FA;
  --color-text-secondary: #C7D0DA;
  --color-text-muted: #8E9AA8;
  --color-text-subtle: #697480;
  --color-text-disabled: #59636F;
  --color-text-inverse: #151A20;
}
```

### Правила текста

| Token | Использование |
|---|---|
| `--color-text-primary` | заголовки, основные числа, важный текст |
| `--color-text-secondary` | обычный текст, подписи карточек |
| `--color-text-muted` | даты, вторичные описания |
| `--color-text-subtle` | малозначимые технические подписи |
| `--color-text-disabled` | disabled |
| `--color-text-inverse` | текст на ярких светлых кнопках, если понадобится |

---

## 3.3. Borders / lines

```css
:root,
[data-theme="dark"] {
  --color-border-default: #56616D;
  --color-border-muted: #3D4650;
  --color-border-subtle: #323A43;
  --color-border-strong: #75808C;
  --color-border-focus: #2D7FF9;

  --color-line-default: #8A95A3;
  --color-line-muted: #5F6A76;
}
```

### Правила границ

- Карточки: `--color-border-muted`.
- Интерактивные выбранные элементы: `--color-border-focus`.
- Линии связей / разделители / workflow connections: `--color-line-muted`.
- Не использовать почти чёрные границы на тёмном фоне — они пропадают.

---

## 3.4. Brand / primary action

```css
:root,
[data-theme="dark"] {
  --color-brand-primary: #2D7FF9;
  --color-brand-primary-hover: #4C96FF;
  --color-brand-primary-active: #1767D9;
  --color-brand-primary-soft: rgba(45, 127, 249, 0.16);
  --color-brand-primary-border: rgba(45, 127, 249, 0.42);
}
```

Использование:

```txt
primary button
active tab
selected filter
основной график
быстрый осмотр
ссылки
фокус input
```

---

## 3.5. Status / semantic colors

```css
:root,
[data-theme="dark"] {
  --color-success: #00C853;
  --color-success-hover: #20D86A;
  --color-success-soft: rgba(0, 200, 83, 0.16);
  --color-success-border: rgba(0, 200, 83, 0.36);

  --color-info: #2D7FF9;
  --color-info-hover: #4C96FF;
  --color-info-soft: rgba(45, 127, 249, 0.16);
  --color-info-border: rgba(45, 127, 249, 0.36);

  --color-warning: #FF6D00;
  --color-warning-hover: #FF8426;
  --color-warning-soft: rgba(255, 109, 0, 0.16);
  --color-warning-border: rgba(255, 109, 0, 0.36);

  --color-danger: #FF2D38;
  --color-danger-hover: #FF4B55;
  --color-danger-soft: rgba(255, 45, 56, 0.16);
  --color-danger-border: rgba(255, 45, 56, 0.36);

  --color-purple: #A855F7;
  --color-purple-hover: #B96CFF;
  --color-purple-soft: rgba(168, 85, 247, 0.16);
  --color-purple-border: rgba(168, 85, 247, 0.36);
}
```

---

## 3.6. Charts

```css
:root,
[data-theme="dark"] {
  --chart-blue: #2D7FF9;
  --chart-green: #00C853;
  --chart-orange: #FF6D00;
  --chart-red: #FF2D38;
  --chart-purple: #A855F7;
  --chart-cyan: #00A7D6;
  --chart-track: #3D4650;
  --chart-grid: rgba(255, 255, 255, 0.08);
  --chart-axis: #8E9AA8;
}
```

---

## 3.7. Shadows / radius

```css
:root,
[data-theme="dark"] {
  --shadow-card: 0 14px 32px rgba(0, 0, 0, 0.26);
  --shadow-card-hover: 0 18px 38px rgba(0, 0, 0, 0.34);
  --shadow-popover: 0 22px 48px rgba(0, 0, 0, 0.42);

  --radius-card: 14px;
  --radius-control: 10px;
  --radius-pill: 999px;
}
```

---

# 4. Полный CSS-файл темы

Создать или заменить файл:

```txt
src/styles/tokens.css
```

Содержимое:

```css
:root,
[data-theme="dark"] {
  /* Background */
  --color-bg-app: #202027;
  --color-bg-page: #24262D;
  --color-bg-canvas: #25272E;
  --color-bg-grid-dot: rgba(255, 255, 255, 0.055);

  --color-bg-card: #2F3740;
  --color-bg-card-hover: #37414B;
  --color-bg-card-active: #3E4954;

  --color-bg-elevated: #343D47;
  --color-bg-muted: #293039;
  --color-bg-soft: #404A55;

  --color-bg-input: #272E36;
  --color-bg-input-hover: #303943;

  /* Text */
  --color-text-primary: #F5F7FA;
  --color-text-secondary: #C7D0DA;
  --color-text-muted: #8E9AA8;
  --color-text-subtle: #697480;
  --color-text-disabled: #59636F;
  --color-text-inverse: #151A20;

  /* Border / lines */
  --color-border-default: #56616D;
  --color-border-muted: #3D4650;
  --color-border-subtle: #323A43;
  --color-border-strong: #75808C;
  --color-border-focus: #2D7FF9;

  --color-line-default: #8A95A3;
  --color-line-muted: #5F6A76;

  /* Brand */
  --color-brand-primary: #2D7FF9;
  --color-brand-primary-hover: #4C96FF;
  --color-brand-primary-active: #1767D9;
  --color-brand-primary-soft: rgba(45, 127, 249, 0.16);
  --color-brand-primary-border: rgba(45, 127, 249, 0.42);

  /* Status */
  --color-success: #00C853;
  --color-success-hover: #20D86A;
  --color-success-soft: rgba(0, 200, 83, 0.16);
  --color-success-border: rgba(0, 200, 83, 0.36);

  --color-info: #2D7FF9;
  --color-info-hover: #4C96FF;
  --color-info-soft: rgba(45, 127, 249, 0.16);
  --color-info-border: rgba(45, 127, 249, 0.36);

  --color-warning: #FF6D00;
  --color-warning-hover: #FF8426;
  --color-warning-soft: rgba(255, 109, 0, 0.16);
  --color-warning-border: rgba(255, 109, 0, 0.36);

  --color-danger: #FF2D38;
  --color-danger-hover: #FF4B55;
  --color-danger-soft: rgba(255, 45, 56, 0.16);
  --color-danger-border: rgba(255, 45, 56, 0.36);

  --color-purple: #A855F7;
  --color-purple-hover: #B96CFF;
  --color-purple-soft: rgba(168, 85, 247, 0.16);
  --color-purple-border: rgba(168, 85, 247, 0.36);

  /* Charts */
  --chart-blue: #2D7FF9;
  --chart-green: #00C853;
  --chart-orange: #FF6D00;
  --chart-red: #FF2D38;
  --chart-purple: #A855F7;
  --chart-cyan: #00A7D6;
  --chart-track: #3D4650;
  --chart-grid: rgba(255, 255, 255, 0.08);
  --chart-axis: #8E9AA8;

  /* Shadows */
  --shadow-card: 0 14px 32px rgba(0, 0, 0, 0.26);
  --shadow-card-hover: 0 18px 38px rgba(0, 0, 0, 0.34);
  --shadow-popover: 0 22px 48px rgba(0, 0, 0, 0.42);

  /* Radius */
  --radius-card: 14px;
  --radius-control: 10px;
  --radius-pill: 999px;
}

html,
body {
  background: var(--color-bg-app);
  color: var(--color-text-primary);
}
```

---

# 5. Tailwind config

Если используется Tailwind, добавить маппинг.

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: {
          app: "var(--color-bg-app)",
          page: "var(--color-bg-page)",
          canvas: "var(--color-bg-canvas)",
          card: "var(--color-bg-card)",
          cardHover: "var(--color-bg-card-hover)",
          cardActive: "var(--color-bg-card-active)",
          elevated: "var(--color-bg-elevated)",
          muted: "var(--color-bg-muted)",
          soft: "var(--color-bg-soft)",
          input: "var(--color-bg-input)",
          inputHover: "var(--color-bg-input-hover)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          subtle: "var(--color-text-subtle)",
          disabled: "var(--color-text-disabled)",
          inverse: "var(--color-text-inverse)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          muted: "var(--color-border-muted)",
          subtle: "var(--color-border-subtle)",
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
          info: "var(--color-info)",
          warning: "var(--color-warning)",
          danger: "var(--color-danger)",
          purple: "var(--color-purple)",
        },
        chart: {
          blue: "var(--chart-blue)",
          green: "var(--chart-green)",
          orange: "var(--chart-orange)",
          red: "var(--chart-red)",
          purple: "var(--chart-purple)",
          cyan: "var(--chart-cyan)",
          track: "var(--chart-track)",
          grid: "var(--chart-grid)",
          axis: "var(--chart-axis)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        cardHover: "var(--shadow-card-hover)",
        popover: "var(--shadow-popover)",
      },
    },
  },
};
```

---

# 6. Сетка как в референсе

Для dashboard или технических экранов можно добавить мягкую точечную сетку.

```css
.bg-workflow-grid {
  background-color: var(--color-bg-canvas);
  background-image: radial-gradient(
    var(--color-bg-grid-dot) 1px,
    transparent 1px
  );
  background-size: 12px 12px;
}
```

Использовать аккуратно:

```txt
можно:
- dashboard background;
- технические страницы;
- пустые состояния;
- страницы с диаграммами / процессами.

не нужно:
- внутри таблиц;
- внутри форм;
- внутри карточек с большим количеством текста.
```

---

# 7. Карточки

```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
}

.card:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-default);
  box-shadow: var(--shadow-card-hover);
}

.card-title {
  color: var(--color-text-primary);
}

.card-description {
  color: var(--color-text-secondary);
}

.card-meta {
  color: var(--color-text-muted);
}
```

---

# 8. Узлы / компактные dashboard-блоки

Если в проекте будут compact cards как в референсе:

```css
.node-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  color: var(--color-text-primary);
  box-shadow: var(--shadow-card);
}

.node-card-icon {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-muted);
  border-radius: 8px;
}

.node-card-label {
  color: var(--color-text-primary);
  font-weight: 600;
}

.node-card-caption {
  color: var(--color-text-muted);
}
```

---

# 9. Кнопки

## Primary

```css
.button-primary {
  background: var(--color-brand-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-brand-primary);
}

.button-primary:hover {
  background: var(--color-brand-primary-hover);
  border-color: var(--color-brand-primary-hover);
}
```

## Secondary

```css
.button-secondary {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-muted);
}

.button-secondary:hover {
  background: var(--color-bg-soft);
  border-color: var(--color-border-default);
}
```

## Ghost

```css
.button-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid transparent;
}

.button-ghost:hover {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
}
```

## Danger

```css
.button-danger {
  background: var(--color-danger);
  color: var(--color-text-primary);
  border: 1px solid var(--color-danger);
}

.button-danger:hover {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}
```

---

# 10. Формы

```css
.input,
.select,
.textarea {
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-control);
}

.input:hover,
.select:hover,
.textarea:hover {
  background: var(--color-bg-input-hover);
  border-color: var(--color-border-default);
}

.input:focus,
.select:focus,
.textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-brand-primary-soft);
}

.input::placeholder,
.textarea::placeholder {
  color: var(--color-text-subtle);
}

.input:disabled,
.select:disabled,
.textarea:disabled {
  background: var(--color-bg-muted);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}
```

---

# 11. Таблицы

```css
.table {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.table th {
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-muted);
}

.table td {
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-subtle);
}

.table tr:hover td {
  background: var(--color-bg-card-hover);
}
```

---

# 12. Status map для проекта

Создать единое соответствие статусов.

```ts
export const statusColorMap = {
  /* vehicle */
  active: "success",
  in_work: "success",
  repair: "warning",
  inactive: "muted",

  /* inspections */
  quick: "info",
  planned: "purple",
  accident: "danger",

  /* inspection state */
  draft: "info",
  completed: "success",
  overdue: "danger",

  /* defects */
  defect: "danger",
  damage: "danger",
  fixed: "success",

  /* common */
  success: "success",
  info: "info",
  warning: "warning",
  danger: "danger",
} as const;
```

---

# 13. Badges

```css
.badge {
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-weight: 600;
}

.badge-success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: var(--color-success-border);
}

.badge-info {
  background: var(--color-info-soft);
  color: var(--color-info);
  border-color: var(--color-info-border);
}

.badge-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border-color: var(--color-warning-border);
}

.badge-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger-border);
}

.badge-purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
  border-color: var(--color-purple-border);
}
```

---

# 14. Alerts / напоминания

Главное исправление: убрать светлые карточки в тёмной теме.

## Просрочка / дефект / ДТП

```css
.alert-danger,
.reminder-danger {
  background: var(--color-danger-soft);
  color: var(--color-text-primary);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-card);
}
```

## Плановый осмотр / предупреждение

```css
.alert-warning,
.reminder-warning {
  background: var(--color-warning-soft);
  color: var(--color-text-primary);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-card);
}
```

## Успешное состояние

```css
.alert-success {
  background: var(--color-success-soft);
  color: var(--color-text-primary);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-card);
}
```

## Информация

```css
.alert-info {
  background: var(--color-info-soft);
  color: var(--color-text-primary);
  border: 1px solid var(--color-info-border);
  border-radius: var(--radius-card);
}
```

---

# 15. Progress bars

```css
.progress {
  background: var(--chart-track);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill-success {
  background: var(--color-success);
}

.progress-fill-info {
  background: var(--color-info);
}

.progress-fill-warning {
  background: var(--color-warning);
}

.progress-fill-danger {
  background: var(--color-danger);
}

.progress-fill-purple {
  background: var(--color-purple);
}
```

---

# 16. Dashboard charts

```ts
export const chartColors = {
  inWork: "var(--chart-green)",
  quickInspection: "var(--chart-blue)",
  plannedInspection: "var(--chart-purple)",
  repair: "var(--chart-orange)",
  defect: "var(--chart-red)",
  accident: "var(--chart-red)",
  neutral: "var(--chart-cyan)",
  track: "var(--chart-track)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
};
```

---

# 17. Маппинг цветов по продуктовым сущностям

| Сущность | Цвет |
|---|---|
| В работе | `success` |
| Исправно | `success` |
| Быстрый осмотр | `info` / blue |
| Плановый осмотр | `purple` |
| Ремонт | `warning` / orange |
| Дефект | `danger` / red |
| ДТП | `danger` / red |
| Просрочено | `danger` / red |
| Нейтральная статистика | `info` или `cyan` |
| Неактивное состояние | muted gray |

---

# 18. Что заменить в текущем интерфейсе

Проверить и заменить цвета в:

```txt
dashboard
список техники
карточка техники
карточка осмотра
история осмотров
дефекты / повреждения
напоминания
таблицы
формы
фильтры
badges
progress bars
charts
toast
modal
dropdown
mobile-width layout
```

---

# 19. Запрещено

```txt
- использовать чистый чёрный #000000 как фон приложения;
- использовать чистый белый #ffffff как массовый текст, если есть token;
- использовать светлые карточки в dark UI;
- использовать hex напрямую в компонентах;
- использовать разные цвета для одного статуса;
- делать progress track светлым;
- использовать серый текст на почти таком же сером фоне;
- использовать disabled color для важной информации.
```

---

# 20. Пример замены плохого блока

## Было

```css
.reminder-card {
  background: #fff3f3;
  color: #ffffff;
}
```

## Стало

```css
.reminder-card {
  background: var(--color-danger-soft);
  color: var(--color-text-primary);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-card);
}
```

---

# 21. Пример layout

```css
.app-layout {
  min-height: 100vh;
  background: var(--color-bg-app);
  color: var(--color-text-primary);
}

.page {
  background: var(--color-bg-page);
}

.dashboard {
  background-color: var(--color-bg-canvas);
  background-image: radial-gradient(
    var(--color-bg-grid-dot) 1px,
    transparent 1px
  );
  background-size: 12px 12px;
}
```

---

# 22. Acceptance criteria

Задача считается выполненной, если:

```txt
1. Цвета из референса перенесены в tokens.css.
2. Общий фон стал графитовым, а не чисто синим/чёрным.
3. Карточки стали серо-синими, как node cards в референсе.
4. Границы карточек видны, но не кричат.
5. Синий, зелёный, оранжевый, красный и фиолетовый используются только по смыслу.
6. Dashboard визуально ближе к приложенному референсу.
7. Напоминания больше не имеют светлый фон со светлым текстом.
8. Progress bars используют тёмный track.
9. Таблицы и формы читаются на тёмном фоне.
10. В компонентах нет hardcoded hex-цветов.
11. Все ключевые экраны проходят ручную проверку контраста.
```

---

# 23. Рекомендуемый порядок внедрения

```txt
1. Добавить / обновить src/styles/tokens.css.
2. Подключить tokens.css глобально.
3. Обновить Tailwind config, если используется Tailwind.
4. Переназначить базовые компоненты: Button, Card, Input, Badge, Alert.
5. Обновить layout и dashboard background.
6. Обновить progress bars и charts.
7. Исправить блок напоминаний.
8. Обновить таблицы и карточки техники.
9. Проверить адаптивную версию.
10. Удалить hardcoded colors из компонентов.
```

---

# 24. Итоговая задача для разработчика

```txt
Перенести цветовую гамму из приложенного workflow-референса в web-интерфейс проекта.

Сделать тёмную графитовую тему через CSS variables:
- фон приложения;
- фон карточек;
- границы;
- текст;
- статусы;
- графики;
- progress bars;
- alerts;
- формы.

Убрать прямое использование hex-цветов в компонентах.
Исправить проблемы контраста, особенно светлый текст на светлом фоне.
```

---

# 25. Название коммита

```txt
Update dark theme palette from workflow reference
```

или:

```txt
Перенос графитовой dark UI палитры из референса
```
