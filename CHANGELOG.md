# Changelog

Все заметные изменения проекта фиксируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed
- Карточка дефекта в web переписана без битой кодировки: теперь показывает данные ДТП, время осмотра, время фиксации дефекта, фото, историю статуса и связанные записи.
- Исправлены общие компоненты `Timeline` и `PhotoGallery`: русские подписи больше не отображаются mojibake, фото строят URL через backend base URL.
- Приведена логика российских госномеров к единому правилу: канонический формат в данных и UI теперь кириллический, например `А123ВС77` или `А123ВС177`.
- Backend и frontend принимают латинские аналоги `A, B, E, K, M, H, O, P, C, T, Y, X`, но нормализуют их в разрешенные кириллические символы `А, В, Е, К, М, Н, О, Р, С, Т, У, Х`.
- Исправлена миграция существующей SQLite-базы: при старте добавляются отсутствующие поля `created_at`, `company_id`, поля одометра, ДТП и дефектов.
- Исправлен backend smoke-сбой `/api/users`: существующая база без `users.created_at` теперь корректно обновляется при инициализации.
- Исправлена валидация ДТП-осмотров: неполные данные ДТП возвращают `400`, а не приводят к sql.js ошибке с `undefined`.
- Исправлены русские сообщения в маршрутах одометра, распознавания номера и завершения осмотра.
- Исправлены PM2 scripts: команды используют `ecosystem.config.cjs`, который совместим с ES module проектом.
- Audit logger теперь импортирует `crypto` явно и пишет `company_id` из текущего пользователя.

### Changed
- Demo-номера в seed-данных генерируются кириллицей.
- `/api/vehicles/resolve-number` ищет технику по кириллическому каноническому номеру.
- OCR/ANPR endpoints остаются MVP-заглушками и требуют ручного подтверждения инспектором.
- Проверка планового осмотра теперь считает незаполненными только пункты без результата, а не пункты с результатом `false`, потому что `false` означает выявленный дефект.

### Verified
- `npm run verify` проходит полностью: backend smoke и production build frontend.

## [1.0.0] - 2024-05-XX

### Added
- Initial release of Audit Tech application.
- Vehicle inspection and defect tracking system.
- QR code based vehicle identification.
- Multi-role user support.
- Photo documentation for inspections and defects.
- Odometer tracking.
- Analytics dashboard.
