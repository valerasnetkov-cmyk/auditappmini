# Vehicle Number Recognition

## Назначение

Этот файл описывает реализацию распознавания автомобильного номера по фото.

Функция распознавания номера является вспомогательной. Основной сценарий остаётся ручным вводом номера латинскими буквами и цифрами.

---

## Главный принцип

```txt
ручной ввод номера -> основной сценарий
ручной ввод только латиницей -> обязательное правило
распознавание по фото -> помощник инспектора
подтверждение инспектора -> обязательный шаг
```

Распознавание номера не создаёт осмотр, не создаёт технику и не выбирает автомобиль автоматически. Распознанный номер всегда показывается инспектору для подтверждения или исправления.

---

## Основной поток

```txt
Фото номера
-> OCR / ANPR
-> нормализация в латиницу
-> исправление OCR-ошибок по маске номера
-> проверка формата
-> показ результата инспектору
-> ручное подтверждение или исправление
-> поиск техники по number_normalized
-> переход к выбору типа осмотра
```

---

## Рекомендуемая реализация для MVP

Для MVP рекомендуется backend-распознавание:

```txt
mobile camera
-> upload image to backend
-> regional OCR / ANPR provider
-> normalizeVehicleNumber
-> extractPlateCandidates
-> save recognition attempt
-> response with candidates
-> inspector confirmation
```

Причины:

- единая логика для Android, iOS и web-админки;
- можно менять OCR/ANPR-провайдера без обновления приложения;
- проще вести журнал попыток распознавания;
- проще соблюдать региональное размещение данных: RU / EU / INTL;
- можно использовать on-premise OCR/ANPR в нужном регионе.

Распознавание на устройстве можно добавить позже, если mobile-стек и качество распознавания будут достаточными.

---

## Региональное правило OCR

OCR/ANPR выполняется только в том регионе, где размещена компания.

```txt
RU company   -> ru-ocr
EU company   -> eu-ocr
INTL company -> intl-ocr
```

Запрещено отправлять фото номера компании из RU-контура в EU/INTL OCR и наоборот.

---

## Backend API

### POST /api/vehicle-number/recognize

Назначение: принять фото номера, запустить OCR/ANPR и вернуть кандидаты.

Запрос:

```txt
multipart/form-data
image: file
```

Обязательные правила:

- endpoint доступен только авторизованному пользователю;
- tenant определяется через middleware;
- `company_id` не передаётся клиентом как доверенное значение;
- OCR-провайдер выбирается по `region_code` компании;
- результат сохраняется в `vehicle_number_recognitions`;
- результат не считается финальным без подтверждения инспектора.

Ответ:

```json
{
  "recognitionId": "recognition-id",
  "rawText": "А123ВС77",
  "normalizedNumber": "A123BC77",
  "confidence": 0.91,
  "provider": "regional-anpr",
  "candidates": [
    {
      "number": "A123BC77",
      "confidence": 0.91,
      "isValid": true
    },
    {
      "number": "A123BC177",
      "confidence": 0.72,
      "isValid": true
    }
  ]
}
```

### POST /api/vehicle-number/:recognitionId/confirm

Назначение: сохранить финальный номер, подтверждённый инспектором.

Запрос:

```json
{
  "confirmedNumber": "A123BC77"
}
```

Правила:

- `confirmedNumber` должен быть только латиницей и цифрами;
- кириллица не принимается;
- номер нормализуется повторно на backend;
- запись распознавания получает `confirmed = true`;
- сохраняется `confirmed_number`;
- после подтверждения можно вызывать поиск техники.

### POST /api/vehicles/resolve-number

Назначение: нормализовать номер и найти технику в текущей компании.

Запрос:

```json
{
  "number": "A123BC77"
}
```

Ответ, если техника найдена:

```json
{
  "vehicle": {
    "id": "vehicle-id",
    "numberNormalized": "A123BC77",
    "name": "Toyota Camry"
  }
}
```

Ответ, если техника не найдена:

```json
{
  "vehicle": null,
  "normalizedNumber": "A123BC77",
  "canCreate": true
}
```

---

## Ошибки API

