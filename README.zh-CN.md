# Expo FastAPI 认证应用

一个基于 React Native + Expo 的移动应用，集成 FastAPI 后端认证功能。支持基于令牌的身份验证、自动令牌刷新、路由守卫和移动端优先的安全策略。

## 功能特性

- **用户认证**: 注册、登录、登出，基于令牌的身份验证
- **自动令牌刷新**: 无感知的令牌轮换，用户体验流畅
- **路由守卫**: 自动重定向未认证用户
- **安全存储**: 使用 Expo SecureStore 加密存储令牌
- **类型安全**: 完整的 TypeScript 支持，Zod 验证
- **表单验证**: react-hook-form + Zod 客户端表单验证
- **状态管理**: Zustand 管理认证状态，React Query 管理服务端状态

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React Native + Expo (~54.0) |
| 路由 | Expo Router (文件路由) |
| 状态管理 | Zustand + React Query |
| 表单 | react-hook-form + Zod |
| HTTP 客户端 | Axios |
| 安全存储 | expo-secure-store |
| 语言 | TypeScript |

## 项目结构

```
src/
├── app/                    # Expo Router 页面
│   ├── _layout.tsx         # 根导航器，带认证守卫
│   ├── sign-in.tsx         # 登录页
│   ├── sign-up.tsx         # 注册页
│   └── (home)/
│       └── index.tsx       # 受保护的主页
├── components/
│   └── splash.tsx          # 启动屏控制器
├── core/
│   ├── config/
│   │   └── env.ts          # 环境变量配置
│   └── storage/
│       ├── secureStorage.ts    # SecureStore 封装 (iOS Keychain / Android Keystore)
│       └── refreshToken.ts     # Refresh Token 持久化
├── features/
│   └── auth/
│       ├── auth.api.ts         # 认证 API 调用
│       ├── auth.store.ts       # Zustand 认证状态
│       ├── auth.types.ts       # TypeScript 类型
│       └── auth.schemas.ts     # Zod 验证模式
├── lib/
│   └── api/
│       ├── rawClient.ts        # 基础 Axios 实例
│       ├── apiClient.ts        # 带自动刷新的 Axios
│       ├── refreshGate.ts      # 单飞刷新控制
│       └── errors.ts           # 错误处理
├── providers/
│   └── queryClient.tsx         # React Query 提供者
└── hooks/
    └── useStorageState.ts      # SecureStore React Hook 封装
```

## 快速开始

### 前置要求

- Node.js 和 Bun
- Expo CLI
- 运行中的 FastAPI 后端（见[后端配置](#后端配置)）
- Expo Go 应用（或 iOS/Android 模拟器）

### 安装依赖

```bash
# 安装依赖
bun install
```

### 环境变量配置

在项目根目录创建 `.env` 文件：

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api/v1
```

> **重要提示**: 在 Expo Go 真机调试时，请使用局域网 IP 地址（如 `192.168.1.100:8000`），不要使用 `localhost`。

### 运行应用

```bash
# 启动开发服务器
bun start

# 或使用 Expo CLI
npx expo start
```

然后用 Expo Go 扫描二维码即可。

## 后端配置

本应用需要支持移动端认证的 FastAPI 后端，提供以下接口：

```
POST /api/v1/login/mobile     - 返回 access_token + refresh_token
POST /api/v1/refresh/mobile   - 刷新令牌，请求体 { refresh_token }
POST /api/v1/logout/mobile    - 使令牌失效
POST /api/v1/user             - 注册新用户
GET  /api/v1/user/me/         - 获取当前用户（需 Bearer 认证）
```

详见 `docs/expo-rn-auth-integration.md` 了解后端实现细节。

## 认证流程

### 令牌策略

| 令牌 | 存储位置 | 用途 |
|------|----------|------|
| Access Token | 内存 (Zustand) | 通过 Bearer 头发起 API 请求 |
| Refresh Token | SecureStore (加密) | 过期时刷新令牌 |

### 登录流程

```
用户输入凭证
        ↓
POST /login/mobile
        ↓
获取令牌
        ↓
Refresh Token 存入 SecureStore
Access Token 存入 Zustand
        ↓
获取用户信息
        ↓
跳转主页
```

### 自动刷新流程

```
API 请求携带 Bearer Token
        ↓
收到 401 未授权
        ↓
单飞刷新（只发一个请求）
        ↓
获取新令牌（轮换 refresh_token）
        ↓
更新存储
        ↓
重试原始请求
```

## 开发

### 类型检查

```bash
bun run tsc --noEmit
```

### 代码检查

```bash
bun run lint
```

## 文档

- [认证实现计划](docs/mobile-auth-implementation-plan.zh-CN.md) - 实现指南
- [Axios 架构计划](docs/mobile-axios-architecture-plan.zh-CN.md) - 架构说明
- [代码详解](docs/auth-code-explanation.zh-CN.md) - 代码详细讲解

## 依赖说明

### 核心依赖
- `expo` ~54.0 - Expo 框架
- `react-native` 0.81.5 - React Native 核心
- `expo-router` - 文件路由
- `expo-secure-store` - 加密存储

### API 与状态管理
- `axios` - HTTP 客户端
- `@tanstack/react-query` - 服务端状态管理
- `zustand` - 客户端状态管理

### 表单与验证
- `react-hook-form` - 表单状态
- `@hookform/resolvers` - 表单验证集成
- `zod` - 模式验证

## 许可证

MIT
