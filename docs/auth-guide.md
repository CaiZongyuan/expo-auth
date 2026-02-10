下面我按 **benavlabs FastAPI-boilerplate 的 JWT + User Management 设计**（access token + refresh token、refresh 默认用 Cookie、/login、/refresh、/logout、/user、/user/me/ 等）来给你一个 **React Native + Expo（移动端）“最佳实践”认证前端架构**。关键点是：后端文档把 refresh token 放在 **HTTP-only cookie**（浏览器模型）里 ([benavlabs.github.io][1])，但你是 **RN/Expo**，需要做一次“移动端适配层”，否则会在 cookie 持久化、withCredentials、httponly 语义上踩坑。

---

## 1) 后端认证机制要点（决定前端架构边界）

* **Access token**：短期（文档示例为 30 分钟，可配置），每次请求用 `Authorization: Bearer <token>` ([benavlabs.github.io][1])
* **Refresh token**：长期（文档示例为 7 天，可配置），默认通过 **Secure / HttpOnly / SameSite=Lax** 的 cookie 下发与携带 ([benavlabs.github.io][1])
* **登录流程**：前端 POST `/api/v1/login`（OAuth2PasswordRequestForm / x-www-form-urlencoded），返回 access token；同时服务端设置 refresh cookie；浏览器端需要 `credentials: 'include'` ([benavlabs.github.io][1])
* **刷新**：POST `/refresh`，服务端从 `Cookie(refresh_token)` 取 refresh token ([benavlabs.github.io][1])
* **用户管理**：注册 `POST /user` ([benavlabs.github.io][2])；获取当前用户 `GET /user/me/`（Bearer access token）([benavlabs.github.io][2])

---

## 2) 你的目标：移动端“最佳”认证架构的原则

移动端和 Web 最大差异：**你不应该把 refresh token 当 cookie 机制去依赖**。最稳的做法是：

1. **Access token 只放内存**（避免落盘泄漏面扩大）。
2. **Refresh token 放 Secure Storage**（Expo：`expo-secure-store`），并通过“移动端适配方案”发给后端完成 refresh。
3. 统一的 API Client（fetch/axios）负责：

   * 自动加 Bearer
   * 401 自动 refresh + 重放请求
   * 并发刷新去重（single-flight）
4. 全局 Auth State（Zustand/Redux/Context 均可），但**token 逻辑不要散落在 UI**。

---

## 3) 两种可行落地方案（你选其一，别混用）

### 方案 A（推荐，最干净）：后端为移动端提供“非 Cookie refresh”入口

**改后端（或加一个分支）**：允许 refresh token 从请求体/Authorization/自定义 header 读取，而不仅是 Cookie。原因：文档的 refresh endpoint 目前是 `refresh_token: str = Cookie(None)` ([benavlabs.github.io][1])，这是典型 Web cookie 设计。

**移动端协议建议：**

* 登录 `/login`：返回 `access_token`，并在 JSON 里**额外返回 refresh_token**（仅对移动端 client），或者提供 `/login/mobile`。
* 刷新 `/refresh`：移动端发 `{ refresh_token }`（body）或 `Authorization: Bearer <refresh_token>`（单独 token_type=refresh）。

优点：简单、语义清晰、跨平台一致；你也不需要在 RN 里折腾 cookie jar。

### 方案 B（不改后端）：移动端“伪装 cookie”携带 refresh_token

如果你现在不想动后端，就让 RN 在调用 `/refresh` 时**手动带 Cookie header**：

* SecureStore 里存 refresh_token
* refresh 时发 `Cookie: refresh_token=<token>`（等价于浏览器自动带 cookie）

注意：后端登录时设置的 `HttpOnly/SameSite` 对 RN 不是强约束；RN 并不天然实现浏览器 cookie 的安全模型。文档 cookie 配置主要是给浏览器的 XSS/CSRF 语境 ([benavlabs.github.io][1])。移动端这里你要靠 SecureStore + TLS 来兜底。

---

## 4) 推荐的前端模块化架构（Expo/RN）

### (1) 分层结构

* `auth/TokenStore.ts`

  * `getAccessToken()`（内存）
  * `setAccessToken(token)`
  * `getRefreshToken()`（SecureStore）
  * `setRefreshToken(token)` / `clear()`
* `auth/AuthService.ts`

  * `login(username, password)` → 调 `/login`（form-urlencoded）([benavlabs.github.io][1])
  * `refresh()` → 调 `/refresh`（方案A或B）
  * `logout()` → 调 `/logout` + 清本地（后端有 logout 实现与 token blacklist 思路）([benavlabs.github.io][1])
* `api/client.ts`

  * `request()`：自动加 Bearer；401 → `refresh()` → 重放
  * 并发刷新 single-flight（避免 10 个请求同时 401 触发 10 次 refresh）
* `state/authStore.ts`（Zustand/Redux）

  * `status: 'booting'|'authed'|'guest'`
  * `user`（来自 `/user/me/`）([benavlabs.github.io][2])
* `navigation/guards.tsx`

  * 根据 `status` 决定路由栈（Public / Authed）

