# GitHub Security

## Цель

Документ описывает, какие данные нельзя публиковать в репозитории и как подготовить проект к безопасной публикации.

---

## Нельзя коммитить

```txt
.env
.env.local
.env.production
.env.staging
*.sqlite
*.db
node_modules/
.next/
dist/
build/
uploads/
logs/
*.log
coverage/
.DS_Store
```

---

## Нельзя публиковать секреты

```txt
JWT secrets
auth secrets
API keys
Supabase service keys
database URLs
storage secrets
private keys
access tokens
refresh tokens
real user passwords
real production domains
real client domains
OCR / ANPR service keys
external recognition provider tokens
```

---

## Что можно хранить

```txt
.env.example
README.md
docs/*.md
safe SQL schema without credentials
example config with placeholders
```

---

## Пример безопасного placeholder

```txt
DATABASE_URL=
AUTH_SECRET=
STORAGE_BUCKET=
PROJECT_DOMAIN=
```

Не указывать реальные значения.

---

## Если секрет уже попал в GitHub

Нужно:

1. заменить секрет в сервисе-источнике;
2. удалить секрет из текущих файлов;
3. при необходимости очистить историю репозитория;
4. проверить CI/CD и окружения;
5. считать старый секрет скомпрометированным.

Удаление файла из последнего коммита не делает секрет безопасным, если он уже был в истории.

---

## Данные клиентов

В репозиторий нельзя добавлять:

- реальные номера техники клиентов;
- реальные фото осмотров;
- реальные дефекты;
- реальные имена пользователей;
- реальные названия компаний, если проект публичный;
- выгрузки базы данных.

---

## Минимальный .gitignore

```txt
.env
.env.*
!.env.example
node_modules/
.next/
dist/
build/
uploads/
logs/
*.log
*.sqlite
*.db
coverage/
.DS_Store
```

---

## Перед публикацией проверить

- нет ли `.env` файлов;
- нет ли SQLite-базы;
- нет ли uploads с фото;
- нет ли реальных доменов и URL;
- нет ли ключей Supabase или других сервисов;
- нет ли demo-паролей;
- нет ли персональных данных.


---

## CSS и безопасность

CSS-файлы не должны содержать:

- реальные production-ссылки;
- названия реальных клиентов, если репозиторий публичный;
- токены;
- ключи;
- tenant-specific данные;
- приватные пути storage.

Стили должны быть общими и безопасными для публикации в репозитории.

---

## Фото осмотров и одометра

В репозиторий нельзя добавлять реальные фото осмотров, фото ДТП, фото одометра и датасеты распознавания. Для тестов допускаются только искусственные или обезличенные примеры без персональных и коммерческих данных.

---

## Theme safety

Настройки темы не являются секретами, но в CSS и theme config нельзя хранить:

- реальные production URL;
- названия закрытых клиентов, если репозиторий публичный;
- tenant-specific ключи;
- приватные пути к файлам;
- любые токены или service keys.

Для публичного репозитория допустимы только нейтральные theme tokens и примерные значения цветов.

## Regional security rules

В репозиторий нельзя добавлять:

```txt
реальные региональные API URLs
реальные tenant mappings
реальные домены клиентов
storage endpoints с ключами
OCR endpoints с ключами
backup endpoints
region-specific secrets
```

В документации можно использовать только placeholder-формат:

```txt
ru-api.<project-domain>
eu-api.<project-domain>
intl-api.<project-domain>
```

Глобальный tenant registry не должен содержать персональные данные и рабочие данные осмотров.

---

## OCR / ANPR security

```txt
- OCR API tokens хранятся только на backend.
- OCR токены не попадают в frontend, mobile, README и публичные md-файлы.
- В git допускаются только placeholder-значения в .env.example.
- Логи не должны содержать OCR tokens, signed URLs и приватные endpoint'ы.
- Фото номера обрабатывается только в регионе компании.
- Временные файлы OCR удаляются после обработки, если они не сохранены как доказательные фото.
```
