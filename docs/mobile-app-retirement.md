# mobile-app removal record

`mobile-app/` was a legacy Expo/React Native contour and is no longer part of the production repository.

## Current state

- Active mobile application: `mobile/`.
- Active mobile env example: `mobile/.env.production.example`.
- Active mobile doctor: `npm --prefix mobile run doctor:production`.
- Active mobile verify gate: `npm --prefix mobile run verify`.
- Active EAS readiness gate: `npm run mobile:eas:readiness`.
- Root launch gates use only `mobile/` through `verify:mobile`, `doctor:production` and `audit:mobile`.

## Removal

Removed on 2026-05-22 after project owner confirmation.

Deleted legacy paths included:

- `mobile-app/package.json`;
- `mobile-app/package-lock.json`;
- `mobile-app/App.tsx`;
- `mobile-app/src/`;
- `mobile-app/auditauto/`;
- `mobile-app/app.json`;
- `mobile-app/eas.json`;
- `mobile-app/README.md`;
- ignored local folders such as `mobile-app/node_modules/` and `mobile-app/.expo/`.

## Rule going forward

Do not restore `mobile-app/` into the production repository unless there is a separate owner-approved migration plan.

For mobile builds, release evidence and EAS configuration, use only `mobile/`.
