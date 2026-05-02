Mobile App MVP — Auditmini (React Native + Expo)

Overview
- Target: iOS and Android (cross-platform) with React Native via Expo (managed workflow).
- MVP focuses on authentication, viewing dashboard metrics, and defects data from the existing API.
  - Auth: login with backend /auth/login and store token securely.
  - Screens: Login, Dashboard, Defects List, Defect Detail.
  - Data: fetch using the existing backend endpoints (dashboard/stats, defects, vehicles, etc.).

Tech Stack (proposed)
- Framework: React Native (Expo managed)
- Language: TypeScript
- Navigation: @react-navigation/native
- HTTP: fetch/axios wrapper with token persistence (SecureStore for token when possible)
- Local storage: AsyncStorage or sqlite for offline caching (later MVP)
- Theming: light/dark mode support (via React Native Paper or custom styles)

Project structure (proposed)
- mobile-app/
  - App.tsx
  - src/
    - api/  // ApiClient for mobile
    - screens/  // LoginScreen.tsx, DashboardScreen.tsx, DefectsScreen.tsx, DefectDetailScreen.tsx
    - navigation/  // AppNavigator.tsx with React Navigation
    - components/  // common UI components
  - assets/
  - package.json

Getting started (local development)
- Install Expo CLI globally: npm i -g expo-cli
- Initialize project (example): expo init auditmini-mobile --template expo-template-blank-typescript
- Connect device or emulator and run: expo start
- Configure API base URL to point to your local backend (http://<PC_IP>:3001/api) for development. Use a .env file or a config module.

Notes
- We’ll progressively implement features and adjust the plan as the mobile app evolves.
- After scaffolding, I’ll add a small MVP branch and start implementing authentication and the Defects UI.
