# Data Model

## Принцип

Модель остаётся простой, но сразу готовится к SaaS. Все бизнес-сущности содержат `company_id`.

---

## Companies

```txt
companies
- id
- name
- slug
- default_locale
- distance_unit
- plan
- status
- created_at
```

---

## Profiles / Users

```txt
profiles
- id
- email
- name
- locale
- created_at
```

---

## Company Users

```txt
company_users
- id
- company_id
- user_id
- role
- status
- created_at
```

Роли:

```txt
owner
admin
manager
inspector
```

---

## Vehicles

```txt
vehicles
- id
- company_id
- number_raw
- number_normalized
- number_country
- number_region
- name
- vehicle_type
- status
- last_odometer_value
- last_odometer_at
- is_active
- created_at
- updated_at
```

`number_normalized` хранится только латиницей.

Уникальность:

```txt
company_id + number_normalized
```

---

## Inspections

```txt
inspections
- id
- company_id
- vehicle_id
- inspector_id
- type
- status
- result
- started_at
- completed_at
- latitude
- longitude
- vehicle_number_confirmed
- odometer_value
- odometer_unit
- odometer_value_km
- odometer_photo_id
- odometer_confirmed_by
- odometer_confirmed_at
- odometer_unavailable_reason
- accident_occurred_at
- accident_place_text
- accident_latitude
- accident_longitude
- accident_location_source
- accident_time_source
- accident_confirmed_by
- accident_confirmed_at
- requires_review
- app_version
- device_id
- created_at
- updated_at
```

Типы осмотра:

```txt
quick
planned
accident
```

Статусы:

```txt
draft
in_progress
completed
cancelled
```

Результаты:

```txt
ok
has_defects
requires_review
```

---

## Inspection Items

```txt
inspection_items
- id
- company_id
- inspection_id
- template_item_id
- section_key
- component_area
- title_snapshot
- result
- status
- comment
- requires_photo_on_fail
- created_at
```

`section_key` и `component_area` нужны для группировки пунктов планового осмотра: внешнее состояние, ходовая часть, тормозная система, электрика и свет.

`title_snapshot` нужен, чтобы история старого осмотра не менялась при изменении шаблона чек-листа.

---

## Defects

```txt
defects
- id
- company_id
- inspection_id
- vehicle_id
- inspection_item_id
- title
- description
- damage_area
- component_area
- severity
- main_photo_id
- created_at
```

Для ДТП дефект может использоваться как повреждение.

---

## Accident Details

ДТП является типом осмотра `accident`, поэтому базовые данные можно хранить в `inspections`.

```txt
inspections
- accident_occurred_at
- accident_place_text
- accident_latitude
- accident_longitude
- accident_location_source
- accident_time_source
- accident_confirmed_by
- accident_confirmed_at
```

Правила:

- `accident_occurred_at` обязателен для завершённого ДТП-осмотра.
- `accident_place_text` обязателен для завершённого ДТП-осмотра.
- координаты желательны, но не заменяют текстовое место ДТП.
- время начала осмотра не заменяет время ДТП.

Для планового осмотра `component_area` фиксирует источник дефекта:

```txt
exterior
undercarriage
brake_system
electrical
lighting
other
```

---

## Photos

```txt
photos
- id
- company_id
- vehicle_id
- inspection_id
- defect_id
- photo_type
- url
- thumbnail_url
- latitude
- longitude
- taken_at
- uploaded_at
- source
- hash
- file_size
- mime_type
- created_at
```

Типы фото:

```txt
front
left_side
right_side
rear
overall
odometer
number_plate
undercarriage
brake_system
electrical
lighting
component_detail
defect
accident_overall
accident_damage_close
other
```

---

## Photo Requirements

```txt
photo_requirements
- id
- company_id
- inspection_type
- photo_type
- required
- min_count
- sort_order
- created_at
```

Используется для проверки завершения осмотра.

---

## Vehicle Number Recognitions

