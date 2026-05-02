# Tenant Routing

## Цель

Определить, как приложение понимает, в каком регионе находится компания.

---

## Основной принцип

Tenant routing нужен для UX и выбора API, но не является источником доверия.

```txt
subdomain -> tenant slug -> region_code -> API base
```

---

## Tenant registry model

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

Поля, которые не должны быть в registry:

```txt
email
ФИО
номера автомобилей
фото
геоданные
место ДТП
комментарии
секреты
```

---

## Region codes

```txt
ru
 eu
intl
```

Для MVP можно начать с:

```txt
ru
intl
```

---

## Frontend flow

```txt
host = romashka.<project-domain>
slug = romashka
registry -> region_code = ru
apiBaseUrl = ru-api.<project-domain>
```

---

## Backend flow

Backend проверяет:

```txt
- пользователь авторизован;
- пользователь состоит в company_users;
- company_id соответствует текущему региону;
- данные запроса принадлежат этой company_id;
- роль пользователя позволяет действие.
```

---

## Mobile flow

В мобильном приложении пользователь после логина получает список компаний:

```json
[
  {
    "companyId": "...",
    "name": "Company name",
    "role": "inspector",
    "regionCode": "ru",
    "apiClusterKey": "ru-api"
  }
]
```

Если компания одна, приложение выбирает её автоматически. Если компаний несколько, пользователь выбирает компанию.

---

## Ошибки маршрутизации

Если tenant не найден:

```txt
company_not_found
```

Если регион недоступен:

```txt
region_unavailable
```

Если пользователь не состоит в компании:

```txt
tenant_access_denied
```

Если frontend пытается использовать API другого региона:

```txt
region_mismatch
```
