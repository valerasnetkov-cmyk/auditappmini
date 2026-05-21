# Launch Checklist

This checklist is for the first controlled production/pilot launch of Auditmini.

Full release sequence: `docs/release-runbook.md`.
First production/staging start operator checklist: `docs/first-production-start.md`.

## Required Before Pilot

- Set production environment variables outside the repository.
- Copy `backend/.env.production.example`, `web/.env.production.example` and `mobile/.env.production.example` to private env files or secret manager values and follow `docs/production-env.md`.
- Use a strong `JWT_SECRET`; never use the development fallback.
- Keep `PUBLIC_REGISTRATION_ENABLED=false` in production; company users must be created by the company owner.
- Set `TRUST_PROXY` explicitly and keep sensitive endpoint rate limits enabled.
- Keep `GRACEFUL_SHUTDOWN_TIMEOUT_MS` configured so PM2/redeploy stops do not abort active requests immediately.
- Keep `REQUEST_ID_HEADER=x-request-id`, `ACCESS_LOG_FORMAT=json` and `ACCESS_LOG_SKIP_PATHS=/health,/api/health` for production diagnostics without noisy health-check logs.
- Set `DATABASE_PATH` to a persistent disk path.
- Set `UPLOAD_DIR` to a persistent disk path.
- Set `BACKUP_DIR` to a persistent disk path outside the app release folder.
- Set `CORS_ORIGINS` to the real web origin list.
- Set `NEXT_PUBLIC_API_URL` in the web environment to the production API URL.
- Set `EXPO_PUBLIC_API_URL` in the mobile build environment to the production API URL.
- Run `npm run verify:launch` before publishing.
- Run `npm run doctor:production` against the backend/web/mobile production environment before starting or building release artifacts.
- Run `npm run release:first-start` to print the ordered first-start checklist for the operator.
- Run `npm --prefix backend run backup:local` before and after pilot data migration.
- Run `npm --prefix backend run backup:verify` after every pilot backup; see `docs/backup-restore.md`.
- Run `npm run release:evidence` after release checks and store the generated JSON outside Git.
- Confirm that `backend/backups`, `backend/data`, uploads, `.env`, and logs are not committed.

## Recommended Infrastructure

- Put the backend behind HTTPS reverse proxy.
- Keep backend security headers and HSTS enabled for the public API.
- Confirm deploy tooling sends `SIGTERM`/`SIGINT` and gives the backend at least `GRACEFUL_SHUTDOWN_TIMEOUT_MS` to stop gracefully.
- Forward `X-Request-Id` from the reverse proxy to backend and include it in proxy/application logs.
- Configure PM2 log rotation for backend logs, for example `npm --prefix backend run pm2:logrotate:install` and `npm --prefix backend run pm2:logrotate:configure`.
- Configure backend monitoring against `/api/health/ready`; use `/health` only as a lightweight liveness probe.
- Serve the web app on HTTPS.
- Store SQLite and uploads on persistent volume for pilot mode.
- Configure automated backups for database and uploads, plus scheduled backup verification.
- Keep Directus optional; the backend must work when Directus is not configured.
- Keep `mobile-app` out of production until its dependency tree is upgraded or the folder is retired.

## Manual UAT

- Login as admin, manager, and inspector.
- Create and edit users.
- Import vehicles from Excel.
- Add, edit, merge, and delete regions.
- Create vehicle manually with Russian license plate validation.
- Run quick, scheduled, and accident inspections.
- Upload defect photos.
- Confirm odometer entry.
- Open vehicle defect history and defect detail.
- Verify dashboard and analytics.
- Verify another company cannot access existing vehicles, users, regions, inspections, defects, or odometer endpoints.

## Known Launch Risks

- SQLite is acceptable for a controlled pilot, but PostgreSQL is recommended for multi-company production.
- Local uploads are acceptable only with persistent volume and backups.
- Web audit still reports a moderate PostCSS advisory inside the current Next.js dependency tree; `npm audit fix --force` proposes a breaking downgrade and should not be used blindly.
- `mobile-app` currently has high-severity dependency advisories; choose `mobile` as the active mobile codebase or schedule a dedicated upgrade.
- Production backend startup intentionally fails when critical values such as `JWT_SECRET`, `TRUST_PROXY`, `DATABASE_PATH`, `UPLOAD_DIR`, `BACKUP_DIR`, wildcard CORS, public registration, disabled/invalid rate limits, or demo admin password are unsafe.