```txt
image_required              -> фото не передано
invalid_image_type          -> неподдерживаемый формат файла
image_too_large             -> файл больше допустимого лимита
ocr_region_unavailable      -> OCR-сервис региона недоступен
ocr_failed                  -> OCR/ANPR не смог обработать фото
plate_not_found             -> номер не найден на фото
invalid_plate_format        -> номер не соответствует формату
latin_input_required        -> финальный номер должен быть латиницей
tenant_access_denied        -> пользователь не принадлежит компании
region_mismatch             -> попытка отправить фото в другой регион
```

---

## Модель данных

```txt
vehicle_number_recognitions
- id
- company_id
- user_id
- vehicle_id
- inspection_id
- photo_id
- image_url
- raw_text
- normalized_number
- confidence
- provider
- provider_region
- candidates_json
- confirmed
- confirmed_number
- confirmed_by
- confirmed_at
- error_code
- created_at
```

`image_url` или `photo_id` хранятся только если компания разрешает хранить фото номера как доказательный материал. Для минимального MVP можно сохранять фото номера как `photo_type = number_plate` в общем хранилище фото осмотра.

---

## Нормализация номера

Финальный номер хранится только латиницей.

OCR может вернуть кириллицу, поэтому backend приводит визуальные кириллические аналоги к латинице.

```ts
const CYR_TO_LAT: Record<string, string> = {
  "А": "A",
  "В": "B",
  "Е": "E",
  "К": "K",
  "М": "M",
  "Н": "H",
  "О": "O",
  "Р": "P",
  "С": "C",
  "Т": "T",
  "У": "Y",
  "Х": "X"
};

const ALLOWED_RU_PLATE_LETTERS = "ABEKMHOPCTYX";

export function normalizeVehicleNumber(input: string): string {
  return input
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-_.,]/g, "")
    .split("")
    .map((char) => CYR_TO_LAT[char] ?? char)
    .join("");
}
```

---

## Проверка российского формата

Для стандартного российского номера используется маска:

```txt
L DDD LL RR
L DDD LL RRR
```

Где:

```txt
L -> A B E K M H O P C T Y X
D -> 0-9
R -> регион, 2 или 3 цифры
```

```ts
export function isValidRussianPlate(input: string): boolean {
  const value = normalizeVehicleNumber(input);

  const pattern = new RegExp(
    `^[${ALLOWED_RU_PLATE_LETTERS}]\\d{3}[${ALLOWED_RU_PLATE_LETTERS}]{2}\\d{2,3}$`
  );

  return pattern.test(value);
}
```

---

## Исправление OCR-ошибок по позиции

OCR часто путает похожие символы:

```txt
O <-> 0
B <-> 8
I <-> 1
Z <-> 2
C <-> G
```

Исправление должно учитывать позицию символа в номере.

```ts
const LETTER_FIX: Record<string, string> = {
  "0": "O",
  "8": "B"
};

const DIGIT_FIX: Record<string, string> = {
  "O": "0",
  "О": "0",
  "I": "1",
  "L": "1",
  "Z": "2",
  "B": "8"
};

export function fixByRussianPlateMask(input: string): string {
  const value = normalizeVehicleNumber(input);
  const chars = value.split("");

  return chars
    .map((char, index) => {
      const isLetterPosition = index === 0 || index === 4 || index === 5;
      const isDigitPosition = index === 1 || index === 2 || index === 3 || index >= 6;

      if (isLetterPosition) {
        return LETTER_FIX[char] ?? char;
      }

      if (isDigitPosition) {
        return DIGIT_FIX[char] ?? char;
      }

      return char;
    })
    .join("");
}
```

---

## Извлечение кандидатов из OCR-текста

```ts
export function extractPlateCandidates(rawText: string) {
  const compact = normalizeVehicleNumber(rawText);
  const chunks = compact.match(/[A-ZА-Я0-9]{6,10}/g) ?? [];

  const candidates = chunks
    .map(fixByRussianPlateMask)
    .filter((value) => value.length >= 8 && value.length <= 9)
    .map((value) => ({
      number: value,
      isValid: isValidRussianPlate(value)
    }))
    .filter((item) => item.isValid);

  return Array.from(new Map(candidates.map((item) => [item.number, item])).values());
}
```

---

## Backend module structure

```txt
backend/src/modules/vehicle-number/
├── vehicle-number.routes.ts
├── normalize-vehicle-number.ts
├── extract-plate-candidates.ts
├── vehicle-number-recognition.service.ts
├── vehicle-number-recognition.repository.ts
└── providers/
    ├── index.ts
    ├── local-ocr.provider.ts
    ├── anpr-http.provider.ts
    └── mock.provider.ts
```

