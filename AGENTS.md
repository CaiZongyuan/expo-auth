## Project Overview

This is a React Native + Expo app that implements authentication with a FastAPI backend. The app uses **Expo Router** for file-based routing with protected route guards, and follows a mobile-first auth strategy using non-cookie refresh tokens.

## Development Commands

This project uses **bun** as the package manager.

```bash
# Install dependencies
bun install

# Start dev server
bun start

# Type checking
bun run tsc --noEmit

# Linting (skip on Linux environments)
bun run lint
```

## Environment Configuration

Required environment variable in `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api/v1
```

**Important**: For Expo Go on physical devices, use your LAN IP (e.g., `192.168.1.100:8000`), NOT `localhost`.

## Post-Task Validation

After completing any code changes, **always run** these checks:

```bash
# TypeScript type checking
bun run tsc --noEmit

# Linting (skip on Linux environments)
bun run lint
```

## Architecture

### Project Structure

```
src/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root navigator with auth guards
│   ├── sign-in.tsx         # Login page
│   ├── sign-up.tsx         # Registration page
│   └── (home)/
│       └── index.tsx       # Protected home page
├── components/
│   └── splash.tsx          # Splash screen controller
├── core/
│   ├── config/
│   │   └── env.ts          # Environment variable configuration
│   └── storage/
│       ├── secureStorage.ts    # Expo SecureStore wrapper (iOS Keychain / Android Keystore)
│       └── refreshToken.ts     # Refresh token persistence
├── features/
│   └── auth/
│       ├── auth.api.ts         # Authentication API calls
│       ├── auth.store.ts       # Zustand auth state
│       ├── auth.types.ts       # TypeScript types
│       └── auth.schemas.ts     # Zod validation schemas
├── lib/
│   └── api/
│       ├── rawClient.ts        # Base Axios instance
│       ├── apiClient.ts        # Axios with auto-refresh
│       ├── refreshGate.ts      # Single-flight refresh
│       └── errors.ts           # API error handling
├── providers/
│   └── queryClient.tsx         # React Query provider
└── hooks/
    └── useStorageState.ts      # SecureStore React hook wrapper
```

### Routing & Navigation

- **File-based routing** via `expo-router` with `src/app/` as the routes directory
- Route groups use parentheses: `(home)/` is a group that doesn't affect URL path
- **Protected routes** using `Stack.Screen` with auth guards:
  - `src/app/_layout.tsx` - Root navigator with auth guards
  - Authenticated users see `(home)/index.tsx`
  - Unauthenticated users see `sign-in.tsx`
- Deep link scheme: `expofastapiauth://` (configured in `app.json`)

### Authentication Pattern

The app implements a **mobile-specific auth strategy** (not browser cookies):

| Token       | Storage Location        | Purpose                     |
|-------------|-------------------------|-----------------------------|
| Access      | In-memory (Zustand)     | API requests via Bearer     |
| Refresh     | SecureStore (encrypted) | Token rotation on expiry    |

- **Access token**: Never persisted to disk; stored in Zustand store; added as `Authorization: Bearer` header
- **Refresh token**: Persisted via `expo-secure-store` (iOS: Keychain, Android: Encrypted SharedPreferences)

### State Management

- **Auth state**: Zustand store (`src/features/auth/auth.store.ts`)
  - `status`: `'booting'` | `'guest'` | `'authed'`
  - `accessToken`: In-memory access token
  - `user`: Current user object
  - Methods: `signIn()`, `signUp()`, `signOut()`, `bootstrap()`, `refreshAccessToken()`

- **Server state**: React Query (`@tanstack/react-query`)
  - Configured in `src/providers/queryClient.tsx`
  - Default: 30s stale time, 1 retry

### API Client Architecture

Two Axios instances for different purposes:

| Instance      | File                | Usage                          |
|---------------|---------------------|--------------------------------|
| `rawClient`   | `rawClient.ts`      | No auth required (login, register, refresh) |
| `apiClient`   | `apiClient.ts`      | Auth required (auto-refresh on 401) |

**Auto-refresh flow**:
1. Request with Bearer token
2. Receive 401 response
3. `refreshGate` ensures single-flight refresh
4. Update stored tokens
5. Retry original request with new token

### Key Files

| File | Purpose |
|------|---------|
| `src/core/config/env.ts` | Environment config with URL normalization |
| `src/core/storage/secureStorage.ts` | Cross-platform secure storage wrapper |
| `src/core/storage/refreshToken.ts` | Refresh token persistence |
| `src/lib/api/rawClient.ts` | Base Axios for unauthenticated requests |
| `src/lib/api/apiClient.ts` | Axios with auto token refresh |
| `src/lib/api/refreshGate.ts` | Single-flight refresh (prevents race conditions) |
| `src/lib/api/errors.ts` | API error normalization |
| `src/features/auth/auth.api.ts` | Auth API calls (login, signup, refresh, logout) |
| `src/features/auth/auth.store.ts` | Zustand auth state management |
| `src/features/auth/auth.types.ts` | TypeScript types for auth entities |
| `src/features/auth/auth.schemas.ts` | Zod validation for forms |
| `src/providers/queryClient.tsx` | React Query provider |
| `src/components/splash.tsx` | Hides splash when auth state loads |
| `src/app/sign-up.tsx` | Registration screen |

### Backend API Endpoints (Mobile-Specific)

```
POST /api/v1/login/mobile     - Returns access_token + refresh_token
POST /api/v1/refresh/mobile   - Refresh with body { refresh_token }, rotates tokens
POST /api/v1/logout/mobile    - Invalidate tokens
POST /api/v1/user             - Register new user
GET  /api/v1/user/me/         - Get current user (Bearer access token)
```

**Content-Type**:
- Login: `application/x-www-form-urlencoded` with `username` and `password`
- Refresh/Logout: `application/json`

### Token Rotation

The backend uses **refresh token rotation** - each refresh returns a new refresh token and the old one is blacklisted. The client must update the stored refresh token after each successful refresh.

### Concurrent Refresh Handling

When multiple API requests receive 401 simultaneously, **single-flight refresh** (`src/lib/api/refreshGate.ts`) ensures only one refresh request is made, and other requests wait for the new token.

## TypeScript & Path Aliases

- `@/` path alias points to project root (configured in `tsconfig.json`)
- Strict mode enabled
- Expo typed routes experiment enabled in `app.json`

## Expo Configuration

- **New Architecture**: Enabled (`newArchEnabled: true`)
- **Experiments**: `typedRoutes` and `reactCompiler` enabled
- **Splash screen**: Configured in `app.json` plugins with light/dark mode variants

## Dependencies

### Core
- `expo` ~54.0
- `react-native` 0.81.5
- `expo-router` - File-based routing
- `expo-secure-store` - Encrypted storage

### API & State
- `axios` - HTTP client
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management

### Forms & Validation
- `react-hook-form` - Form state
- `@hookform/resolvers` - Form validation integration
- `zod` - Schema validation

## Commit Message Guidelines

When the user requests a git commit:
- Use **English** for commit messages
- Write **detailed** messages explaining the "why" and "what" of changes
- Do NOT include "Co-Authored-By: Claude" or any AI attribution in the commit message
