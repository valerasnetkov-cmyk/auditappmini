# РђСѓРґРёС‚ РўРµС…РЅРёРєРё

РЎРёСЃС‚РµРјР° РЅРµР·Р°РІРёСЃРёРјРѕР№ С„РѕС‚РѕС„РёРєСЃР°С†РёРё СЃРѕСЃС‚РѕСЏРЅРёСЏ С‚РµС…РЅРёРєРё СЃ РёСЃС‚РѕСЂРёРµР№ РёР·РјРµРЅРµРЅРёР№.

## Р‘С‹СЃС‚СЂС‹Р№ СЃС‚Р°СЂС‚

### РўСЂРµР±РѕРІР°РЅРёСЏ
- Node.js 18+
- npm 9+

### РЈСЃС‚Р°РЅРѕРІРєР° Рё Р·Р°РїСѓСЃРє

1. **Backend (Node.js + SQLite)**
```bash
cd backend
npm install
npm start
```

2. **Frontend (Next.js)**
```bash
cd web
npm install
npm run dev
```

3. **РћС‚РєСЂРѕР№С‚Рµ http://localhost:3002**

### Р‘С‹СЃС‚СЂР°СЏ РїСЂРѕРІРµСЂРєР° backend

```bash
cd backend
npm run smoke
npm run smoke:auth
npm run smoke:vehicles
npm run smoke:inspections
npm run smoke:analytics
```

### Р”РµРјРѕ РґР°РЅРЅС‹Рµ

РџРѕСЃР»Рµ Р·Р°РїСѓСЃРєР° backend РІС‹РїРѕР»РЅРёС‚Рµ:
```bash
curl -X POST http://localhost:3001/api/seed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <manager-jwt>" \
  -d '{"vehicles":30,"inspections":50}'
```

РР»Рё Р·Р°РїСѓСЃС‚РёС‚Рµ seed С‡РµСЂРµР· UI РїРѕРґ СѓС‡РµС‚РЅРѕР№ Р·Р°РїРёСЃСЊСЋ РјРµРЅРµРґР¶РµСЂР°.

### РЈС‡РµС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ
| Email | РџР°СЂРѕР»СЊ | Р РѕР»СЊ |
|-------|--------|------|
| admin@example.com | admin123 | РњРµРЅРµРґР¶РµСЂ |
| demo_inspector_1@example.com | demo123 | Inspector |
| demo_inspector_2@example.com | demo123 | Inspector |
| demo_manager@example.com | demo123 | Manager |

## РЎС‚СЂСѓРєС‚СѓСЂР° РїСЂРѕРµРєС‚Р°

```
auditappmini/
в”њв”Ђв”Ђ backend/           # Node.js + Express + SQLite
в”‚   в”њв”Ђв”Ђ src/
в”‚   в”‚   в”њв”Ђв”Ђ db.js      # Р‘Р°Р·Р° РґР°РЅРЅС‹С… SQLite
в”‚   в”‚   в””в”Ђв”Ђ server.js  # API СЃРµСЂРІРµСЂ
в”‚   в””в”Ђв”Ђ package.json
в”‚
в”њв”Ђв”Ђ web/               # Next.js
в”‚   в”њв”Ђв”Ђ src/
в”‚   в”‚   в”њв”Ђв”Ђ app/       # РЎС‚СЂР°РЅРёС†С‹
в”‚   в”‚   в””в”Ђв”Ђ lib/api/  # API РєР»РёРµРЅС‚
в”‚   в””в”Ђв”Ђ package.json
в”‚
в”њв”Ђв”Ђ mobile/            # Flutter / Supabase РїСЂРѕС‚РѕС‚РёРї
в””в”Ђв”Ђ mobile-app/        # Expo / React Native РєР»РёРµРЅС‚
```

## API Endpoints

### Auth
- `POST /api/auth/login` вЂ” Р’С…РѕРґ
- `GET /api/auth/me` вЂ” РўРµРєСѓС‰РёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ

### Vehicles
- `GET /api/vehicles` вЂ” РЎРїРёСЃРѕРє С‚РµС…РЅРёРєРё (РїР°РіРёРЅР°С†РёСЏ)
- `GET /api/vehicles/:id` вЂ” РўРµС…РЅРёРєР°
- `POST /api/vehicles` вЂ” РЎРѕР·РґР°С‚СЊ
- `PUT /api/vehicles/:id` вЂ” РћР±РЅРѕРІРёС‚СЊ
- `DELETE /api/vehicles/:id` вЂ” РЈРґР°Р»РёС‚СЊ

### Inspections
- `GET /api/inspections` вЂ” РЎРїРёСЃРѕРє РѕСЃРјРѕС‚СЂРѕРІ
- `GET /api/vehicles/:id/inspections` вЂ” РћСЃРјРѕС‚СЂС‹ С‚РµС…РЅРёРєРё
- `POST /api/inspections` вЂ” РЎРѕР·РґР°С‚СЊ РѕСЃРјРѕС‚СЂ

### Defects
- `GET /api/defects` вЂ” РЎРїРёСЃРѕРє РґРµС„РµРєС‚РѕРІ
- `POST /api/defects/:id/photos` вЂ” Р—Р°РіСЂСѓР·РёС‚СЊ С„РѕС‚Рѕ

### Dashboard
- `GET /api/dashboard/stats` вЂ” РЎС‚Р°С‚РёСЃС‚РёРєР°

## РџРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ

### Backend (.env)
```
PORT=3001
JWT_SECRET=your-secret-key
```

### Web (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Verify

```bash
npm run verify
```

## Backend Environment

See `backend/.env.example` for:

```bash
PORT=3001
JWT_SECRET=change-me-for-production
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

## Frontend Environment

See `.env.example` or `web/.env.example` for:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```
