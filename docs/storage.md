# Storage

## Цель

Фото являются доказательной частью продукта. Хранение должно быть структурированным, изолированным по компании и безопасным.

---

## Принцип

Все файлы хранятся с учётом `company_id`.

```txt
photos/{company_id}/{vehicle_id}/{inspection_id}/{photo_type}/{file_name}
```

---

## Примеры путей

```txt
photos/company-id/vehicle-id/inspection-id/front/photo-id.jpg
photos/company-id/vehicle-id/inspection-id/left_side/photo-id.jpg
photos/company-id/vehicle-id/inspection-id/right_side/photo-id.jpg
photos/company-id/vehicle-id/inspection-id/rear/photo-id.jpg
photos/company-id/vehicle-id/inspection-id/overall/photo-id.jpg
photos/company-id/vehicle-id/inspection-id/odometer/photo-id.jpg
photos/company-id/vehicle-id/inspection-id/accident_damage_close/photo-id.jpg
```

---

## Типы фото

```txt
front
left_side
right_side
rear
overall
odometer
number_plate
defect
accident_overall
accident_damage_close
other
```

---

## Метаданные

В таблице `photos` сохраняются:

```txt
company_id
vehicle_id
inspection_id
defect_id
photo_type
url
thumbnail_url
latitude
longitude
taken_at
uploaded_at
source
hash
file_size
mime_type
```

---

## Фото одометра

Фото одометра хранится как обычное фото с типом `odometer`, но дополнительно связывается с полями осмотра:

```txt
inspections.odometer_photo_id
odometer_recognitions.photo_id
```

---

## Фото ДТП

Для ДТП используются два ключевых типа:
Место и время ДТП не хранятся в пути файла. Они сохраняются в карточке осмотра, чтобы не смешивать бизнес-данные с URL/путями файлов.


```txt
accident_overall      -> общий план повреждения
accident_damage_close -> крупный план повреждённого участка
```

Если повреждений несколько, загружается несколько фото `accident_damage_close`.

---

## Доступ к фото

Фото не должны быть публичными без проверки доступа.

Backend или storage policy проверяет:

```txt
user_id -> company_users -> company_id -> photos.company_id
```

---

## Что не хранить в репозитории

```txt
uploads/
real photos
photo dumps
storage keys
signed URLs
production buckets
```

---

## Что не делать

- Не хранить фото в GitHub.
- Не делать общий публичный bucket без проверки доступа.
- Не смешивать фото разных компаний в одном пути без `company_id`.
- Не удалять оригинал фото после OCR.

## Технические фото планового осмотра

Для планового осмотра технические фото сохраняются с типами:

```txt
undercarriage
brake_system
electrical
lighting
component_detail
```

Рекомендуемый путь:

```txt
photos/{company_id}/{vehicle_id}/{inspection_id}/{photo_type}/{file_name}
```

Примеры:

```txt
photos/company-id/vehicle-id/inspection-id/undercarriage/photo.jpg
photos/company-id/vehicle-id/inspection-id/brake_system/photo.jpg
photos/company-id/vehicle-id/inspection-id/lighting/photo.jpg
```

Техническое фото не должно быть обязательным для каждого пункта планового осмотра. Оно обязательно при дефекте или требовании регламента.

## Regional storage

Storage bucket должен быть региональным.

```txt
RU company -> RU bucket
EU company -> EU bucket
INTL company -> INTL bucket
```

Путь внутри bucket остаётся прежним:

```txt
photos/{company_id}/{vehicle_id}/{inspection_id}/{photo_type}/{file_name}
```

Нельзя использовать один общий bucket для всех регионов.

Не допускается отправка фото в OCR другого региона.

Backup фото хранится в том же регионе, что и основной bucket.

## Метаданные одометра и единицы измерения

Фото одометра хранится отдельно от числового значения. Единица измерения не извлекается из пути файла, а хранится в карточке осмотра:

```txt
inspection.odometer_value
inspection.odometer_unit
inspection.odometer_value_km
```

Storage не должен быть источником истины для значения пробега.

---

## Фото номера для OCR

Фото номера может храниться как доказательное фото с типом:

```txt
number_plate
```

Рекомендуемый путь:

```txt
photos/{region_code}/{company_id}/{vehicle_id}/{inspection_id}/number_plate/{photo_id}.jpg
```

Если фото используется только для временного OCR и не нужно как доказательство, оно должно быть удалено после обработки. Решение о хранении зависит от политики компании и региона.
