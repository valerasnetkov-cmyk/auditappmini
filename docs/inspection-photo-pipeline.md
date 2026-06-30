# ТЗ для Codex: загрузка и автоматическая конвертация фотографий осмотра ТС в WebP

## Контекст проекта

Разрабатывается SaaS-приложение для аудита автотранспортных средств. Один из ключевых сценариев — внешний осмотр автомобиля с загрузкой фотографий с телефона.

Пользователь загружает фотографии осмотра с мобильного устройства. Возможные исходные форматы:

- JPG / JPEG
- PNG
- WebP

Необходимо реализовать автоматическую обработку изображений: проверка файла, сохранение оригинала, генерация оптимизированной WebP-версии и миниатюры.

---

## Бизнес-цель

Сделать загрузку фотографий удобной для пользователя и устойчивой для SaaS-продукта:

- снизить вес изображений;
- ускорить просмотр осмотров;
- уменьшить расходы на хранение;
- сохранить оригиналы как доказательную базу;
- подготовить структуру для будущего поиска, фильтрации и отчетов по осмотрам.

---

## Пользовательский сценарий

1. Инспектор открывает карточку осмотра ТС с телефона.
2. Выбирает категорию фото: передняя часть, задняя часть, левый борт, правый борт и т.д.
3. Делает фото.
4. Приложение загружает файл.
5. Сервер обрабатывает изображение.
6. В интерфейсе отображается миниатюра.
7. Пользователь может переснять фото, добавить комментарий или загрузить дополнительные фото повреждений.

---

## Основная логика обработки

Реализовать пайплайн:

```txt
Пользователь загружает JPG / PNG / WebP
        ↓
Сервер валидирует файл
        ↓
Сервер сохраняет оригинал
        ↓
Сервер создает WebP-версию для просмотра
        ↓
Сервер создает WebP-thumbnail
        ↓
Метаданные записываются в базу
        ↓
Фото отображается в карточке осмотра
```

---

## Важное решение

Не заменять оригинал полностью.

Для аудита транспортных средств оригинальный файл желательно сохранять отдельно, так как фото может использоваться как доказательство состояния автомобиля: повреждения, пробег, VIN, состояние кузова, салона и т.д.

Оптимизированная WebP-версия используется для интерфейса, отчетов и быстрого просмотра.

---

## Требования к форматам

Разрешенные форматы загрузки:

```txt
image/jpeg
image/png
image/webp
```

Запрещать:

- SVG;
- GIF;
- HEIC, если нет отдельной поддержки;
- PDF;
- видео;
- любые неизвестные MIME-типы.

---

## Рекомендуемые ограничения

```txt
Максимальный размер одного файла: 15 МБ
Максимальное количество фото на один осмотр: 100
Максимальное разрешение WebP-версии: 2048px по большей стороне
Размер thumbnail: 480px по большей стороне
```

---

## Серверная обработка изображений

Использовать `sharp`.

Установить зависимость:

```bash
npm install sharp
```

---

## Функция обработки изображения

Создать серверную функцию, например:

```ts
// src/server/image-processing/convert-inspection-photo.ts

import sharp from "sharp";
import crypto from "crypto";

export type ProcessedInspectionPhoto = {
  originalBuffer: Buffer;
  webpBuffer: Buffer;
  thumbBuffer: Buffer;
  hash: string;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    sizeOriginal: number;
    sizeWebp: number;
    sizeThumb: number;
  };
};

export async function convertInspectionPhoto(
  fileBuffer: Buffer
): Promise<ProcessedInspectionPhoto> {
  const hash = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");

  const source = sharp(fileBuffer, {
    failOn: "error",
  }).rotate();

  const sourceMetadata = await source.metadata();

  const webpBuffer = await sharp(fileBuffer)
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 4,
    })
    .toBuffer();

  const thumbBuffer = await sharp(fileBuffer)
    .rotate()
    .resize({
      width: 480,
      height: 480,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 75,
      effort: 4,
    })
    .toBuffer();

  return {
    originalBuffer: fileBuffer,
    webpBuffer,
    thumbBuffer,
    hash,
    metadata: {
      width: sourceMetadata.width,
      height: sourceMetadata.height,
      format: sourceMetadata.format,
      sizeOriginal: fileBuffer.length,
      sizeWebp: webpBuffer.length,
      sizeThumb: thumbBuffer.length,
    },
  };
}
```

---

## Валидация файла

Создать функцию валидации:

```ts
// src/server/image-processing/validate-inspection-photo.ts

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export function validateInspectionPhoto(file: File) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Недопустимый формат файла. Разрешены JPG, PNG и WebP.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Файл слишком большой. Максимальный размер — 15 МБ.");
  }
}
```

---

## API endpoint

Создать endpoint загрузки фото.

Пример:

```txt
POST /api/inspections/:inspectionId/photos
```

Принимает:

```ts
{
  file: File;
  vehicleId: string;
  category: InspectionPhotoCategory;
  comment?: string;
}
```

