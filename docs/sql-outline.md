# SQL Outline

## Важно

Это безопасный SQL-скелет без секретов, паролей и production-ссылок.

---

## Companies

```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  default_locale text not null default 'ru' check (default_locale in ('ru', 'en', 'de', 'fr', 'es')),
  plan text not null default 'free',
  status text not null default 'active',
  default_theme text not null default 'system' check (default_theme in ('system', 'light', 'dark')),
  created_at timestamp default now()
);
```

---


---

## Profiles / Users Theme Preference

```sql
-- Если используется отдельная таблица profiles/users, добавить поле темы:

alter table profiles
add column theme_preference text default 'system'
check (theme_preference in ('system', 'light', 'dark'));
```

```sql
-- Если таблицы profiles ещё нет, базовый вариант:

create table profiles (
  id uuid primary key,
  email text not null,
  name text,
  locale text default 'ru' check (locale in ('ru', 'en', 'de', 'fr', 'es')),
  theme_preference text default 'system' check (theme_preference in ('system', 'light', 'dark')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

## Vehicles

```sql
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  number_raw text,
  number_normalized text not null,
  number_country text default 'RU',
  number_region text,
  name text,
  vehicle_type text,
  status text default 'active',
  last_odometer_value integer,
  last_odometer_at timestamp,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(company_id, number_normalized)
);
```

---

## Inspections

```sql
create table inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  inspector_id uuid not null,
  type text not null check (type in ('quick', 'planned', 'accident')),
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  result text check (result in ('ok', 'has_defects', 'requires_review')),
  started_at timestamp default now(),
  completed_at timestamp,
  latitude numeric,
  longitude numeric,
  vehicle_number_confirmed boolean default false,
  odometer_value integer,
  odometer_unit text default 'km' check (odometer_unit in ('km', 'mi')),
  odometer_value_km integer,
  odometer_photo_id uuid,
  odometer_confirmed_by uuid,
  odometer_confirmed_at timestamp,
  odometer_unavailable_reason text,
  accident_occurred_at timestamp,
  accident_place_text text,
  accident_latitude numeric,
  accident_longitude numeric,
  accident_location_source text check (accident_location_source in ('gps', 'manual', 'corrected')),
  accident_time_source text check (accident_time_source in ('manual', 'device', 'corrected')),
  accident_confirmed_by uuid,
  accident_confirmed_at timestamp,
  requires_review boolean default false,
  app_version text,
  device_id text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

---

## Photos

```sql
create table photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  inspection_id uuid references inspections(id) on delete cascade,
  defect_id uuid,
  photo_type text not null check (photo_type in (
    'front',
    'left_side',
    'right_side',
    'rear',
    'overall',
    'odometer',
    'number_plate',
    'undercarriage',
    'brake_system',
    'electrical',
    'lighting',
    'component_detail',
    'defect',
    'accident_overall',
    'accident_damage_close',
    'other'
  )),
  url text not null,
  thumbnail_url text,
  latitude numeric,
  longitude numeric,
  taken_at timestamp,
  uploaded_at timestamp default now(),
  source text default 'camera',
  hash text,
  file_size integer,
  mime_type text,
  created_at timestamp default now()
);
```

---

## Photo Requirements

```sql
create table photo_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  inspection_type text not null check (inspection_type in ('quick', 'planned', 'accident')),
  photo_type text not null,
  required boolean default true,
  min_count integer default 1,
  sort_order integer default 0,
  created_at timestamp default now()
);
```

---

## Checklist Templates

```sql
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  inspection_type text not null check (inspection_type in ('quick', 'planned', 'accident')),
  name text not null,
  version integer not null default 1,
  is_active boolean default true,
  created_at timestamp default now()
);
```

```sql
create table checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  template_id uuid not null references checklist_templates(id) on delete cascade,
  section_key text not null check (section_key in (
    'exterior',
    'undercarriage',
    'brake_system',
    'electrical',
    'lighting',
    'odometer',
    'accident_damage',
    'other'
  )),
  component_area text check (component_area in (
    'exterior',
    'undercarriage',
    'brake_system',
    'electrical',
    'lighting',
    'odometer',
    'accident_damage',
    'other'
  )),
  title text not null,
  description text,
  sort_order integer default 0,
  is_required boolean default true,
  requires_photo_on_fail boolean default true,
  created_at timestamp default now()
);
```

---

## Defects

```sql
create table defects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  inspection_id uuid references inspections(id) on delete cascade,
  inspection_item_id uuid,
  title text not null,
  description text,
  damage_area text,
  component_area text check (component_area in (
    'exterior',
    'undercarriage',
    'brake_system',
    'electrical',
    'lighting',
    'odometer',
    'accident_damage',
    'other'
  )),
  severity text,
  main_photo_id uuid,
  created_at timestamp default now()
);
```

