# Audit Tech Mobile

Активное мобильное приложение проекта находится в папке `mobile/`.

Старая папка `mobile-app/` сейчас считается legacy: она не используется как основной мобильный клиент и требует отдельной миграции, если её нужно сохранить.

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