```txt
vehicle_number_recognitions
- id
- company_id
- user_id
- vehicle_id
- photo_id
- raw_text
- normalized_number
- confidence
- provider
- confirmed
- confirmed_number
- created_at
```

---

## Odometer Recognitions

```txt
odometer_recognitions
- id
- company_id
- inspection_id
- vehicle_id
- user_id
- photo_id
- raw_text
- recognized_value
- confidence
- provider
- confirmed
- confirmed_value
- created_at
```

---

## Checklist Templates

```txt
checklist_templates
- id
- company_id
- inspection_type
- name
- version
- is_active
- created_at
```

```txt
checklist_template_items
- id
- company_id
- template_id
- section_key
- component_area
- title
- description
- sort_order
- is_required
- requires_photo_on_fail
- created_at
```

---

## Audit Logs

```txt
audit_logs
- id
- company_id
- user_id
- action
- entity_type
- entity_id
- metadata
- created_at
```

Фиксируются важные действия: завершение осмотра, подтверждение номера, подтверждение километража, подтверждение места/времени ДТП, удаление/изменение техники, изменение настроек компании.

---

## Общие требования

- Все выборки бизнес-данных фильтруются по `company_id`.
- Фото не должны быть публичными без проверки доступа.
- Километраж сохраняется в карточке осмотра и может обновлять последнее значение в карточке техники.
- OCR-результаты сохраняются отдельно от подтверждённых инспектором значений.
- Для ДТП место и время ДТП сохраняются отдельно от времени создания осмотра и геоданных фото.


Рекомендуемые `section_key` / `component_area` для планового осмотра:

```txt
exterior
undercarriage
brake_system
electrical
lighting
odometer
other
```

Световые приборы можно технически относить к электрике, но в интерфейсе лучше держать отдельной секцией `lighting`.

---

## Theme Preferences

Тема интерфейса хранится отдельно от бизнес-данных осмотра.

### Companies

Добавить поле:

```txt
default_theme
```

Допустимые значения:

```txt
system
light
dark
```

### Profiles / Users

Добавить поле:

```txt
theme_preference
```

Допустимые значения:

```txt
system
light
dark
```

Правило выбора темы:

```txt
profiles.theme_preference -> companies.default_theme -> system -> light
```

Тема не должна храниться в таблицах `inspections`, `photos`, `defects` и других бизнес-сущностях.

## Regional data model additions

Для регионального размещения данных в `companies` добавляются поля:

```txt
companies
- region_code
- data_residency
- api_cluster_key
- storage_cluster_key
- ocr_cluster_key
- created_in_region_at
```

Рекомендуемые значения `region_code`:

```txt
ru
 eu
intl
```

Рекомендуемые значения `data_residency`:

```txt
russia
 eu
international
```

Для глобальной маршрутизации используется отдельная минимальная таблица или сервис:

```txt
tenant_registry
- tenant_id
- slug
- public_name
- region_code
- api_cluster_key
- status
- created_at
- updated_at
```

`tenant_registry` не должен содержать персональные данные, фото, номера автомобилей, геоданные, комментарии или данные ДТП.

Все бизнес-таблицы остаются внутри регионального контура:

```txt
vehicles
inspections
photos
defects
odometer_recognitions
vehicle_number_recognitions
audit_logs
```

## Measurement Units

Единицы пробега задаются на уровне компании:

```txt
companies.distance_unit = km | mi
```

В осмотре сохраняется снимок единицы на момент фиксации:

```txt
inspections.odometer_value
inspections.odometer_unit
inspections.odometer_value_km
```

`odometer_value` — значение, подтверждённое инспектором.

`odometer_unit` — единица компании на момент осмотра.

`odometer_value_km` — нормализованное значение в километрах для внутренних проверок, сортировки, графиков и проверки уменьшения пробега.

Правило: не хранить пробег без единицы измерения.

Если администратор меняет единицу компании, старые осмотры сохраняют свою исходную единицу, новые осмотры получают новую единицу.