---

## Пример Express endpoint

```ts
import express from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { requireTenant } from "../../middleware/tenant";
import { extractPlateCandidates } from "./extract-plate-candidates";
import { recognizePlateImage } from "./vehicle-number-recognition.service";

const router = express.Router();
const upload = multer({
  dest: "tmp/plate-recognition",
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

router.post(
  "/vehicle-number/recognize",
  requireAuth,
  requireTenant,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "image_required" });
    }

    const recognition = await recognizePlateImage({
      filePath: req.file.path,
      companyId: req.companyId,
      userId: req.userId,
      regionCode: req.regionCode
    });

    const candidates = extractPlateCandidates(recognition.rawText).map((candidate) => ({
      ...candidate,
      confidence: recognition.confidence ?? null
    }));

    return res.json({
      recognitionId: recognition.id,
      rawText: recognition.rawText,
      normalizedNumber: candidates[0]?.number ?? null,
      confidence: recognition.confidence ?? null,
      provider: recognition.provider,
      candidates
    });
  }
);

export default router;
```

---

## OCR provider interface

```ts
type RegionCode = "ru" | "eu" | "intl";

type RecognizePlateInput = {
  filePath: string;
  companyId: string;
  userId: string;
  regionCode: RegionCode;
};

type RecognizePlateResult = {
  rawText: string;
  confidence?: number;
  provider: string;
  providerRegion: RegionCode;
  candidates?: Array<{
    number: string;
    confidence?: number;
  }>;
};

export interface PlateRecognitionProvider {
  recognize(input: RecognizePlateInput): Promise<RecognizePlateResult>;
}
```

Выбор провайдера:

```ts
export function getPlateRecognitionProvider(regionCode: RegionCode): PlateRecognitionProvider {
  if (regionCode === "ru") {
    return ruPlateRecognitionProvider;
  }

  if (regionCode === "eu") {
    return euPlateRecognitionProvider;
  }

  return intlPlateRecognitionProvider;
}
```

---

## Mobile flow

Экран выбора техники:

```txt
Введите номер автомобиля

[ A123BC77 ]

[Распознать по фото]
```

После фото:

```txt
Распознан номер:
A123BC77

[Подтвердить]
[Исправить]
[Сделать фото заново]
```

Если номер не распознан:

```txt
Номер не распознан.
Введите номер вручную латинскими буквами.
```

---

## Mobile upload example

```ts
const photo = await cameraRef.current?.takePictureAsync({
  quality: 0.8,
  exif: true
});

const formData = new FormData();

formData.append("image", {
  uri: photo.uri,
  name: "plate.jpg",
  type: "image/jpeg"
} as any);

const response = await fetch(`${API_URL}/vehicle-number/recognize`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();

setRecognitionId(result.recognitionId);
setRecognizedNumber(result.normalizedNumber);
setCandidates(result.candidates);
```

---

## Проверка перед стартом осмотра

Осмотр можно начать только если:

```txt
номер введён или распознан
номер приведён к латинице
номер соответствует формату выбранной страны
инспектор подтвердил номер
техника найдена или разрешено создать новую технику
```

---

## Тест-кейсы

```txt
А123ВС77  -> A123BC77 -> valid
М777ОН199 -> M777OH199 -> valid
Х001ХХ77  -> X001XX77 -> valid
A123BC77  -> A123BC77 -> valid
A123BC777 -> A123BC777 -> valid
И123ДД77  -> invalid
A12BC777  -> invalid
A123BС77 with mixed Cyrillic C -> A123BC77 -> valid
O123OO77 where O is valid letter position -> valid if matches allowed letters
A12ЗBC77 -> invalid or corrected only if confidence is high and user confirms
```

---

## Что не делать

```txt
не запускать осмотр автоматически после OCR
не хранить финальный номер кириллицей
не принимать номер без подтверждения инспектора
не отправлять фото РФ-компаний в зарубежный OCR
не использовать один OCR endpoint для всех регионов
не полагаться только на OCR без ручного ввода
не сохранять только raw_text без normalized_number
не хранить токены OCR-провайдера в frontend/mobile
```
