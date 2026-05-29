# Launch Checklist

This checklist is for the first controlled production/pilot launch of Auditmini.

Full release sequence: `docs/release-runbook.md`.
First production/staging start operator checklist: `docs/first-production-start.md`.
Production server command cheat sheet: `docs/production-server-commands.md`.
Legacy mobile-app removal record: `docs/mobile-app-retirement.md`.

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
- Run `npm run mobile:status` and confirm that `mobile/` is the active production mobile contour.
- Run `npm run mobile:eas:readiness` and confirm that `mobile/eas.json` has preview and production build profiles.
- Configure the same `EXPO_PUBLIC_API_URL` in EAS environment variables before cloud builds; local `mobile/.env.production` is not enough for EAS cloud builds.
- Run `npm run verify:launch` before publishing.
- Run `npm run doctor:production` against the backend/web/mobile production environment before starting or building release artifacts.
- Run `npm run release:readiness` and explicitly accept any remaining pilot risks before production start.
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
- Use the built-in resource-admin contour for companies, owners, tariffs and limits; Directus is not part of the pilot architecture.
- Confirm that legacy `mobile-app/` is absent from the production repository; use only `mobile/` for mobile builds.
- Build pilot mobile artifacts from `mobile/` with EAS: `npm run mobile:eas:preview:android` for an internal Android APK or `npm run mobile:eas:production` for store-ready platform builds.

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
- Active `web` and `mobile` codebases must pass their audit gates before release; attach the audit output to release evidence.
- Legacy `mobile-app/` has been removed from the production repository; choose `mobile/` as the active mobile codebase.
- Production backend startup intentionally fails when critical values such as `JWT_SECRET`, `TRUST_PROXY`, `DATABASE_PATH`, `UPLOAD_DIR`, `BACKUP_DIR`, wildcard CORS, public registration, disabled/invalid rate limits, or demo admin password are unsafe.
