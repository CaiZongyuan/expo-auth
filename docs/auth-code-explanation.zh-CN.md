# 移动端认证系统代码详解

本文档详细解释移动端 FastAPI 认证系统的实现代码，帮助理解每个模块的作用和设计思路。

---

## 目录

1. [整体架构](#整体架构)
2. [配置层 (env.ts)](#配置层-envts)
3. [存储层 (storage)](#存储层-storage)
4. [API 层 (lib/api)](#api-层-libapi)
5. [认证功能 (features/auth)](#认证功能-featuresauth)
6. [UI 组件](#ui-组件)
7. [数据流图解](#数据流图解)
8. [关键技术点](#关键技术点)

---

## 整体架构

```
src/
├── core/
│   ├── config/
│   │   └── env.ts              # 环境变量配置
│   └── storage/
│       ├── secureStorage.ts    # 安全存储封装
│       └── refreshToken.ts     # Refresh Token 专用存储
├── lib/
│   └── api/
│       ├── rawClient.ts        # 原始 Axios 实例
│       ├── apiClient.ts        # 带自动刷新的 Axios 实例
│       ├── refreshGate.ts      # 并发刷新控制
│       └── errors.ts           # 错误处理
├── features/
│   └── auth/
│       ├── auth.api.ts         # 认证 API 调用
│       ├── auth.store.ts       # Zustand 认证状态管理
│       ├── auth.types.ts       # TypeScript 类型定义
│       └── auth.schemas.ts     # Zod 验证模式
└── providers/
    └── queryClient.tsx         # React Query 配置
```

---

## 配置层 (env.ts)

**文件**: `src/core/config/env.ts`

```typescript
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Missing ${name}. Set it in .env (Expo Go 真机请使用局域网 IP，而不是 localhost).`
    );
  }
  return value;
}

function normalizeApiV1BaseUrl(rawBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawBaseUrl.trim());
  } catch {
    throw new Error(`[env] Invalid EXPO_PUBLIC_API_BASE_URL: ${rawBaseUrl}`);
  }

  // 验证协议必须是 http 或 https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('[env] EXPO_PUBLIC_API_BASE_URL must start with http:// or https://');
  }

  // 规范化路径，确保以 /api/v1 结尾
  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api/v1') {
    throw new Error('[env] EXPO_PUBLIC_API_BASE_URL must be host only, or end with /api/v1');
  }

  const origin = url.origin.replace(/\/+$/, '');
  return path === '/api/v1' ? `${origin}/api/v1` : `${origin}/api/v1`;
}

export const API_V1_BASE_URL = normalizeApiV1BaseUrl(requiredEnv('EXPO_PUBLIC_API_BASE_URL'));
```

### 设计要点

| 函数 | 作用 |
|------|------|
| `requiredEnv` | 确保环境变量存在，否则抛出错误 |
| `normalizeApiV1BaseUrl` | 规范化 API URL，自动添加 `/api/v1` 路径 |

**环境变量配置示例** (`.env`):
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000/api/v1
# 或
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
```

> **注意**: Expo Go 真机调试必须使用局域网 IP，不能用 `localhost`！

---

## 存储层 (storage)

### secureStorage.ts - 安全存储封装

**文件**: `src/core/storage/secureStorage.ts`

```typescript
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
    } catch {
      return;
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
    } catch {
      return;
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
```

### 设计要点

| 平台 | 存储方式 | 安全性 |
|------|----------|--------|
| iOS | Keychain | 系统级加密 |
| Android | Encrypted SharedPreferences | 系统级加密 |
| Web | localStorage | 明文 (仅开发用) |

**统一接口** - 三个函数提供跨平台一致的安全存储 API。

### refreshToken.ts - Refresh Token 专用存储

**文件**: `src/core/storage/refreshToken.ts`

```typescript
import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStorage';

const REFRESH_TOKEN_KEY = 'refresh_token';

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await setSecureItem(REFRESH_TOKEN_KEY, token);
}

export async function clearRefreshToken(): Promise<void> {
  await deleteSecureItem(REFRESH_TOKEN_KEY);
}
```

### 设计要点

- **单一职责**: 专门管理 refresh token 的存储
- **常量定义**: `REFRESH_TOKEN_KEY` 避免硬编码字符串错误
- **类型安全**: 返回类型明确为 `Promise<string | null>`

---

## API 层 (lib/api)

### rawClient.ts - 原始 Axios 实例

**文件**: `src/lib/api/rawClient.ts`

```typescript
import axios from 'axios';
import { API_V1_BASE_URL } from '@/src/core/config/env';

export const rawClient = axios.create({
  baseURL: API_V1_BASE_URL,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});
```

### 设计要点

| 属性 | 值 | 说明 |
|------|-----|------|
| `baseURL` | 环境变量 | 从 `env.ts` 获取 |
| `timeout` | 15000ms | 15 秒超时 |
| `Accept` | `application/json` | 告诉服务器返回 JSON |

**用途**: 用于不需要认证的 API 调用（如登录、注册、刷新 token）。

---

### apiClient.ts - 带自动刷新的 Axios 实例

**文件**: `src/lib/api/apiClient.ts`

```typescript
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_V1_BASE_URL } from '@/src/core/config/env';
import { useAuthStore } from '@/src/features/auth/auth.store';
import { runRefreshSingleFlight } from './refreshGate';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL: API_V1_BASE_URL,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

// 请求拦截器：自动添加 Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 时自动刷新 token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    // 不满足重试条件，直接拒绝
    if (!originalRequest || originalRequest._retry || status !== 401) {
      return Promise.reject(error);
    }

    // 标记为已重试，防止无限循环
    originalRequest._retry = true;

    try {
      // 单飞刷新：多个 401 请求只刷新一次
      const nextAccessToken = await runRefreshSingleFlight(() =>
        useAuthStore.getState().refreshAccessToken(),
      );

      // 更新请求的 Authorization 头
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

      // 重新发起原始请求
      return apiClient(originalRequest);
    } catch (refreshError) {
      // 刷新失败，清除会话
      await useAuthStore.getState().clearSession();
      return Promise.reject(refreshError);
    }
  },
);
```

### 设计要点

**请求流程**:
```
发起请求 → 拦截器添加 Token → 服务器响应
                ↓
            401 错误？
                ↓ 是
        单飞刷新 Token
                ↓
         重新发起请求
```

**防止重试循环**: 使用 `_retry` 标记确保每个请求只重试一次。

---

### refreshGate.ts - 并发刷新控制

**文件**: `src/lib/api/refreshGate.ts`

```typescript
let inFlightRefresh: Promise<string> | null = null;

export async function runRefreshSingleFlight(task: () => Promise<string>): Promise<string> {
  if (!inFlightRefresh) {
    inFlightRefresh = task().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}
```

### 设计要点

**问题场景**: 同时发起 3 个 API 请求，都收到 401

```
请求 A (401) ──┐
请求 B (401) ──┼──> 同时调用 refreshAccessToken() ?
请求 C (401) ──┘

没有 refreshGate: 3 个刷新请求 → token 竞争 → 可能失败
有 refreshGate:    1 个刷新请求 → 其他等待 → 共用新 token
```

**单飞模式 (Single-flight)**:
- 第一个调用触发刷新
- 后续调用复用正在进行的 Promise
- 刷新完成后重置 `inFlightRefresh`

---

### errors.ts - 错误处理

**文件**: `src/lib/api/errors.ts`

```typescript
import { isAxiosError } from 'axios';

export type NormalizedApiError = {
  status: number | null;
  message: string;
  detail?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// 提取 FastAPI 验证错误信息
function extractFastApiDetailMessage(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (isRecord(item) && typeof item.msg === 'string' ? item.msg : null))
      .filter((m): m is string => Boolean(m));

    if (messages.length > 0) return messages.join('\n');
  }

  return null;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const data = error.response?.data;

    if (typeof data === 'string') {
      return { status, message: data };
    }

    if (isRecord(data)) {
      if (typeof data.message === 'string') {
        return { status, message: data.message, detail: data };
      }

      if ('detail' in data) {
        const message = extractFastApiDetailMessage(data.detail) ?? 'Request failed';
        return { status, message, detail: data.detail };
      }
    }

    return { status, message: error.message || 'Request failed' };
  }

  if (error instanceof Error) {
    return { status: null, message: error.message };
  }

  return { status: null, message: 'Unknown error' };
}

export function getApiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}
```

### 设计要点

**支持多种错误格式**:

| 格式 | 示例 | 处理结果 |
|------|------|----------|
| 字符串 | `"Invalid credentials"` | 直接作为 message |
| { message } | `{ "message": "User not found" }` | 提取 message |
| FastAPI detail | `{ "detail": [{ "msg": "email is required" }] }` | 提取验证消息 |

---

## 认证功能 (features/auth)

### auth.types.ts - 类型定义

**文件**: `src/features/auth/auth.types.ts`

```typescript
export type MobileToken = {
  access_token: string;   // 短期访问令牌
  refresh_token: string;  // 长期刷新令牌
  token_type: string;     // 通常是 "bearer"
};

export type UserRead = {
  id: number;
  name: string;
  username: string;
  email: string;
  profile_image_url: string;
  tier_id: number | null;
};

export type UserCreate = {
  name: string;
  username: string;
  email: string;
  password: string;
};
```

---

### auth.schemas.ts - Zod 验证

**文件**: `src/features/auth/auth.schemas.ts`

```typescript
import { z } from 'zod';

export const signInSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Please enter your username or email'),
  password: z.string().min(1, 'Please enter your password'),
});

export type SignInForm = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(30, 'Name must be at most 30 characters'),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-z0-9]+$/, 'Only lowercase letters and numbers are allowed'),
  email: z.email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignUpForm = z.infer<typeof signUpSchema>;
```

### 设计要点

| 字段 | 验证规则 |
|------|----------|
| `name` | 2-30 字符 |
| `username` | 2-20 字符，仅小写字母和数字 |
| `email` | 有效邮箱格式 |
| `password` | 最少 8 字符 |

**类型推导**: `z.infer<>` 自动从 schema 生成 TypeScript 类型。

---

### auth.api.ts - API 调用

**文件**: `src/features/auth/auth.api.ts`

```typescript
import type { AxiosRequestConfig } from 'axios';
import { rawClient } from '@/src/lib/api/rawClient';
import type { MobileToken, UserCreate, UserRead } from './auth.types';

// URL 编码辅助函数
function toFormUrlEncoded(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

// 登录：使用 form-url-encoded 格式
export async function loginMobile(usernameOrEmail: string, password: string): Promise<MobileToken> {
  const body = toFormUrlEncoded({ username: usernameOrEmail, password });

  const response = await rawClient.post<MobileToken>('/login/mobile', body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}

// 刷新 token：使用 JSON 格式
export async function refreshMobile(refreshToken: string): Promise<MobileToken> {
  const response = await rawClient.post<MobileToken>('/refresh/mobile', { refresh_token: refreshToken });
  return response.data;
}

// 登出：可选传入 access token
export async function logoutMobile(refreshToken: string, accessToken?: string | null): Promise<void> {
  const config: AxiosRequestConfig = {};

  if (accessToken) {
    config.headers = { Authorization: `Bearer ${accessToken}` };
  }

  await rawClient.post('/logout/mobile', { refresh_token: refreshToken }, config);
}

// 注册：创建新用户
export async function registerUser(input: UserCreate): Promise<UserRead> {
  const response = await rawClient.post<UserRead>('/user', input);
  return response.data;
}

// 获取当前用户信息
export async function getMe(accessToken: string): Promise<UserRead> {
  const response = await rawClient.get<UserRead>('/user/me/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}
```

### 设计要点

| 端点 | Content-Type | 说明 |
|------|--------------|------|
| `/login/mobile` | form-url-encoded | OAuth2 标准 |
| `/refresh/mobile` | JSON | 刷新 token |
| `/logout/mobile` | JSON | 使 token 失效 |
| `/user` | JSON | 注册用户 |
| `/user/me/` | - | 需要认证 |

**为什么登录用 form-url-encoded？**
这是 OAuth2 Password Flow 的标准要求，后端 FastAPI 的 OAuth2 期望这种格式。

---

### auth.store.ts - Zustand 状态管理

**文件**: `src/features/auth/auth.store.ts`

```typescript
import { create } from 'zustand';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from '@/src/core/storage/refreshToken';
import { getMe, loginMobile, logoutMobile, refreshMobile, registerUser } from './auth.api';
import type { UserCreate, UserRead } from './auth.types';

export type SessionStatus = 'booting' | 'guest' | 'authed';

type AuthState = {
  status: SessionStatus;
  accessToken: string | null;
  user: UserRead | null;

  bootstrap: () => Promise<void>;
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signUp: (input: UserCreate) => Promise<void>;
  signOut: () => Promise<void>;

  refreshAccessToken: () => Promise<string>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  accessToken: null,
  user: null,

  // 清除会话：清除存储 + 重置状态
  clearSession: async () => {
    try {
      await clearRefreshToken();
    } finally {
      set({ status: 'guest', accessToken: null, user: null });
    }
  },

  // 刷新 access token
  refreshAccessToken: async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokens = await refreshMobile(refreshToken);
    await setRefreshToken(tokens.refresh_token); // 保存新的 refresh token
    set({ accessToken: tokens.access_token });

    return tokens.access_token;
  },

  // 启动：尝试恢复会话
  bootstrap: async () => {
    set({ status: 'booting' });

    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      set({ status: 'guest', accessToken: null, user: null });
      return;
    }

    try {
      const accessToken = await get().refreshAccessToken();
      const user = await getMe(accessToken);
      set({ status: 'authed', user });
    } catch {
      await get().clearSession();
    }
  },

  // 登录
  signIn: async (usernameOrEmail, password) => {
    try {
      const tokens = await loginMobile(usernameOrEmail, password);
      await setRefreshToken(tokens.refresh_token);
      set({ accessToken: tokens.access_token });

      const user = await getMe(tokens.access_token);
      set({ status: 'authed', user });
    } catch (error) {
      await get().clearSession();
      throw error;
    }
  },

  // 注册：注册后自动登录
  signUp: async (input) => {
    await registerUser(input);
    await get().signIn(input.username, input.password);
  },

  // 登出：最佳努力清除服务端会话
  signOut: async () => {
    const accessToken = get().accessToken;
    const refreshToken = await getRefreshToken();

    try {
      if (refreshToken) {
        await logoutMobile(refreshToken, accessToken);
      }
    } catch {
      // Best-effort; local session still must be cleared.
    }

    await get().clearSession();
  },
}));
```

### 设计要点

**状态流转**:
```
booting ──► guest ──► authed
   ▲           │         │
   │           └─────────┘
   │             signOut
   │
   └──── bootstrap (app 启动时)
```

**Token 存储**:
| Token | 存储位置 | 原因 |
|-------|----------|------|
| `access_token` | Zustand (内存) | 短期有效，无需持久化 |
| `refresh_token` | SecureStore | 长期有效，需要加密存储 |

**关键方法**:
| 方法 | 作用 |
|------|------|
| `bootstrap` | App 启动时恢复会话 |
| `signIn` | 登录并获取用户信息 |
| `signUp` | 注册后自动登录 |
| `signOut` | 清除本地和服务端会话 |
| `refreshAccessToken` | 刷新 token 并更新存储 |
| `clearSession` | 清除所有认证状态 |

---

## UI 组件

### sign-up.tsx - 注册页面

**文件**: `src/app/sign-up.tsx`

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { signUpSchema, type SignUpForm } from '@/src/features/auth/auth.schemas';
import { useAuthStore } from '@/src/features/auth/auth.store';
import { getApiErrorMessage } from '@/src/lib/api/errors';

export default function SignUp() {
  const signUp = useAuthStore((s) => s.signUp);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', username: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUp(values);
      router.replace('/');  // 注册成功后跳转到首页
    } catch (error) {
      Alert.alert('Sign up failed', getApiErrorMessage(error));
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Name"
            textContentType="name"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
          />
        )}
      />
      {errors.name ? <Text style={styles.error}>{errors.name.message}</Text> : null}

      {/* username, email, password 字段类似... */}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Create Account</Text>}
      </Pressable>

      <Link href="/sign-in" style={styles.link}>
        Already have an account? Sign In
      </Link>
    </View>
  );
}
```

### 设计要点

- **react-hook-form**: 表单状态管理
- **zodResolver**: 自动验证表单
- **Controller**: 桥接 React Native TextInput 和 react-hook-form
- **isSubmitting**: 防止重复提交
- **router.replace('/')**: 注册成功后替换导航栈

---

## 数据流图解

### 登录流程

```
┌─────────┐     ┌────────────┐     ┌──────────┐     ┌─────────┐
│  用户   │ ──> │ signIn()   │ ──> │ FastAPI  │ ──> │ 返回    │
│ 输入    │     │ auth.store │     │ /login   │     │ tokens  │
└─────────┘     └────────────┘     └──────────┘     └─────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────┐
                    │ 1. 保存 refresh_token 到 SecureStore   │
                    │ 2. 保存 access_token 到 Zustand        │
                    │ 3. 调用 getMe() 获取用户信息           │
                    │ 4. 更新状态为 authed                  │
                    └──────────────────────────────────────┘
