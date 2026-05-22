# Audit Tech Mobile

Активное мобильное приложение проекта находится в папке `mobile/`.

Legacy-папка `mobile-app/` удалена из production-репозитория; активный мобильный клиент теперь только `mobile/`.

## Что нужно перед запуском

1. Запустить backend из корня проекта:

```powershell
cd C:\Projects\Auditmini\auditappmini
npm --prefix backend run dev
```

Backend должен быть доступен на `http://localhost:3001`.

2. Настроить URL backend для мобильного приложения:

```powershell
cd C:\Projects\Auditmini\auditappmini\mobile
Copy-Item .env.example .env.local
```

Для Android emulator оставьте:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api
```

Для iOS simulator или web на этом же компьютере:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

Для физического телефона в той же Wi-Fi сети укажите LAN IP компьютера с backend:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api
```

IP на Windows можно посмотреть командой:

```powershell
ipconfig
```

Нужен IPv4-адрес активного Wi-Fi/Ethernet адаптера.

## Запуск

```powershell
cd C:\Projects\Auditmini\auditappmini\mobile
npm start
```

Дальше:

- нажмите `a` для Android emulator;
- отсканируйте QR-код Expo Go с телефона;
- или запустите native Android build:

```powershell
npm run android
```

Если меняли `.env.local`, перезапускайте Expo с очисткой cache:

```powershell
npx expo start --clear
```

## Проверки перед тестом

```powershell
npm run verify
```

Команда выполняет:

- TypeScript-проверку;
- проверку совместимости Expo-пакетов;
- `expo-doctor`.

Отдельно можно запустить:

```powershell
npm run typecheck
npm run install:check
npm run doctor
npm run audit:moderate
```

## Production env перед сборкой

Перед production build используйте отдельный env-файл:

```powershell
Copy-Item .env.production.example .env.production
```

В `mobile/.env.production` должен быть публичный HTTPS backend API:

```env
EXPO_PUBLIC_API_URL=https://api.<project-domain>/api
```

Проверьте env перед сборкой:

```powershell
npm run doctor:production
```

Production build нельзя выпускать с `localhost`, `10.0.2.2` или LAN IP — такие адреса подходят только для локальной разработки.

## Проверяемый MVP-flow

1. Войти пользователем backend.
2. Выбрать компанию.
3. Ввести или сфотографировать госномер.
4. Выбрать тип осмотра.
5. Для ДТП заполнить дату/место и при необходимости координаты.
6. Сделать все обязательные фото осмотра.
7. Для quick/scheduled указать одометр.
8. Заполнить чек-лист.
9. Для каждого дефекта добавить фото.
10. Завершить осмотр.

## Важные ограничения MVP

- OCR номера и одометра на backend пока работает как manual-confirmation placeholder: фото принимается, но реальный OCR-провайдер ещё не подключён.
- Mobile не должен подключаться к Directus напрямую; все операции идут через custom backend.
- Офлайн-очередь в `src/api.ts` подготовлена, но полноценная UI-синхронизация offline-first ещё не является частью P0.

## EAS build для пилота

Активный production mobile-контур собирается из этой папки: `C:\Projects\Auditmini\auditappmini\mobile`.
Папка `mobile-app/` удалена и не должна возвращаться в production evidence без отдельного решения владельца проекта.

Перед первой EAS-сборкой установите/авторизуйте Expo EAS CLI:

```powershell
npx eas-cli@latest login
```

Если проект ещё не привязан к Expo/EAS, выполните конфигурацию:

```powershell
npm run eas:configure
```

Для EAS cloud build значение `EXPO_PUBLIC_API_URL` нужно настроить в окружении EAS, а не полагаться только на локальный `.env.production`.
Production-значение должно быть публичным HTTPS URL backend API и заканчиваться на `/api`, например:

```env
EXPO_PUBLIC_API_URL=https://api.<project-domain>/api
```

Локальная структурная проверка EAS-контура:

```powershell
npm run eas:readiness
```

Preview Android APK для внутреннего пилота:

```powershell
npm run eas:preview:android
```

Production build для Android/iOS:

```powershell
npm run eas:production
```

После изменения `EXPO_PUBLIC_API_URL` мобильное приложение нужно пересобрать: public Expo env встраивается в JS bundle на этапе сборки.