### (2) App 启动（bootstrap）流程

1. `status='booting'`
2. 从 SecureStore 取 refresh_token
3. 若存在：调用 `refresh()` 拿到 access_token（后端 refresh 逻辑）([benavlabs.github.io][1])
4. 成功后调 `/user/me/` 拉 user profile ([benavlabs.github.io][2])
5. 成功 → `status='authed'`；失败 → 清 token → `status='guest'`

### (3) 请求侧自动续期（关键）

* 所有业务 API 都走 `apiClient.request`
* 若 401：

  * 如果当前没有刷新在进行：触发一次 refresh
  * 等 refresh 完成后重放原请求
  * refresh 失败：清 token、踢回登录页

---

## 5) 与后端端点对齐的具体交互（按文档）

### 注册

* `POST /user`（JSON），成功 201 返回用户 ([benavlabs.github.io][2])
* 注册成功后通常直接跳登录；或注册后自动登录（看你产品）。

### 登录（必须注意 content-type）

文档示例是 `application/x-www-form-urlencoded` 且走 `/api/v1/login` ([benavlabs.github.io][1])
移动端要正确编码：

* body: `username=...&password=...`
* header: `Content-Type: application/x-www-form-urlencoded`

返回 `access_token` / `token_type` ([benavlabs.github.io][1])
refresh token：

* 方案A：你让后端在 JSON 里也返回
* 方案B：你不依赖后端 set-cookie，而是后端仍 set-cookie（RN未必持久化）；你可以考虑在登录响应里把 refresh token 也回传给移动端（这仍然属于“改后端一点点”，但收益巨大）。

### 获取当前用户

* `GET /user/me/`，Bearer access token ([benavlabs.github.io][2])

---

## 6) 安全与工程细节（移动端真实会踩的坑）

1. **不要把 token 放 AsyncStorage**（明文、易被备份/提取）。refresh 放 SecureStore；access 放内存。
2. **刷新并发控制**：这是“看起来能跑”和“线上稳定”的分水岭。
3. **API Host / 环境切换**：确保 dev/staging/prod 的 baseUrl 与 HTTPS 策略一致（后端 cookie 配置里 `secure=True` 是生产语义 ([benavlabs.github.io][1])）。
4. **登出语义**：后端文档提到 token blacklisting/登出流程（用于让 refresh/access 失效）([benavlabs.github.io][1])。前端登出必须：

   * 调 `/logout`（如果你启用 blacklist）
   * 清除本地 access/refresh
5. **错误分类**：401（未认证/过期）、403（无权限，别 refresh）、5xx（后端问题，别清 token）。

---

## 7) 我给你的“最佳建议”（基于这份后端文档的现实约束）

* 如果你能接受动一点后端：**选方案 A**。因为后端当前 refresh 端点是 cookie 取值模型 ([benavlabs.github.io][1])，移动端硬套 cookie 会让你未来在调试、跨端一致性、以及安全语义上付出额外成本。
* 如果你短期完全不想动后端：**方案 B 也能跑**，但请你把它当成“兼容层”，未来尽早切到 A。

---

如果你愿意，我可以在你选定 A 或 B 后，直接给你一套 **Expo + TypeScript** 的最小可用代码骨架（TokenStore/AuthService/apiClient/authStore/navigation guard），并把 `/login` 的 form-urlencoded、`/refresh`、`/user/me/` 的调用细节按文档对齐到位。

[1]: https://benavlabs.github.io/FastAPI-boilerplate/user-guide/authentication/jwt-tokens/ "JWT Tokens - FastAPI Boilerplate"
[2]: https://benavlabs.github.io/FastAPI-boilerplate/user-guide/authentication/user-management/ "User Management - FastAPI Boilerplate"

User: 使用后端为移动端提供“非 Cookie refresh”入口这种方式

Assiatant:

行，那就按 **方案 A：移动端非 Cookie refresh** 来定。核心目标：**refresh token 仅在移动端安全存储（SecureStore）**，刷新时通过 **请求体或专用 Authorization** 发送给后端；access token **只放内存**，由 API client 自动续期与重放请求。

下面给你一套“可落地的最佳实践设计”，包含：后端改动点（最小）、前端模块化架构、并发刷新、登出/踢下线语义、以及和 benavlabs 文档端点的对齐（login / refresh / user/me）。

---

## 1) 后端：最小改动方案（推荐形态）

benavlabs 文档的 refresh 端点默认从 `Cookie(refresh_token)` 取值（浏览器模型）。你要做的是**兼容移动端**：允许 refresh token 从 body/header 读取。

### 1.1 推荐：新增移动端 refresh 端点（最清晰）

* 保留原 `/refresh`（Web 用，Cookie 模式，符合文档）
* 新增 `/refresh/mobile`（移动端用，非 Cookie）

**请求：**

```json
POST /api/v1/refresh/mobile
{ "refresh_token": "<token>" }
```

**响应：**

```json
{ "access_token": "...", "token_type": "bearer", "refresh_token": "..."? }
```

