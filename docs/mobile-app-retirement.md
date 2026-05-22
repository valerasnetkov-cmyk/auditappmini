# mobile-app retirement note

`mobile-app/` сейчас не является рабочим production-контуром Auditmini.

Активный мобильный контур:

- каталог: `mobile/`;
- production env: `mobile/.env.production`;
- doctor: `npm --prefix mobile run doctor:production`;
- verify: `npm --prefix mobile run verify`;
- audit gate: `npm --prefix mobile audit --audit-level=moderate`;
- root status report: `npm run mobile:status`;
- root launch gate использует именно `mobile/` через `verify:mobile`, `doctor:production` и `audit:mobile`.

`mobile-app/` — legacy Expo-контур:

- `expo` `^48.0.0`;
- `react-native` `0.71.6`;
- отсутствуют launch doctor / verify scripts;
- `npm --prefix mobile-app audit --audit-level=moderate` показывает dependency advisories;
- root `verify`, `verify:launch`, `doctor:production`, `audit:launch` его не используют.

## Рекомендация

Для первого controlled pilot/production запуска:

1. использовать только `mobile/`;
2. не собирать и не публиковать `mobile-app/`;
3. оставить `mobile-app/` вне production evidence, кроме явной пометки, что это legacy-контур;
4. после подтверждения владельца проекта удалить `mobile-app/` отдельным cleanup-коммитом или перенести в архив вне production repo.

## Перед удалением `mobile-app/`

Проверьте:

- нет ли уникальных экранов/логики, которые нужны и отсутствуют в `mobile/`;
- нет ли внешних build jobs, EAS projects или ссылок на `mobile-app/`;
- README/root docs не ссылаются на `mobile-app/` как на активный клиент;
- release notes явно говорят, что активный мобильный клиент — `mobile/`.

После этого безопасный cleanup может удалить:

- `mobile-app/package.json`;
- `mobile-app/package-lock.json`;
- `mobile-app/App.tsx`;
- `mobile-app/src/`;
- `mobile-app/auditauto/`;
- `mobile-app/app.json`;
- `mobile-app/eas.json`;
- `mobile-app/README.md`;
- остальные файлы внутри `mobile-app/`.

Удаление не должно менять root launch scripts, потому что они уже направлены на `mobile/`.
