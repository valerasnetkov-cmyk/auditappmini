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

## Проверка последнего backup

После создания backup обязательно проверьте, что он читается:

```powershell
npm run backup:verify
```

Проверка выполняет read-only операции:

- ищет последний backup с `manifest.json`;
- проверяет наличие `database.sqlite`;
- открывает SQLite через `sql.js`;
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
