# Resource-admin processes

Resource-admin является операционным центром сервиса, а не tenant UI.

## Разделы

```txt
/saas-admin
/saas-admin/dashboard
/saas-admin/companies
/saas-admin/companies/[id]
/saas-admin/plans
/saas-admin/payments
/saas-admin/alerts
/saas-admin/pilot-requests
/saas-admin/service-users
```

## Dashboard health center

Dashboard должен показывать service-level агрегаты:

- API readiness contract;
- Redis status;
- uploads status;
- backup manifest status;
- worker status: `idle`, `running`, `degraded` или `not_configured`;
- last billing scan, когда scanner начнёт писать evidence;
- subscription alerts;
- photo/PDF/mobile API quality counters без чтения tenant endpoints.

## Карточка компании

Карточка компании может показывать:

- сервисную сводку;
- владельца и setup-link;
- тарифы, лимиты, подписку, платежи;
- service notifications;
- audit log;
- support notes, следующий шаг и дату последнего контакта.

Важно: resource-admin не должен читать tenant endpoints техники, осмотров,
дефектов и фото. Все данные берутся из service-level агрегатов и SaaS-admin
таблиц.

## Permissions

`resource_manager` не имеет `company_id` и получает доступ через permissions:

```txt
companies.view
companies.manage
payments.view
payments.manage
plans.view
plans.manage
pilot_requests.view
pilot_requests.manage
service_messages.manage
team.manage
profile.manage
health.view
```
