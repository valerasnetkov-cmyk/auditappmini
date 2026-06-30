# Client success and support

## Pilot funnel

```txt
Заявка на пилот
  -> квалификация
  -> создание компании
  -> owner setup
  -> онбординг
  -> первые осмотры
  -> проверка отчётов
  -> обратная связь
  -> платный тариф или следующий период пилота
```

## Qualification checklist

- название компании, регион, контактное лицо;
- email и телефон;
- размер автопарка;
- кто будет владельцем кабинета;
- кто будет проводить осмотры;
- текущий процесс осмотров;
- есть ли спорные фото/дефекты/пробег;
- готовность установить active Expo mobile app.

## Typical support checks

- **Не входит в систему**: email, роль, setup-link, MFA, session cookie,
  статус компании, статус подписки.
- **Не создаётся осмотр**: mobile app, активность компании, тариф, лимиты,
  backend readiness, `EXPO_PUBLIC_API_URL`.
- **Фото не загрузились**: mobile draft, сеть, размер, MIME/sharp validation,
  upload dir/storage, future worker-photo.
- **PDF не скачивается**: completed status, PDF status, integrity status,
  SHA-256, file size, storage path.
- **Тариф заблокировал работу**: subscription status, payments, grace period,
  alerts, billing scanner evidence.

## Pilot success metrics

```txt
first_login_at
first_vehicle_created_at
first_inspection_started_at
first_inspection_completed_at
first_pdf_generated_at
active_inspectors_count
inspections_count_7d
photo_upload_failures
open_critical_defects
subscription_status
support_tickets_count
```

Первый безопасный слой resource-admin support center уже доступен в web-карточке
компании: внутренние support notes, следующий шаг и дата последнего контакта
сохраняются через существующий admin update/details контракт и не требуют чтения
tenant endpoints. Остальные метрики остаются целевыми для следующего этапа.
