# Frontend Styles

## Цель

Все CSS-стили web-интерфейса должны быть вынесены во внешние CSS-файлы. Компоненты должны содержать структуру, логику и `className`, но не должны содержать inline-стили.

Это нужно для:

- единообразного интерфейса;
- удобной поддержки тем оформления;
- масштабирования SaaS-интерфейса для разных компаний;
- упрощения ревью кода;
- уменьшения хаоса в компонентах.

---

## Главное правило

```txt
JSX / TSX компонент -> только разметка, логика и className
CSS -> отдельный файл
```

Нельзя писать стили напрямую в компонентах.

Плохо:

```tsx
<button style={{ background: '#111', color: '#fff', padding: 12 }}>
  Start
</button>
```

Правильно:

```tsx
<button className="primaryButton">
  Start
</button>
```

```css
.primaryButton {
  padding: 12px 16px;
  border-radius: 8px;
}
```

---

## Рекомендуемая структура web-стилей

```txt
web/
└── src/
    ├── app/
    ├── components/
    ├── i18n/
    ├── lib/
    └── styles/
        ├── globals.css
        ├── variables.css
        ├── layout.css
        ├── forms.css
        ├── tables.css
        ├── buttons.css
        ├── cards.css
        └── states.css
```

Назначение файлов:

- `globals.css` — базовые стили приложения;
- `variables.css` — CSS-переменные, цвета, отступы, радиусы, размеры;
- `layout.css` — сетка, контейнеры, страницы, sidebar/header;
- `forms.css` — поля ввода, ошибки, подсказки, состояния форм;
- `tables.css` — таблицы техники, осмотров, дефектов;
- `buttons.css` — кнопки и действия;
- `cards.css` — карточки техники, осмотров, дефектов;
- `states.css` — статусы, бейджи, пустые состояния, ошибки.

---

## CSS Modules

Для сложных компонентов можно использовать CSS Modules.

Разрешено:

```txt
components/
└── VehicleCard/
    ├── VehicleCard.tsx
    └── VehicleCard.module.css
```

Это тоже считается внешним CSS-файлом, потому что стили не находятся внутри компонента.

Пример:

```tsx
import styles from './VehicleCard.module.css';

export function VehicleCard() {
  return <article className={styles.card}>...</article>;
}
```

```css
.card {
  border-radius: 12px;
  padding: 16px;
}
```

---

## CSS-переменные

Базовые цвета, размеры и отступы нужно хранить через CSS-переменные.

Пример:

```css
:root {
  --color-bg: #ffffff;
  --color-text: #111111;
  --color-muted: #666666;
  --color-border: #e5e5e5;
  --radius-md: 8px;
  --radius-lg: 12px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
}
```

Компоненты должны использовать переменные:

```css
.card {
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
}
```

---

## SaaS-ready оформление

На текущем этапе не нужно делать полноценный white-label для каждой компании.

Но стили нужно организовать так, чтобы позже можно было добавить:

- accent color компании;
- логотип компании;
- светлую / тёмную тему;
- разные визуальные настройки без переписывания компонентов.

Правильная будущая модель:

```txt
company settings -> CSS variables -> внешний CSS
```

Не нужно хардкодить в компонентах цвета конкретной компании.

---

## Мультиязычность и стили

Стили не должны зависеть от конкретного языка интерфейса.

Нужно учитывать, что тексты на английском, немецком, французском и испанском могут быть длиннее русских.

Правила:

- не задавать фиксированную ширину кнопок под один язык;
- не обрезать важные подписи без необходимости;
- использовать гибкие контейнеры;
- проверять интерфейс на `ru`, `en`, `de`, `fr`, `es`.

---

## Формы номера машины

Стили для поля номера машины должны находиться во внешнем CSS-файле.

Поле должно иметь состояния:

```txt
default
focus
valid
invalid
disabled
loading
```

Пример классов:

```txt
.vehicleNumberInput
.vehicleNumberInput--valid
.vehicleNumberInput--invalid
.vehicleNumberHint
.vehicleNumberError
```

Логика валидации остаётся в коде, стили ошибок — во внешнем CSS.

---

## Что запрещено

Нельзя использовать:

- inline-стили через `style={{ ... }}`;
- CSS внутри JSX / TSX компонентов;
- хардкод цветов компании в компонентах;
- дублирование одинаковых стилей в разных компонентах;
- реальные ссылки, токены или секреты в CSS-файлах;
- tenant-specific CSS-файлы с данными реальных клиентов.

---

## Что разрешено

Разрешено:

- глобальные CSS-файлы в `web/src/styles/`;
- CSS Modules рядом с компонентами;
- CSS-переменные;
- utility-классы внутри внешнего CSS;
- адаптивные стили через media queries;
- отдельные классы состояний для ошибок, загрузки и пустых экранов.

---

## Минимальный план внедрения

1. Создать папку `web/src/styles/`.
2. Создать базовые файлы:
   - `globals.css`;
   - `variables.css`;
   - `layout.css`;
   - `forms.css`;
   - `buttons.css`;
   - `tables.css`;
   - `cards.css`;
   - `states.css`.
3. Подключить глобальные стили в корневом layout web-приложения.
4. Найти inline-стили и заменить их на CSS-классы.
5. Для сложных компонентов использовать CSS Modules.
6. Проверить основные экраны на всех языках: `ru`, `en`, `de`, `fr`, `es`.
7. Добавить пункт проверки CSS в code review / checklist.

---

## Стили для фото и одометра

Для блоков обязательных фото, карточки одометра и ДТП-галереи рекомендуется использовать отдельные классы во внешних CSS-файлах.

Примеры зон:

```txt
.photoRequirementList
.photoRequirementItem
.odometerCard
.odometerValue
.accidentGallery
.damageCloseupGrid
```

Inline-стили для состояния загрузки фото и карточек одометра не использовать.

---

## Тёмная тема

Web-интерфейс должен поддерживать `system`, `light` и `dark` режимы.

Тёмная тема реализуется только через CSS-переменные. Компоненты не должны знать конкретные цвета темы.

Рекомендуемая структура:

```txt
web/src/styles/
├── variables.css
├── themes.css
├── globals.css
├── layout.css
├── forms.css
├── buttons.css
├── tables.css
├── cards.css
├── badges.css
├── modals.css
└── states.css
```

Пример `themes.css`:

```css
:root,
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-surface: #f7f7f8;
  --color-card: #ffffff;
  --color-text: #111827;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-primary: #2563eb;
  --color-danger: #dc2626;
  --color-warning: #d97706;
  --color-success: #16a34a;
}

[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #111827;
  --color-card: #1f2937;
  --color-text: #f9fafb;
  --color-muted: #9ca3af;
  --color-border: #374151;
  --color-primary: #60a5fa;
  --color-danger: #f87171;
  --color-warning: #fbbf24;
  --color-success: #4ade80;
}
```

Для режима `system` нужно учитывать `prefers-color-scheme` и применять соответствующую тему без перезагрузки страницы.

Проверить в тёмной теме:

- таблицы техники и осмотров;
- карточку техники;
- карточку осмотра;
- галерею фото;
- формы номера и одометра;
- бейджи статусов;
- ошибки валидации;
- экран входа и настройки.

## Стили переключателя единиц пробега

Переключатель `km / mi` в настройках компании оформляется через внешние CSS-классы. Inline-стили не использовать.

```txt
.unit-toggle
.unit-toggle__option
.unit-toggle__option--active
.unit-toggle__hint
```

Компонент должен быть читаем в светлой и тёмной теме.
