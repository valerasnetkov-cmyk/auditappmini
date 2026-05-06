# Directus collections

Минимальная схема для CMS/Data Studio слоя. Это описание для ручной настройки MVP через Directus Studio; автоматические миграции Directus можно добавить следующим шагом.

## companies

- `id` - uuid, primary key.
- `name` - string, required.
- `type` - enum: `insurance`, `leasing`.
- `country` - string.
- `region` - string.
- `settings` - json.
- `created_at` - datetime.

## vehicles

- `id` - uuid, primary key.
- `company_id` - many-to-one -> `companies.id`.
- `plate_number` - string, required.
- `vin` - string.
- `brand` - string.
- `model` - string.
- `year` - integer.
- `status` - enum: `active`, `inactive`, `repair`, `archived`.
- `created_at` - datetime.

## accident_cases

- `id` - uuid, primary key.
- `company_id` - many-to-one -> `companies.id`.
- `vehicle_id` - many-to-one -> `vehicles.id`.
- `case_number` - string, required.
- `source_inspection_id` - string, id осмотра в custom backend.
- `accident_date` - date.
- `accident_time` - time.
- `accident_geo` - json.
- `accident_address` - string.
- `accident_type` - string.
- `status` - enum: `draft`, `photo_required`, `submitted`, `review`, `need_more_data`, `closed`.
- `comment` - text.
- `created_at` - datetime.

## accident_participants

- `id` - uuid, primary key.
- `accident_case_id` - many-to-one -> `accident_cases.id`.
- `type` - enum: `owner`, `driver`, `second_party`, `witness`.
- `name` - string.
- `phone` - string.
- `vehicle_number` - string.
- `comment` - text.

## damages

- `id` - uuid, primary key.
- `accident_case_id` - many-to-one -> `accident_cases.id`.
- `source_inspection_id` - string, id осмотра в custom backend.
- `source_defect_id` - string, id дефекта в custom backend.
- `vehicle_zone` - string.
- `description` - text.
- `severity` - enum: `low`, `medium`, `high`, `critical`.
- `photo_id` - many-to-one -> `photos.id`.
- `created_at` - datetime.

## photos

- `id` - uuid, primary key.
- `accident_case_id` - many-to-one -> `accident_cases.id`.
- `damage_id` - many-to-one -> `damages.id`.
- `source_inspection_id` - string, id осмотра в custom backend.
- `source_defect_id` - string, id дефекта в custom backend.
- `source_photo_id` - string, id фото в custom backend.
- `type` - string.
- `url` - string, required.
- `geo` - json.
- `device_time` - datetime.
- `server_time` - datetime.
- `hash` - string.
- `created_at` - datetime.

## odometer_recognitions

- `id` - uuid, primary key.
- `accident_case_id` - many-to-one -> `accident_cases.id`.
- `photo_id` - many-to-one -> `photos.id`.
- `recognized_value` - integer.
- `confirmed_value` - integer.
- `confirmed_by_user` - boolean.
- `created_at` - datetime.

## plate_recognitions

- `id` - uuid, primary key.
- `accident_case_id` - many-to-one -> `accident_cases.id`.
- `photo_id` - many-to-one -> `photos.id`.
- `recognized_plate` - string.
- `confirmed_plate` - string.
- `confirmed_by_user` - boolean.
- `created_at` - datetime.

## fraud_checks

- `id` - uuid, primary key.
- `accident_case_id` - many-to-one -> `accident_cases.id`.
- `check_type` - string.
- `result` - enum: `passed`, `warning`, `failed`, `manual_review`.
- `score` - decimal.
- `details` - json.
- `created_at` - datetime.
