## Project Overview

This is a React Native + Expo app that implements authentication with a FastAPI backend. The app uses **Expo Router** for file-based routing with protected route guards, and follows a mobile-first auth strategy using non-cookie refresh tokens.

## Development Commands

This project uses **bun** as the package manager.

```bash
# Install dependencies
bun install

bun start
```

## Post-Task Validation

After completing any code changes, **always run** these checks:

```bash
# TypeScript type checking
bun run tsc --noEmit

# Linting (skip on Linux environments)
bun run lint
```

## Architecture

### Routing & Navigation

- **File-based routing** via `expo-router` with `src/app/` as the routes directory
- Route groups use parentheses: `(home)/` is a group that doesn't affect URL path
- **Protected routes** using `Stack.Protected` with guard functions:
  - `src/app/_layout.tsx` - Root navigator with auth guards
  - Authenticated users see `(home)/index.tsx`
  - Unauthenticated users see `sign-in.tsx`
- Deep link scheme: `expofastapiauth://` (configured in `app.json`)

### Authentication Pattern

The app implements a **mobile-specific auth strategy** (not browser cookies):

| Token       | Storage Location        | Purpose                     |
|-------------|-------------------------|-----------------------------|
| Access      | In-memory (runtime)     | API requests via Bearer     |
| Refresh     | SecureStore (encrypted) | Token rotation on expiry    |

- **Access token**: Never persisted to disk; stored in React Context; added as `Authorization: Bearer` header
- **Refresh token**: Persisted via `expo-secure-store` (native: encrypted keychain/keystore, web: localStorage fallback)

### Key Files

- `src/context/ctx.tsx` - `SessionProvider` context with `signIn`/`signOut` methods and session state
- `src/hooks/useStorageState.ts` - Custom hook for SecureStore persistence with web fallback
- `src/components/splash.tsx` - Splash screen controller that hides splash once auth state loads
- `src/app/sign-in.tsx` - Sign-in screen (currently placeholder)
- `src/app/(home)/index.tsx` - Authenticated home screen

### Backend API Endpoints (Mobile-Specific)

Per `docs/expo-rn-auth-integration.md`, the backend provides mobile endpoints:

```
POST /api/v1/login/mobile     - Returns access_token + refresh_token in JSON
POST /api/v1/refresh/mobile   - Refresh with body { refresh_token }, rotates tokens
POST /api/v1/logout/mobile    - Invalidate tokens
GET  /api/v1/user/me/         - Get current user (Bearer access token)
```

**Important**: Login uses `application/x-www-form-urlencoded` with `username` and `password` fields. Refresh uses JSON body.

### Token Rotation

The backend uses **refresh token rotation** - each refresh returns a new refresh token and the old one is blacklisted. The client must update the stored refresh token after each successful refresh.

### Concurrent Refresh Handling

When multiple API requests receive 401 simultaneously, implement **single-flight refresh** (only one refresh request, others wait) to avoid token race conditions.

## TypeScript & Path Aliases

- `@/` path alias points to project root (configured in `tsconfig.json`)
- Strict mode enabled
- Expo typed routes experiment enabled in `app.json`

## Expo Configuration

- **New Architecture**: Enabled (`newArchEnabled: true`)
- **Experiments**: `typedRoutes` and `reactCompiler` enabled
- **Splash screen**: Configured in `app.json` plugins with light/dark mode variants

## Commit Message Guidelines

When the user requests a git commit:
- Use **English** for commit messages
- Write **detailed** messages explaining the "why" and "what" of changes
- Do NOT include "Co-Authored-By: Claude" or any AI attribution in the commit message
