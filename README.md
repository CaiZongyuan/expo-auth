# Expo FastAPI Auth

A React Native + Expo mobile application with authentication powered by a FastAPI backend. Features token-based auth with automatic refresh, protected routes, and a mobile-first security strategy.

## Features

- **User Authentication**: Sign up, sign in, and sign out with token-based auth
- **Automatic Token Refresh**: Seamless token rotation without user interruption
- **Protected Routes**: Route guards to redirect unauthenticated users
- **Secure Storage**: Encrypted token storage using Expo SecureStore
- **Type-Safe**: Full TypeScript support with Zod validation
- **Form Validation**: Client-side form validation with react-hook-form + Zod
- **State Management**: Zustand for auth state, React Query for server state

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native + Expo (~54.0) |
| Routing | Expo Router (file-based) |
| State Management | Zustand + React Query |
| Forms | react-hook-form + Zod |
| HTTP Client | Axios |
| Secure Storage | expo-secure-store |
| Language | TypeScript |

## Project Structure

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
│   │   └── env.ts          # Environment configuration
│   └── storage/
│       ├── secureStorage.ts    # SecureStore wrapper (iOS Keychain / Android Keystore)
│       └── refreshToken.ts     # Refresh token persistence
├── features/
│   └── auth/
│       ├── auth.api.ts         # Auth API calls
│       ├── auth.store.ts       # Zustand auth state
│       ├── auth.types.ts       # TypeScript types
│       └── auth.schemas.ts     # Zod validation schemas
├── lib/
│   └── api/
│       ├── rawClient.ts        # Base Axios instance
│       ├── apiClient.ts        # Axios with auto-refresh
│       ├── refreshGate.ts      # Single-flight refresh
│       └── errors.ts           # Error handling
├── providers/
│   └── queryClient.tsx         # React Query provider
└── hooks/
    └── useStorageState.ts      # SecureStore React hook wrapper
```

## Getting Started

### Prerequisites

- Node.js and Bun
- Expo CLI
- FastAPI backend running (see [Backend Setup](#backend-setup))
- Expo Go app on your device (or iOS/Android simulator)

### Installation

```bash
# Install dependencies
bun install
```

### Environment Configuration

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api/v1
```

> **Important**: For Expo Go on physical devices, use your LAN IP address (e.g., `192.168.1.100:8000`), NOT `localhost`.

### Run the App

```bash
# Start the development server
bun start

# Or with Expo CLI
npx expo start
```

Then scan the QR code with Expo Go on your device.

## Backend Setup

This app requires a FastAPI backend with mobile-specific auth endpoints:

```
POST /api/v1/login/mobile     - Returns access_token + refresh_token
POST /api/v1/refresh/mobile   - Refresh with body { refresh_token }
POST /api/v1/logout/mobile    - Invalidate tokens
POST /api/v1/user             - Register new user
GET  /api/v1/user/me/         - Get current user (Bearer auth)
```

See `docs/expo-rn-auth-integration.md` for backend implementation details.

## Authentication Flow

### Token Strategy

| Token | Storage | Purpose |
|-------|---------|---------|
| Access Token | In-memory (Zustand) | API requests via Bearer header |
| Refresh Token | SecureStore (encrypted) | Token rotation on expiry |

### Login Flow

```
User enters credentials
        ↓
POST /login/mobile
        ↓
Receive tokens
        ↓
Store refresh_token in SecureStore
Store access_token in Zustand
        ↓
Fetch user profile
        ↓
Navigate to home
```

### Auto-Refresh Flow

```
API request with Bearer token
        ↓
Receive 401 Unauthorized
        ↓
Single-flight refresh (only one request)
        ↓
Get new tokens (rotate refresh_token)
        ↓
Update storage
        ↓
Retry original request
```

## Development

### Type Checking

```bash
bun run tsc --noEmit
```

### Linting

```bash
bun run lint
```

## Documentation

- [Auth Implementation Plan](docs/mobile-auth-implementation-plan.zh-CN.md) - Implementation guide (Chinese)
- [Axios Architecture Plan](docs/mobile-axios-architecture-plan.zh-CN.md) - Architecture overview (Chinese)
- [Code Explanation](docs/auth-code-explanation.zh-CN.md) - Detailed code walkthrough (Chinese)

## License

MIT
