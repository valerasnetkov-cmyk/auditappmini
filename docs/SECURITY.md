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
- Пишите на security@auditappmini.example (placeholder — замените на
  реальный адрес перед публичным релизом).
- В теме письма укажите `[SECURITY]` и краткое описание.
- В теле: шаги воспроизведения, потенциальный impact, предложенный fix
  (если есть).
- Ответ в течение 5 рабочих дней. Координация disclosure — по договорённости.

## Безопасность runtime

### Backend (`backend/src/server.js`)

- **JWT secret**: без `JWT_SECRET` backend **отказывается стартовать** в
  `NODE_ENV=production` (Epic 3.9). В dev генерируется случайный
  ephemeral secret с warning.
- **Слабые секреты блокируются**: `audit-secret-key-2024`,
  `dev-secret-change-in-production` и другие hardcoded значения
  запрещены в production.
- **CORS**: список разрешённых origin'ов читается из `CORS_ALLOWED_ORIGINS`
  (через запятую). Wildcard (`*`) запрещён в production.
- **Rate limit**: `createRateLimiter` (server.js) ограничивает попытки
  логина и другие чувствительные endpoint'ы. **Текущая реализация —
  локальная Map**; не работает при multi-replica (см. Epic 3.2).
- **Security headers**: CSP, COOP, CORP, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy установлены глобально.
- **MFA**: TOTP-based, опционально для privileged ролей.
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
- **`.env*` файлы** под `.gitignore`; в репозитории только `.env.example`
  с пустыми placeholder-значениями.

## Безопасность CI/CD

- `npm audit --audit-level=moderate` запускается в
  `npm run audit:launch` (backend + web + mobile).
- GitHub Actions secrets читаются только в release-нотах и EAS
  workflows. Не логируются.

## Backlog (открытые security-задачи)

- **Epic 3.2**: распределённый rate limit (Redis) — текущий локальный
  обходится при multi-replica.
- **Refresh tokens / token rotation**: сейчас JWT живёт 7 дней без
  revocation list (см. `CHANGELOG.md` § "Audit findings 2026-05-27").
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