> refresh 是否轮换（rotation）看你策略：
>
> * **旋转**：每次刷新下发新的 refresh token（更安全，能做重放检测）
> * **不旋转**：只下发新 access token（简单）

### 1.2 备选：复用同一个 `/refresh`，做“多通道读取”

如果你不想新增 path，可以让 `/refresh`：

* 先读 Cookie（Web）
* Cookie 没有则读 JSON body（Mobile）
* 或读 `Authorization: Bearer <refresh_token>`（Mobile）

我更建议独立 `/refresh/mobile`，避免策略混杂导致安全审计困难。

---

## 2) 后端：登录端点对移动端的建议

benavlabs 文档的 `/login` 返回 `access_token/token_type`，refresh token 是通过 cookie 设置（Web）。（文档流程就是这样。）

移动端需要 refresh token **显式返回**，所以建议：

### 2.1 新增 `/login/mobile`

* 输入仍然用 `application/x-www-form-urlencoded`（对齐现有 OAuth2PasswordRequestForm）
* 返回：

  * `access_token`
  * `refresh_token`
  * `token_type`

**为什么要分开？**
Web 登录的 refresh token 应该继续走 HttpOnly cookie；移动端不需要/不应该依赖 cookie。

---

## 3) 移动端前端：最佳实践状态与存储策略

### 3.1 Token 存储原则

* **access token：内存（runtime only）**

  * 防止落盘泄漏，减少攻击面
* **refresh token：SecureStore（持久化）**

  * Expo：`expo-secure-store`
* **用户信息：内存 + 可选缓存**

  * 启动时通过 `/user/me/` 拉取，作为 session 校验

### 3.2 全局 Auth 状态机（建议）

`booting → guest → authed`

* booting：App 启动，尝试用 refresh_token 换 access_token
* guest：无有效 token
* authed：有 access token 且 `/user/me/` 成功

---

## 4) API Client：自动加 Bearer + 401 自动 refresh + 并发去重

这是成败关键（线上稳定性的分水岭）。

### 4.1 请求流程

1. 发请求时取内存 access token，加 `Authorization: Bearer ...`
2. 若返回 401：

   * 触发一次 refresh（single-flight：同一时间只允许一个 refresh 在跑）
   * refresh 成功：更新内存 access token（+可选更新 refresh token）
   * 重放原请求
3. refresh 失败：

   * 清 SecureStore refresh token
   * auth 状态切 guest，导航到登录

### 4.2 并发去重（single-flight）

当 10 个请求同时 401，应该只 refresh 一次，其他请求 await 同一个 promise。

---

## 5) App 启动（Bootstrap）流程

1. 从 SecureStore 读取 refresh_token
2. 如果存在：

   * 调 `/refresh/mobile` 拿 access_token（可能也拿到新的 refresh_token）
   * 调 `/user/me/` 校验并填充 user
   * 成功：authed
3. 否则或失败：guest

---

## 6) Logout 与“踢下线”语义

### 6.1 前端 logout 必做

* 调后端 `/logout`（如果你启用了 refresh blacklist/失效机制）
* 清除：

  * 内存 access token
  * SecureStore refresh token
  * user state

### 6.2 服务器端建议

如果你做 refresh rotation + blacklist（或 jti 版本控制），就能：

* 设备丢失后服务端强制失效
* 防止 refresh token 被复制后无限使用

---

## 7) 端点契约总结（移动端专用）

建议你最终有这几个：

* `POST /api/v1/login/mobile`

  * form-urlencoded: username/password
  * returns: `{ access_token, refresh_token, token_type }`

* `POST /api/v1/refresh/mobile`

  * json: `{ refresh_token }`
  * returns: `{ access_token, token_type, refresh_token? }`（可选 rotation）

* `POST /api/v1/logout`（可选 mobile/logout）

  * json: `{ refresh_token }` 或 bearer refresh token
  * returns: 204/200

* `GET /api/v1/user/me/`

  * bearer access token
  * returns: user profile

---

## 8) 我接下来能直接给你的“可运行骨架”

你如果不反对，我会直接输出一套 **Expo + TypeScript** 的代码结构（不需要你再补问）：

* `src/auth/TokenStore.ts`（内存 access + SecureStore refresh）
* `src/auth/AuthService.ts`（loginMobile / refreshMobile / logout）
* `src/api/client.ts`（fetch 包装、401 重试、single-flight）
* `src/state/authStore.ts`（Zustand：bootstrapping、user、status）
* `src/navigation/index.tsx`（根据 status 切换栈）
* 以及每个请求的 header/body 细节

我不会用一堆“架构图废话”，而是给你可复制的实现。

你现在唯一需要在我生成代码前确定的“不可避免选择”只有一个（我直接给默认值也行）：

* **refresh token 是否 rotation（刷新时返回新的 refresh token）？**

  * 默认我建议：**rotation 开启**（安全更好），但实现略复杂一点点。

如果你不想多来回，我就按 **rotation 开启** 给你完整实现（前端会同时更新 SecureStore 的 refresh token）。


