# Аудит техники

Система независимой фотофиксации состояния техники с историей осмотров, дефектов и подтверждающими материалами.

Проект предназначен для быстрого контроля состояния техники: инспектор проводит осмотр, фиксирует результаты чек-листа, прикладывает фото, а руководитель видит историю осмотров и дефектов через веб-интерфейс.

---

## Статус проекта

Текущий статус: **MVP / прототип**.

Основной фокус проекта:

- быстрая фиксация состояния техники;
- фото-доказательства;
- история осмотров;
- фиксация дефектов;
- минимальная веб-панель для просмотра техники, осмотров и дефектов.

---

## Основная логика продукта

Главный процесс:

```txt
Осмотр → Фиксация → Дефекты → История
```

### Роли

- **Inspector** — проводит осмотры, фиксирует дефекты и фото.
- **Manager** — просматривает технику, осмотры, дефекты и статистику.

### Правила MVP

- Любой ответ `НЕТ` в чек-листе считается дефектом.
- Дефект должен быть связан с фото.
- Осмотр нельзя завершить без обязательных фото.
- Фото должны фиксироваться через камеру.
- Для фото и осмотра сохраняются дата, время и геоданные.

---

## Технологии

### Backend

- Node.js
- Express
- SQLite

### Frontend

- Next.js
- React
- TypeScript

### Mobile

В проекте присутствуют мобильные прототипы:

- `mobile/` — Flutter-прототип;
- `mobile-app/` — Expo / React Native клиент.

---

## Требования

- Node.js 18+
- npm 9+

---

## Установка и запуск

### Backend

```bash
cd backend
npm install
npm start
```

Backend по умолчанию запускается на:

```txt
http://localhost:3001
```

API доступно по адресу:

```txt
http://localhost:3001/api
```

---

### Frontend

```bash
cd web
npm install
npm run dev
```

Frontend запускается на порту, указанном в настройках Next.js.

---

## Проверка backend

Из папки `backend` можно запустить smoke-тесты:

```bash
cd backend
npm run smoke
npm run smoke:auth
npm run smoke:vehicles
npm run smoke:inspections
npm run smoke:analytics
```

Также можно запустить общую проверку из корня проекта:

```bash
npm run verify
```

---

## Демо-данные

После запуска backend можно создать тестовые данные через seed API:

```bash
curl -X POST http://localhost:3001/api/seed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <manager-jwt>" \
  -d '{"vehicles":30,"inspections":50}'
```

Также seed можно запускать через UI под учётной записью пользователя с ролью руководителя.

### Демо-пользователи

| Email | Роль |
|------|------|
| admin@example.com | Manager |
| demo_inspector_1@example.com | Inspector |
| demo_inspector_2@example.com | Inspector |
| demo_manager@example.com | Manager |

Пароли демо-пользователей не публикуются в README.  
Используйте локальные seed/config-файлы или переменные окружения для настройки тестовых учётных записей.

---

## Структура проекта

```txt
auditappmini/
├── backend/              # Node.js + Express + SQLite
│   ├── src/
│   │   ├── db.js         # Работа с базой данных
│   │   └── server.js     # API-сервер
│   └── package.json
│
├── web/                  # Next.js frontend
│   ├── src/
│   │   ├── app/          # Страницы приложения
│   │   └── lib/          # API-клиент и вспомогательная логика
│   └── package.json
│
├── mobile/               # Flutter-прототип
├── mobile-app/           # Expo / React Native клиент
├── scripts/              # Вспомогательные скрипты
├── product.md            # Описание продукта
├── backend.md            # Backend-спецификация
├── web.md                # Web-спецификация
├── mobile.md             # Mobile-спецификация
├── data-model.md         # Модель данных
└── README.md
```

---

## API Endpoints

### Auth

| Метод | Endpoint | Описание |
|------|----------|----------|
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь |

---

### Vehicles

| Метод | Endpoint | Описание |
|------|----------|----------|
| GET | `/api/vehicles` | Список техники |
| GET | `/api/vehicles/:id` | Карточка техники |
| POST | `/api/vehicles` | Создать технику |
| PUT | `/api/vehicles/:id` | Обновить технику |
| DELETE | `/api/vehicles/:id` | Удалить технику |

---

### Inspections

| Метод | Endpoint | Описание |
|------|----------|----------|
| GET | `/api/inspections` | Список осмотров |
| GET | `/api/inspections/:id` | Детали осмотра |
| GET | `/api/vehicles/:id/inspections` | Осмотры конкретной техники |
| POST | `/api/inspections` | Создать осмотр |

---

### Defects

| Метод | Endpoint | Описание |
|------|----------|----------|
| GET | `/api/defects` | Список дефектов |
| POST | `/api/defects/:id/photos` | Загрузить фото дефекта |

---

### Dashboard

| Метод | Endpoint | Описание |
|------|----------|----------|
| GET | `/api/dashboard/stats` | Статистика |

---

## Переменные окружения

### Backend

Создайте файл `backend/.env` на основе `backend/.env.example`.

Пример:

```bash
PORT=3001
JWT_SECRET=change-me-for-production
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

Важно: не коммитьте `.env` в репозиторий.

---

### Frontend

Создайте файл `web/.env.local` на основе `web/.env.example`.

Пример:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Важно: не коммитьте `.env.local` в репозиторий.

---

## Безопасность

В публичный репозиторий нельзя добавлять:

```txt
.env
.env.local
JWT_SECRET
API keys
Supabase service keys
database.sqlite
node_modules/
.next/
uploads/
*.log
```

Если секреты уже были опубликованы, их нужно заменить, даже если файлы потом были удалены из репозитория.

---

## Документация

В проекте есть отдельные документы:

- `product.md` — продуктовая логика и бизнес-правила;
- `backend.md` — backend-структура и API;
- `web.md` — веб-интерфейс;
- `mobile.md` — мобильный сценарий;
- `data-model.md` — модель данных;
- `supabase-setup.sql` — черновая SQL-схема для Supabase.

---

## Лицензия

Проект находится в разработке. Лицензия будет определена позже.