```

### Token 刷新流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        apiClient 请求                            │
│                           ↓                                     │
│                    收到 401 响应                                 │
│                           ↓                                     │
│              检查 originalRequest._retry?                       │
│                    ↓         ↓                                  │
│                  是          否                                 │
│                  │           │                                  │
│                  │    ┌──────────────┐                          │
│                  │    │ 标记 _retry   │                          │
│                  │    │ = true       │                          │
│                  │    └──────┬───────┘                          │
│                  │           │                                  │
│                  │    ┌──────────────┐                          │
│                  └────→│ 返回错误     │                          │
│                       └──────────────┘                          │
│                           ↓ (否)                                │
│              ┌─────────────────────────┐                        │
│              │ runRefreshSingleFlight  │                        │
│              │ (单飞模式)              │                        │
│              └───────────┬─────────────┘                        │
│                          │                                      │
│              ┌───────────▼─────────────┐                        │
│              │ refreshAccessToken()    │                        │
│              │ 1. 获取存储的 RT        │                        │
│              │ 2. 调用 /refresh/mobile │                        │
│              │ 3. 更新存储的 RT        │ ← Token Rotation      │
│              │ 4. 更新 Zustand 的 AT   │                        │
│              └───────────┬─────────────┘                        │
│                          │                                      │
│                          ▼                                      │
│              ┌─────────────────────┐                           │
│              │ 用新 AT 重试原请求   │                           │
│              └─────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### 并发请求场景

```
时间轴
  │
  ├─ 请求 A 发起 ──> 401 ──┐
  │                        │
  ├─ 请求 B 发起 ──> 401 ──┤
  │                        ├─> refreshGate.inFlightRefresh = null
  ├─ 请求 C 发起 ──> 401 ──┤     第一个触发刷新
  │                        │         │
  │                        │         ▼
  │                        │    调用 refresh API
  │                        │         │
  │                        │         ▼
  │                        │    获得新 token
  │                        │         │
  │                        │         ▼
  │                        │    ┌─────────────────────┐
  │                        └────> 所有请求复用新 token │
  │                             └─────────────────────┘
  ▼
