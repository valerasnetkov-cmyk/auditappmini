# Changelog - 2026-05

## Changes

### Backend

#### Bug Fixes
- Fixed duplicate `photosRequiredForDefect` in API_MESSAGES (removed duplicate)
- Fixed missing `defectTitleRequired` message key
- Fixed ReferenceError in `registerCompleteInspectionRoutes` - moved after API_MESSAGES definition
- Added `authenticate` middleware to completeInspection route
- Fixed admin seed - now requires both ADMIN_EMAIL AND ADMIN_PASSWORD

#### New Features

**Odometer API**
- `POST /api/odometer/recognize` - recognize odometer from photo (placeholder)
- `POST /api/inspections/:id/odometer` - save confirmed odometer

**Vehicle Number API**
- `POST /api/vehicle-number/recognize` - recognize number from photo (placeholder)
- `POST /api/vehicles/resolve-number` - normalize and find vehicle

**Photo Requirements**
- `GET /api/photo-requirements/:type` - requirements by inspection type
- `GET /api/defect-categories` - defect categories

**Inspection Completion Validation**
- Validates odometer for quick/scheduled inspections
- Validates accident time/location for accident inspections
- Validates required photos by inspection type
- Validates each defect has photos

**Database**
- Added `company_id` to users, vehicles, inspections, defects tables
- Added `odometer_value`, `odometer_unit`, `odometer_recognized_at` to inspections
- Added `audit_logs` table for tracking important actions

**Audit Logging**
- Added `backend/src/routes/audit.js` utility
- Track user actions, vehicle changes, inspection events

### Frontend

#### New Features
- **Theme System**
  - `web/src/lib/theme.tsx` - ThemeProvider with light/dark/system support
  - `web/src/components/ThemeSwitcher.tsx` - theme toggle component
  - CSS variables in `globals.css` for dark theme

- **i18n (Internationalization)**
  - `web/src/lib/i18n.ts` - translations for RU/EN
  - `web/src/components/LocaleSwitcher.tsx` - language toggle
  - Added validation error messages

- **Settings Page**
  - `web/src/app/settings/page.tsx` - settings with theme/language toggles

- **TypeScript Types**
  - Added `odometer_value`, `odometer_unit` to InspectionDetail

#### Configuration
- Updated Next.js to 16.2.4
- Updated React to 18.x
- Added `reactStrictMode: true` to next.config.js

### Route Modules
- `backend/src/routes/odometer.js` - odometer and vehicle number recognition
- `backend/src/routes/photo-requirements.js` - photo requirements and defect categories
- `backend/src/routes/audit.js` - audit logging utilities

### Documentation
- Updated implementation plan checks

## Breaking Changes
- Admin seeding requires both ADMIN_EMAIL and ADMIN_PASSWORD env vars (no default password)
- Inspection completion now requires odometer for quick/scheduled types
- Inspection completion requires accident details for accident type
- All business tables now have `company_id` field (defaults to 'default' for backward compatibility)

## API Endpoints Added
```
GET  /api/photo-requirements/:type
GET  /api/defect-categories
POST /api/odometer/recognize
POST /api/inspections/:id/odometer
POST /api/vehicle-number/recognize
POST /api/vehicles/resolve-number
```

## Files Created
```
backend/src/routes/audit.js
backend/src/routes/odometer.js
backend/src/routes/photo-requirements.js
web/src/lib/theme.tsx
web/src/lib/i18n.ts
web/src/components/ThemeSwitcher.tsx
web/src/components/LocaleSwitcher.tsx
web/src/app/settings/page.tsx
```

## Files Modified
```
backend/src/server.js
backend/src/db.js
backend/src/routes/completeInspection.js
web/package.json
web/next.config.js
web/src/app/layout.tsx
web/src/app/globals.css
web/src/lib/types.ts
web/src/lib/api/client.ts
```