---

## Odometer Recognitions

```sql
create table odometer_recognitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  inspection_id uuid references inspections(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  user_id uuid,
  photo_id uuid references photos(id) on delete set null,
  raw_text text,
  recognized_value integer,
  confidence numeric,
  provider text,
  confirmed boolean default false,
  confirmed_value integer,
  created_at timestamp default now()
);
```

---

## Vehicle Number Recognitions

```sql
create table vehicle_number_recognitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid,
  vehicle_id uuid references vehicles(id) on delete set null,
  inspection_id uuid references inspections(id) on delete set null,
  photo_id uuid references photos(id) on delete set null,
  image_url text,
  raw_text text,
  normalized_number text,
  confidence numeric,
  provider text,
  provider_region text check (provider_region in ('ru', 'eu', 'intl')),
  candidates_json jsonb,
  confirmed boolean default false,
  confirmed_number text,
  confirmed_by uuid,
  confirmed_at timestamp,
  error_code text,
  created_at timestamp default now()
);
```

---

## Indexes

```sql
create index idx_vehicles_company on vehicles(company_id);
create index idx_inspections_company on inspections(company_id);
create index idx_inspections_vehicle on inspections(vehicle_id);
create index idx_photos_company on photos(company_id);
create index idx_photos_inspection on photos(inspection_id);
create index idx_photos_type on photos(photo_type);
create index idx_defects_company on defects(company_id);
create index idx_defects_component_area on defects(component_area);
create index idx_checklist_template_items_section on checklist_template_items(section_key);
create index idx_odometer_recognitions_inspection on odometer_recognitions(inspection_id);
create index idx_vehicle_number_recognitions_company on vehicle_number_recognitions(company_id);
create index idx_vehicle_number_recognitions_normalized on vehicle_number_recognitions(company_id, normalized_number);
create index idx_vehicle_number_recognitions_confirmed on vehicle_number_recognitions(company_id, confirmed);

create index idx_inspections_accident_occurred_at on inspections(accident_occurred_at);
```

---

## Seed photo requirements

```sql
-- quick
-- front, left_side, right_side, rear, overall, odometer

-- planned
-- required: front, left_side, right_side, rear, overall, odometer
-- conditional: undercarriage, brake_system, electrical, lighting, component_detail, defect
-- planned checklist sections: exterior, undercarriage, brake_system, electrical, lighting, odometer

-- accident
-- required data: accident_occurred_at, accident_place_text
-- required photos: overall, front, left_side, right_side, rear, accident_overall, accident_damage_close
```

## Regional SQL additions

Добавить поля в `companies`:

```sql
alter table companies
add column region_code text not null default 'intl'
check (region_code in ('ru', 'eu', 'intl'));

alter table companies
add column data_residency text not null default 'international'
check (data_residency in ('russia', 'eu', 'international'));

alter table companies
add column api_cluster_key text;

alter table companies
add column storage_cluster_key text;

alter table companies
add column ocr_cluster_key text;

alter table companies
add column created_in_region_at timestamp default now();
```

Минимальная таблица для глобального tenant registry:

```sql
create table tenant_registry (
  tenant_id uuid primary key,
  slug text not null unique,
  public_name text not null,
  region_code text not null check (region_code in ('ru', 'eu', 'intl')),
  api_cluster_key text not null,
  status text not null default 'active' check (status in ('active', 'blocked', 'archived')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

Важно: `tenant_registry` не хранит персональные данные, фото, номера автомобилей, геоданные, данные ДТП и секреты.

Проверка региона должна выполняться на backend уровне, потому что обычный SQL check не знает текущий `APP_REGION` без отдельной настройки сессии.


-- Measurement units
-- company.distance_unit controls odometer unit for new inspections.
-- inspections.odometer_unit stores the unit snapshot for the inspection.
-- inspections.odometer_value_km stores normalized value for comparisons and analytics.
-- audit_logs.action can include: company_distance_unit_changed.


---

## Vehicle number OCR provider settings

```sql
-- OCR provider settings are stored in backend environment variables, not in SQL.
-- Example env names for .env.example only:
-- OCR_PROVIDER_RU=change-me
-- OCR_PROVIDER_EU=change-me
-- OCR_PROVIDER_INTL=change-me
```

Rules:

```txt
- provider_region must match companies.region_code;
- confirmed_number must be Latin-only;
- OCR results do not create inspections automatically;
- OCR provider tokens must never be stored in frontend/mobile.
```
