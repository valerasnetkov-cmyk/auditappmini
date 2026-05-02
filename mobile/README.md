# Flutter App - Аудит Техники

Мобильное приложение для инспекторов.

## Требования

- Flutter 3.x
- Dart 3.x

## Установка

1. Клонировать репозиторий
2. Перейти в папку mobile
3. Запустить `flutter pub get`
4. Настроить Supabase: обновить `lib/supabase_config.dart` с URL и ключом вашего проекта
5. Запустить `flutter run`

## Структура проекта

```
lib/
├── main.dart              # Точка входа
├── app.dart               # Конфигурация приложения
├── supabase_config.dart   # Настройки Supabase
├── blocs/                 # BLoC состояния
│   └── auth/              # Авторизация
├── repositories/          # Репозитории данных
├── screens/               # Экраны
│   ├── splash_screen.dart
│   ├── login_screen.dart
│   ├── home_screen.dart
│   ├── inspection/
│   │   ├── inspection_screen.dart
│   │   ├── checklist_screen.dart
│   │   └── photo_screen.dart
│   └── vehicle/
│       └── vehicle_detail_screen.dart
```

## Зависимости

- supabase_flutter - работа с Supabase
- flutter_bloc - управление состоянием
- camera / image_picker - работа с камерой
- mobile_scanner - QR сканер
- geolocator - определение геолокации

## Следующие шаги

1. Настроить Supabase проект (SQL из корневой папки)
2. Добавить Android/iOS permissions для камеры и геолокации
3. Реализовать офлайн режим
4. Добавить реальную камеру и геолокацию