Возвращает:

```ts
{
  id: string;
  inspectionId: string;
  vehicleId: string;
  category: string;
  originalUrl: string;
  webpUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  sizeOriginal: number;
  sizeWebp: number;
  uploadedAt: string;
}
```

---

## Категории фотографий осмотра

Добавить enum:

```ts
export enum InspectionPhotoCategory {
  Front = "front",
  Rear = "rear",
  LeftSide = "left_side",
  RightSide = "right_side",
  FrontLeft = "front_left",
  FrontRight = "front_right",
  RearLeft = "rear_left",
  RearRight = "rear_right",
  Interior = "interior",
  Dashboard = "dashboard",
  Odometer = "odometer",
  Vin = "vin",
  Wheels = "wheels",
  Damage = "damage",
  Additional = "additional",
}
```

---

## UX-структура загрузки фото

В интерфейсе осмотра сделать не одну общую кнопку загрузки, а слоты по категориям.

Рекомендуемый список:

```txt
Передняя часть
Задняя часть
Левый борт
Правый борт
Передний левый угол
Передний правый угол
Задний левый угол
Задний правый угол
Салон
Панель приборов
Пробег
VIN
Колеса / диски
Повреждения
Дополнительно
```

Каждый слот должен иметь состояния:

```txt
Не загружено
Загрузка
Ошибка
Фото загружено
Можно переснять
Можно удалить
Можно добавить комментарий
```

---

## HTML input для мобильной загрузки

Использовать:

```tsx
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  capture="environment"
  onChange={handleFileChange}
/>
```

`capture="environment"` помогает открыть заднюю камеру на мобильном устройстве.

---

## Клиентская обработка

На первом этапе не делать обязательную клиентскую конвертацию.

Причина: клиентская WebP-конвертация зависит от поддержки браузера и может вести себя нестабильно на разных устройствах.

Клиентская обработка может быть добавлена позже как оптимизация:

- предварительное уменьшение размера перед загрузкой;
- предпросмотр;
- сжатие при медленном интернете;
- офлайн-очередь загрузок.

Основная надежная обработка должна происходить на сервере.

---

## Структура хранения файлов

Рекомендуемая структура в storage:

```txt
/companies/{companyId}/inspections/{inspectionId}/photos/{photoId}/original.{ext}
/companies/{companyId}/inspections/{inspectionId}/photos/{photoId}/main.webp
/companies/{companyId}/inspections/{inspectionId}/photos/{photoId}/thumb.webp
```

Пример:

```txt
/companies/company_abc/inspections/insp_123/photos/photo_456/original.jpg
/companies/company_abc/inspections/insp_123/photos/photo_456/main.webp
/companies/company_abc/inspections/insp_123/photos/photo_456/thumb.webp
```

---

## Модель базы данных

Пример Prisma-модели:

```prisma
model InspectionPhoto {
  id             String   @id @default(cuid())

  inspectionId   String
  vehicleId      String

  category       String
  comment        String?

  originalUrl    String
  webpUrl        String
  thumbUrl       String

  originalMime   String
  originalName   String?

  width          Int?
  height         Int?

  sizeOriginal   Int
  sizeWebp       Int
  sizeThumb      Int?

  hash           String?

  uploadedById   String?
  uploadedAt     DateTime @default(now())

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  inspection     Inspection @relation(fields: [inspectionId], references: [id])
  vehicle        Vehicle    @relation(fields: [vehicleId], references: [id])

  @@index([inspectionId])
  @@index([vehicleId])
  @@index([category])
  @@index([hash])
}
```

Если в проекте не используется Prisma — адаптировать модель под текущую ORM.

---

## Безопасность

Необходимо:

1. Проверять MIME-тип файла.
2. Проверять размер файла.
3. Не доверять имени файла от пользователя.
4. Генерировать собственный `photoId`.
5. Не использовать пользовательское имя файла как путь.
6. Ограничить доступ к фото по правам пользователя.
7. Проверять, что пользователь имеет доступ к `inspectionId`.
8. Сохранять оригинальный MIME-тип в базе.
9. Логировать ошибки обработки изображений.
10. Обрабатывать битые изображения.

---

## Обработка ошибок

Пользовательские сообщения:

```txt
Файл слишком большой. Максимальный размер — 15 МБ.
Недопустимый формат. Загрузите JPG, PNG или WebP.
Не удалось обработать изображение. Попробуйте другое фото.
Осмотр не найден.
Недостаточно прав для загрузки фото.
```

---

## UI-компоненты

Создать или обновить компоненты:

```txt
InspectionPhotoUploader
InspectionPhotoSlot
InspectionPhotoGrid
InspectionPhotoPreview
InspectionPhotoComment
InspectionPhotoDeleteButton
```

---

## Компонент слота фото

Пример интерфейса:

