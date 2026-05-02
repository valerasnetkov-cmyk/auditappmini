# OCR Provider Architecture

## Назначение

Этот файл описывает заменяемую архитектуру OCR/ANPR-провайдеров для распознавания номера автомобиля.

Цель: mobile-приложение и web-интерфейс не должны зависеть от конкретного OCR-провайдера.

---

## Принцип

```txt
client -> backend API -> provider interface -> regional OCR / ANPR provider
```

Клиент всегда вызывает внутренний endpoint проекта:

```txt
POST /api/vehicle-number/recognize
```

Backend сам выбирает провайдера по региону компании.

---

## Поддерживаемые варианты

### Local OCR

Обычный OCR, который извлекает текст из фото. Подходит для MVP, но может хуже распознавать автомобильные номера.

### ANPR / LPR provider

Специализированный сервис распознавания автомобильных номеров. Предпочтителен, если обычный OCR даёт много ошибок.

### On-premise ANPR

Локально развёрнутый распознаватель в нужном регионе. Подходит для RU-контура и enterprise-клиентов.

### Mock provider

Тестовый провайдер для разработки и QA. Не должен использоваться в production.

---

## Provider interface

```ts
export type RegionCode = "ru" | "eu" | "intl";

export type PlateCandidate = {
  number: string;
  confidence?: number;
  region?: string;
};

export type RecognizePlateInput = {
  filePath: string;
  companyId: string;
  userId: string;
  regionCode: RegionCode;
};

export type RecognizePlateResult = {
  rawText: string;
  confidence?: number;
  provider: string;
  providerRegion: RegionCode;
  candidates: PlateCandidate[];
};

export interface PlateRecognitionProvider {
  recognize(input: RecognizePlateInput): Promise<RecognizePlateResult>;
}
```

---

## Regional provider registry

```ts
const providersByRegion: Record<RegionCode, PlateRecognitionProvider> = {
  ru: ruPlateRecognitionProvider,
  eu: euPlateRecognitionProvider,
  intl: intlPlateRecognitionProvider
};

export function getProviderForRegion(regionCode: RegionCode) {
  return providersByRegion[regionCode];
}
```

---

## Provider configuration

Настройки провайдера хранятся только в backend окружении.

```txt
OCR_PROVIDER_RU=local_anpr
OCR_PROVIDER_EU=external_anpr
OCR_PROVIDER_INTL=external_anpr
```

Важно: реальные токены, URL production endpoint'ов и секреты не должны попадать в git.

Для репозитория допускается только пример:

```txt
OCR_PROVIDER_RU=change-me
OCR_PROVIDER_EU=change-me
OCR_PROVIDER_INTL=change-me
```

---

## Security rules

```txt
- OCR API tokens хранятся только на backend.
- Frontend/mobile не знают ключей OCR-провайдера.
- Фото номера передаётся только в региональный OCR-контур.
- В audit_logs фиксируется факт распознавания, но не секреты.
- Ошибки провайдера логируются без токенов и приватных URL.
- Временные файлы удаляются после обработки, если они не сохранены как доказательное фото.
```

---

## Recommended MVP path

```txt
1. Создать backend endpoint /api/vehicle-number/recognize.
2. Сделать mock provider для локальной разработки.
3. Добавить simple OCR / ANPR provider для первого контура.
4. Вынести нормализацию и валидацию в shared-модуль.
5. Сохранять попытки в vehicle_number_recognitions.
6. Добавить подтверждение результата инспектором.
7. Подключить региональный выбор провайдера.
8. Позже заменить provider без изменения API и mobile UX.
```
