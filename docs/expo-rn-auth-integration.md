# React Native (Expo) 对接后端鉴权文档（方案 A：移动端非 Cookie refresh）

本文档面向 React Native + Expo 开发者，用于把移动端的鉴权实现**准确映射**到本仓库后端接口。

## 约定与原则

- **access token**：只放内存（App 运行期），每次请求用 `Authorization: Bearer <access_token>`。
- **refresh token**：只持久化到移动端安全存储（如 Expo `SecureStore`），刷新时通过**请求体**发送给后端。
- 本后端对移动端 refresh 启用了 **refresh rotation**：每次 refresh 都会下发新的 refresh token，旧的 refresh token 会被拉黑，不能再次使用。

API 前缀：`/api/v1`

---

## 1) 端点一览（移动端用）

### 1.1 登录（移动端）

`POST /api/v1/login/mobile`

- Content-Type: `application/x-www-form-urlencoded`
- Body：
  - `username=<username or email>`
  - `password=<password>`
- Response（200）：
  ```json
  {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "bearer"
  }
  ```

> 说明：移动端登录不会设置 cookie；refresh token 由响应体显式返回。

### 1.2 刷新 access（移动端，rotation）

`POST /api/v1/refresh/mobile`

- Content-Type: `application/json`
- Body：
  ```json
  { "refresh_token": "..." }
  ```
- Response（200）：
  ```json
  {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "bearer"
  }
  ```

关键：调用成功后必须把本地保存的 refresh token 更新为响应中的新值；旧值会被后端拉黑，再用会 401。

### 1.3 登出（移动端）

`POST /api/v1/logout/mobile`

- Content-Type: `application/json`
- 可选 Header：
  - `Authorization: Bearer <access_token>`（如果提供，后端会尽量把 access token 也加入 blacklist）
- Body：
  ```json
  { "refresh_token": "..." }
  ```
- Response（200）：
  ```json
  { "message": "Logged out successfully" }
  ```

### 1.4 获取当前用户（用于会话校验/启动后拉取）

`GET /api/v1/user/me/`

- Header：
  - `Authorization: Bearer <access_token>`
- Response（200）：用户对象（字段以后端 `UserRead` 为准）

---

## 2) 推荐客户端流程（无代码版）

### 2.1 App 启动（Bootstrap）

1. 从 SecureStore 读取 `refresh_token`
2. 如果存在：
   - 调 `POST /api/v1/refresh/mobile` → 得到新的 `access_token` + 新的 `refresh_token`（覆盖旧值）
   - 调 `GET /api/v1/user/me/` 校验并加载用户信息
3. 如果不存在或 refresh 失败：
   - 进入未登录态（清空 SecureStore 的 refresh token）

### 2.2 普通请求（自动带 Bearer）

- 每次 API 请求都带 `Authorization: Bearer <access_token>`
- access token 过期/无效通常会返回 401

### 2.3 401 自动刷新与重放（并发去重）

当任一请求返回 401：

1. 触发一次 refresh（同一时刻只允许 **一个** refresh 在进行；其余请求等待该 refresh 完成）
2. refresh 成功：
   - 更新内存 access token
   - 更新 SecureStore refresh token（rotation）
   - 重放刚才失败的请求
3. refresh 失败：
   - 清空内存 access token + SecureStore refresh token
   - 进入未登录态（跳转登录）

---

## 3) 常见坑与排查

- **refresh rotation 没更新本地 refresh token**：下一次 refresh 会直接 401（因为旧 token 已被拉黑）。
- **同时多请求 401**：必须做 “single-flight” 去重，否则会出现多个 refresh 并发导致 token 互相覆盖/失效。
- **不要把 refresh token 放在 access token 的 Authorization 里**：本项目移动端 refresh 约定走 JSON body，避免混淆与日志泄露风险。

---

## 4) 与 Web（Cookie 模式）的区别（避免用错）

后端还保留了 Web(cookie) 流程：

- `POST /api/v1/login`：会 `set-cookie(refresh_token=...)`
- `POST /api/v1/refresh`：从 cookie 读取 refresh token
- `POST /api/v1/logout`：从 cookie 读取 refresh token

移动端请使用带 `/mobile` 的端点。

