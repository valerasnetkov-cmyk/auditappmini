# Backup and recovery runbook

Этот runbook описывает безопасную проверку локальных backup-снимков для пилотного запуска Auditmini.

В общем процессе релиза этот шаг выполняется по `docs/release-runbook.md`.

## Что сохраняет backup

Команда:

```powershell
npm run backup:local
```

создаёт timestamp-папку внутри `BACKUP_DIR` или `backend/backups` и копирует:

- SQLite базу в `database.sqlite`;
- каталог uploads в `uploads`;
- `manifest.json` с путями, флагами копирования, размером/хешем базы и статистикой файлов uploads.

Runtime-файлы (`DATABASE_PATH`, `UPLOAD_DIR`, `BACKUP_DIR`, generated reports,
release evidence, logs и worker queue state) не должны лежать в Git-tracked
каталогах релиза. Для пилота используйте persistent storage вне release
директории.

## Проверка последнего backup

После создания backup обязательно проверьте, что он читается:

```powershell
npm run backup:verify
```

Current implementation note: backup verification opens SQLite read-only through
`better-sqlite3` and runs `PRAGMA integrity_check`.

Проверка выполняет read-only операции:

- ищет последний backup с `manifest.json`;
- проверяет наличие `database.sqlite`;
- открывает SQLite read-only через `better-sqlite3`;
- запускает `PRAGMA integrity_check`;
- считает ключевые таблицы `companies`, `users`, `vehicles`, `inspections`, `defects`, `photos`, `company_limits`;
- проверяет каталог uploads, если manifest говорит, что uploads были скопированы.

## Проверка конкретного backup

```powershell
npm --prefix backend run backup:verify -- --backup-dir C:\Auditmini\backups\2026-05-22T10-00-00-000Z
```

Если backup лежит в нестандартном корне:

```powershell
npm --prefix backend run backup:verify -- --backup-root C:\Auditmini\backups --latest
```

Для строгой проверки, где uploads обязаны существовать:

```powershell
npm --prefix backend run backup:verify -- --backup-root C:\Auditmini\backups --latest --strict-uploads
```

## Перед пилотной миграцией

1. Остановите запись данных, если это возможно.
2. Выполните:

```powershell
npm run backup:local
npm run backup:verify
```

3. Сохраните JSON-вывод обеих команд в журнал релиза.
4. После миграции повторите backup и verify.

## Retention

Минимальная политика хранения для пилота:

- daily: 14 дней;
- weekly: 8 недель;
- monthly: 6 месяцев;
- pre-release: хранить отдельно до следующего стабильного релиза.

Перед каждым deploy, миграцией, массовым импортом техники или изменением
storage path создавайте отдельный backup и сохраняйте путь manifest в release
evidence.

## Восстановление

Восстановление пока выполняется вручную, чтобы не перезаписать рабочие данные случайной командой:

1. Остановите backend.
2. Скопируйте `database.sqlite` из выбранного backup в production `DATABASE_PATH`.
3. Скопируйте каталог `uploads` из backup в production `UPLOAD_DIR`.
4. Запустите:

```powershell
npm run doctor:production
npm run backup:verify -- --backup-dir <путь-к-использованному-backup>
```

5. Запустите backend и проверьте вход, список техники, карточку осмотра и фото.

Автоматический destructive restore-скрипт намеренно не добавлен на этом этапе: для пилота безопаснее иметь проверяемый backup и ручной restore под контролем администратора.

## Restore drill

Периодически проверяйте восстановление в отдельном временном каталоге:

1. взять последний backup;
2. развернуть SQLite и uploads во временные `DATABASE_PATH` / `UPLOAD_DIR`;
3. запустить backend на временной БД;
4. выполнить `PRAGMA integrity_check` через `npm run backup:verify`;
5. проверить login/demo, список техники, карточку осмотра, PDF metadata/download
   и наличие uploads;
6. записать результат в release evidence или daily audit.
