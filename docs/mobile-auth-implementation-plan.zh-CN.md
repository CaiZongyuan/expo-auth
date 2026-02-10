# Expo Go + FastAPI（移动端非 Cookie Refresh）实施计划（前端）

日期：2026-02-10

本计划基于仓库内现有文档：
- `docs/expo-rn-auth-integration.md`
- `docs/mobile-axios-architecture-plan.zh-CN.md`
- `docs/auth-guide.md`

并以当前后端实现为准（`/api/v1/login/mobile`、`/api/v1/refresh/mobile` *refresh rotation*、`/api/v1/logout/mobile`、`/api/v1/user/me/`、`POST /api/v1/user`）。

---

## 0. 范围与验收标准

### 本次范围
- 登录（mobile）：`POST /api/v1/login/mobile`（`x-www-form-urlencoded`）
- 注册：`POST /api/v1/user`
- 启动恢复会话（bootstrap）：SecureStore 读 refresh → refresh/mobile → user/me
- 自动续期：401 触发 refresh（single-flight），成功后重放一次请求
- 退出登录：`POST /api/v1/logout/mobile`（body refresh_token，可选带 access token）

### 验收标准（必须全部满足）
- App 启动时存在 refresh token：自动进入已登录态并展示用户信息
- access 过期后：任意受保护请求 401 会自动刷新并重放一次
- 并发 401：同一时刻只会发起 **一次** refresh 请求（single-flight）
- refresh 失败：清理本地 token，回到登录页
- logout：后端接口调用 + 本地 token 清理 + 路由回到登录

---

## 1. 技术选型（明确到库）

- 路由：`expo-router`
- 网络层：`axios`
- 会话状态：`zustand`（access token 仅内存）
- 服务端状态：`@tanstack/react-query`（本次先接入 Provider，为后续业务铺路）
- 安全存储：`expo-secure-store`（refresh token 持久化；支持 web fallback）
- 表单：`react-hook-form` + `zod` + `@hookform/resolvers`

---

## 2. 环境与配置

### Expo Go（真机）注意事项
- Expo Go 跑在手机上时，`localhost` 指向手机本机，不是后端。
- 必须使用后端在局域网内可访问的 IP（例如 `http://192.168.x.x:8000`）。

### 环境变量
- `EXPO_PUBLIC_API_BASE_URL=http://<LAN_IP>:8000`
- 代码内部会将其规范化为 `.../api/v1` 作为 Axios `baseURL`。

---

## 3. 前端模块划分与文件落点

> 目标：避免循环依赖，避免 refresh 递归；让“鉴权底座”可复用扩展业务模块。

### 3.1 Core
- `src/core/config/env.ts`：读取并校验 `EXPO_PUBLIC_API_BASE_URL`，输出 `API_V1_BASE_URL`
- `src/core/storage/secureStorage.ts`：SecureStore + Web(localStorage) 统一封装
- `src/core/storage/refreshToken.ts`：refresh token 的 get/set/clear（单一入口）

### 3.2 API Client
- `src/lib/api/rawClient.ts`：无拦截器 Axios（用于 login/refresh/logout/register 等“鉴权端点”）
- `src/lib/api/refreshGate.ts`：single-flight gate（全局只允许一个 refresh 进行）
- `src/lib/api/apiClient.ts`：带拦截器 Axios（自动注入 Bearer、401→refresh→重放）
- `src/lib/api/errors.ts`：后端错误消息提取与标准化

### 3.3 Auth Feature
- `src/features/auth/auth.types.ts`：`MobileToken`、`UserRead` 等 TS 类型
- `src/features/auth/auth.api.ts`：封装后端端点（基于 `rawClient`）
- `src/features/auth/auth.schemas.ts`：`zod` 表单 schema（sign-in / sign-up）
- `src/features/auth/auth.store.ts`：Zustand 会话状态机与动作：
  - `bootstrap()`
  - `signIn()`
  - `signUp()`（注册后自动登录）
  - `signOut()`
  - `refreshAccessToken()`（供 refresh gate 调用）

### 3.4 Providers
- `src/providers/queryClient.tsx`：QueryClient + Provider（根布局注入）

### 3.5 Routes & UI
- `src/app/_layout.tsx`：根布局；初始化 bootstrap；按 `status` 做路由守卫
- `src/components/splash.tsx`：booting 期间保持 splash，bootstrap 完成后 hide
- `src/app/sign-in.tsx`：登录表单（RHF+Zod）
- `src/app/sign-up.tsx`：注册表单（RHF+Zod）
- `src/app/(home)/index.tsx`：展示 user 信息 + sign out

---

## 4. 实施步骤（按落地顺序）

1) 新增 env 与 storage 封装（不引入业务）
2) 新增 `rawClient` 与 Auth API（login/register/refresh/logout/me）
3) 新增 Zustand `auth.store`（状态机 + bootstrap + sign-in/up/out）
4) 新增 `refreshGate` + `apiClient`（拦截器、401 自动续期、single-flight）
5) 接入 React Query Provider（根布局）
6) 重写 routes：`_layout`/`sign-in`/`sign-up`/`(home)/index`
7) 自测流程（真机 Expo Go）：
   - 注册 → 自动登录
   - 杀进程重开 → bootstrap 进入 authed
   - 人为让 access 过期（等待/后端改短）→ 自动 refresh 并重放
   - logout → 回到 guest

---

## 5. 验证命令（每次改完必须跑）

```bash
bun run tsc --noEmit

# lint（Linux 环境可跳过）
bun run lint
```