```tsx
type InspectionPhotoSlotProps = {
  inspectionId: string;
  vehicleId: string;
  category: InspectionPhotoCategory;
  title: string;
  photo?: {
    id: string;
    thumbUrl: string;
    webpUrl: string;
    comment?: string;
  };
};
```

Слот должен отображать:

- название категории;
- миниатюру, если фото загружено;
- кнопку "Сделать фото";
- кнопку "Заменить";
- кнопку "Удалить";
- поле комментария, если нужно.

---

## Acceptance criteria

Задача считается выполненной, если:

1. Пользователь может загрузить JPG, PNG или WebP с телефона.
2. Сервер сохраняет оригинальный файл.
3. Сервер создает WebP-версию максимум 2048px.
4. Сервер создает WebP-thumbnail максимум 480px.
5. В базу сохраняются ссылки на все версии фото.
6. В базу сохраняются метаданные: размер, формат, ширина, высота, категория.
7. Фото отображается в интерфейсе осмотра.
8. Thumbnail используется в списке / сетке.
9. WebP-версия используется в предпросмотре.
10. Оригинал не показывается по умолчанию в интерфейсе.
11. При ошибке пользователь получает понятное сообщение.
12. Нельзя загрузить файл больше лимита.
13. Нельзя загрузить неподдерживаемый формат.
14. Нельзя загрузить фото в чужой осмотр.
15. Код типизирован и не ломает существующий flow осмотра.

---

## Нежелательное поведение

Не делать:

- хранение только WebP без оригинала;
- загрузку файлов без проверки MIME-типа;
- использование пользовательского имени файла в storage path;
- хранение base64 в базе;
- показ полноразмерного оригинала в карточках;
- одну общую неструктурированную галерею без категорий;
- загрузку SVG;
- silent fail без сообщения пользователю.

---

## Рекомендуемый порядок реализации

### Этап 1. Backend

1. Добавить модель `InspectionPhoto`.
2. Добавить enum категорий фото.
3. Добавить серверную валидацию файлов.
4. Добавить функцию конвертации через `sharp`.
5. Добавить endpoint загрузки.
6. Добавить сохранение в storage.
7. Добавить запись метаданных в базу.

### Этап 2. Frontend

1. Добавить список фото-слотов в карточку осмотра.
2. Добавить загрузчик фото с мобильного.
3. Добавить preview thumbnail.
4. Добавить состояние загрузки.
5. Добавить обработку ошибок.
6. Добавить возможность заменить фото.

### Этап 3. Улучшения

1. Добавить удаление фото.
2. Добавить комментарии к фото.
3. Добавить сортировку по категориям.
4. Добавить просмотр галереи.
5. Добавить экспорт фото в отчет осмотра.
6. Добавить офлайн-очередь загрузки для плохого интернета.
7. Добавить клиентское предварительное сжатие как optional enhancement.

---

## Пример задачи для Codex

Реализуй загрузку фотографий осмотра ТС с автоматической серверной обработкой изображений.

Требования:

- принимать JPG, PNG и WebP;
- валидировать MIME-тип и размер файла;
- использовать `sharp`;
- сохранять оригинал;
- генерировать `main.webp` с ограничением 2048px по большей стороне;
- генерировать `thumb.webp` с ограничением 480px по большей стороне;
- сохранять ссылки и метаданные в базе;
- добавить категории фотографий осмотра;
- добавить UI-сетку фото-слотов в карточку осмотра;
- обеспечить понятные ошибки загрузки;
- не ломать существующий сценарий создания/редактирования осмотра.

---

## Пример промта для Codex

```txt
Нужно реализовать систему загрузки фотографий для SaaS-приложения аудита автотранспортных средств.

Фото загружаются с телефона во время внешнего осмотра ТС. Пользователь может загрузить JPG, PNG или WebP. На сервере нужно автоматически сохранять оригинал, создавать оптимизированную WebP-версию и thumbnail.

Используй текущий стек проекта. Если проект на Node.js/Next.js — используй sharp. Не храни base64 в базе. Оригинал должен храниться отдельно, потому что фото может быть доказательством состояния автомобиля.

Добавь модель InspectionPhoto, категории фото, серверный endpoint загрузки, обработку изображений, сохранение в storage и UI-сетку фото-слотов в карточке осмотра.

Критерии:
- JPG/PNG/WebP принимаются;
- максимум 15 МБ на файл;
- main.webp максимум 2048px;
- thumb.webp максимум 480px;
- оригинал сохраняется;
- метаданные пишутся в базу;
- фото отображаются в карточке осмотра;
- есть состояния загрузки и ошибки;
- доступ проверяется по inspectionId.
```

---

## Дополнительная рекомендация по продукту

Фотографии осмотра — это не просто вложения. Их лучше рассматривать как структурированные доказательства состояния ТС.

Поэтому интерфейс должен вести пользователя по обязательным ракурсам, а не просто предлагать загрузить любое количество файлов. Это повысит качество осмотров и уменьшит количество неполных актов.