```

---

## 关键技术点

### 1. Token Rotation (令牌轮换)

每次刷新 token 时，服务端会返回新的 `refresh_token`，旧的会失效：

```typescript
const tokens = await refreshMobile(oldRefreshToken);
// tokens.refresh_token 是新的！
await setRefreshToken(tokens.refresh_token); // 必须更新存储
```

**好处**: 如果旧 refresh token 被泄露，只能使用一次。

### 2. Single-flight Refresh

防止并发 401 导致多次刷新请求：

```typescript
// 如果正在刷新，复用 Promise
if (!inFlightRefresh) {
  inFlightRefresh = task().finally(() => {
    inFlightRefresh = null;
  });
}
return inFlightRefresh;
```

### 3. 移动端 vs Web 端认证差异

| 特性 | 移动端 | Web 端 |
|------|--------|--------|
| Refresh Token 存储 | SecureStore (加密) | HttpOnly Cookie |
| Access Token 存储 | 内存 | 内存 |
| 跨域问题 | 无 | 需要 CORS |

### 4. 状态管理选择

为什么用 Zustand 而不是 Context？

| 特性 | Zustand | Context |
|------|---------|---------|
| 重新渲染 | 精确控制 | 整棵树 |
| 代码量 | 少 | 多 |
| 性能 | 好 | 差 (大状态) |

---

## 总结

这个认证系统的核心设计理念：

1. **分层清晰**: 配置 → 存储 → API → 业务逻辑 → UI
2. **安全第一**: Refresh Token 加密存储，Access Token 仅存内存
3. **用户体验**: 自动刷新 token，用户无感知
4. **错误处理**: 统一的错误格式化和友好提示
5. **类型安全**: 全链路 TypeScript 类型检查

希望这份文档能帮助你理解代码的每一个细节！
