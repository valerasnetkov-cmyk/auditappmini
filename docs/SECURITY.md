# Security Policy

Документ описывает модель безопасности `auditappmini` и правила
реагирования на уязвимости.

## Поддерживаемые версии

| Контур | Версия | Поддержка |
|---|---|---|
| backend | `main` (текущая) | ✅ активная |
| web (Next.js) | `main` (текущая) | ✅ активная |
| mobile (Expo) | `main` (текущая) | ✅ активная |

Старые версии/теги не получают security-патчей — обновляйтесь до `main`.

## Как сообщить об уязвимости

- **Не создавайте публичный GitHub-issue** для security-находок.
- Пишите на [info@auditavto.ru](mailto:info@auditavto.ru).
- В теме письма укажите `[SECURITY]` и краткое описание.
- В теле: шаги воспроизведения, потенциальный impact, предложенный fix
  (если есть).
- Ответ в течение 5 рабочих дней. Координация disclosure — по договорённости.

## Безопасность runtime

### Backend (`backend/src/app.js`, `backend/src/server.js`)

- **JWT secret**: без `JWT_SECRET` backend **отказывается стартовать** в
  `NODE_ENV=production` (Epic 3.9). В dev генерируется случайный
  ephemeral secret с warning.
- **Слабые секреты блокируются**: `audit-secret-key-2024`,
  `dev-secret-change-in-production` и другие hardcoded значения
  запрещены в production.
- **CORS**: список разрешённых origin'ов читается из `CORS_ALLOWED_ORIGINS`
  (через запятую). Wildcard (`*`) запрещён в production.
- **Rate limit**: `createRateLimiter` (`backend/src/services/rateLimiter.js`)
  ограничивает попытки логина и другие чувствительные endpoint'ы. При
  заданном `REDIS_URL` limiter использует Redis/Lua для общего bucket на все
  backend replicas; без Redis деградирует в in-memory режим.
- **Security headers**: CSP, COOP, CORP, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy установлены глобально.
- **MFA**: TOTP-based, опционально для privileged ролей. Setup
  подтверждается через `POST /api/users/:id/mfa/enable`; старый
  `POST /api/users/:id/mfa/verify` временно сохранён как alias. Отключение MFA
  требует пароль текущего пользователя и валидный TOTP target user, если MFA
  уже включён.
- **Cookie session**: `audit_session` — `httpOnly`, `sameSite=lax`,
  `secure` в production.
- **Image upload**: проверка MIME + реального формата через `sharp` +
  лимит `MAX_IMAGE_PIXELS`.

### Web (Next.js)

- Все API-вызовы через `NEXT_PUBLIC_API_URL` (build-time), проверяется
  launch doctor'ом на placeholder-значения.
- `PUBLIC_REGISTRATION_ENABLED=false` по умолчанию.
- Owner setup-ссылки защищены одноразовым токеном.

### Mobile (Expo)

- Все API-вызовы через `EXPO_PUBLIC_API_URL` (build-time), проверяется
  launch doctor'ом.
- `mobile-app/` (legacy React Native) помечен как retired
  (см. `docs/mobile-app-retirement.md`).

## Безопасность данных

- **Логи паролей/tokens** — никогда не пишутся в лог. Все `console.log`
  прошли ручной аудит (`docs/audit-2026-06-02.md`).
- **SQLite БД** хранится в `backend/data/database.sqlite` (под
  `.gitignore`). Backup через `npm run backup:local` + verify через
  `npm run backup:verify`.
- **Uploads** хранятся в `backend/uploads/` (под `.gitignore`).
- **Runtime artifacts** (`.tmp-*`, `backend/data/`, `backend/uploads/`,
  `backend/backups/`) считаются локальным/операционным состоянием. Их cleanup
  выполняется на окружении, а не коммитится как изменение кода.
- **`.env*` файлы** под `.gitignore`; в репозитории только `.env.example`
  с пустыми placeholder-значениями.
- **Demo admin password**: `backend/.env.example` оставляет
  `ADMIN_PASSWORD=admin123` только для локального dev. Production doctor/config
  блокируют это значение.

## Безопасность CI/CD

- `npm audit --audit-level=moderate` запускается в
  `npm run audit:launch` (backend + web + mobile).
- GitHub Actions secrets читаются только в release-нотах и EAS
  workflows. Не логируются.

## Backlog (открытые security-задачи)

- **Refresh tokens / token rotation**: сейчас JWT живёт 7 дней без
  server-side revocation list (см. `CHANGELOG.md` § "Audit findings
  2026-05-27"). Следующий security epic должен отдельно спроектировать
  server-side session table, refresh-cookie flow, rotation и revocation.
- **CSP nonces**: текущая CSP использует `unsafe-inline` для совместимости;
  можно усилить nonce-based.
- **Encryption at rest**: БД и uploads не зашифрованы; для
  compliance-критичных деплоев нужен FDE/disk encryption на хосте.

## Связанные документы

- `CHANGELOG.md` § "Audit findings" — журнал security-находок и фиксов.
- `docs/audit-2026-06-02.md` — полный аудит от 2026-06-02.
- `docs/security-github.md` — правила безопасного хранения секретов в
  GitHub.
- `backend/.env.example` — обязательные переменные окружения.
