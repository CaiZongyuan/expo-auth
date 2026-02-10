## 移动端鉴权（方案 A：非 Cookie refresh）

### 设计要点

- Web（浏览器）继续使用 cookie refresh：符合原有 `/login`（set-cookie）与 `/refresh`（读 cookie）流程。
- Mobile（App）使用 body refresh：refresh token 仅在移动端安全存储，刷新时通过请求体发送给后端。
- Refresh rotation：移动端刷新时返回新的 refresh token，并将旧 refresh token 拉黑，降低被复制复用的风险。

### 新增端点（移动端专用）

路由前缀：`/api/v1`

- `POST /login/mobile`
  - 请求：`application/x-www-form-urlencoded`（`username`/`password`）
  - 响应：`{ access_token, refresh_token, token_type }`

- `POST /refresh/mobile`
  - 请求：JSON `{"refresh_token": "..."}`
  - 响应：`{ access_token, refresh_token, token_type }`（**rotation 开启**）
  - 行为：旧 refresh token 写入 blacklist，后续不可再用

- `POST /logout/mobile`
  - 请求：JSON `{"refresh_token": "..."}`
  - 可选：`Authorization: Bearer <access_token>`（如果提供，会尽量把 access token 也加入 blacklist）

### 重要约束（移动端）

- 因为启用了 refresh rotation，客户端每次 refresh 成功后必须用响应里的新 `refresh_token` 覆盖旧值，否则下一次 refresh 会失败（旧 token 已被拉黑）。

---

## 验证建议（手动）

- 校验 compose：
  - `docker compose config`
- 启动：
  - `docker compose up --build`
- 走移动端链路（示例）：
  - `POST /api/v1/login/mobile`
  - `GET /api/v1/user/me/`（带 `Authorization: Bearer <access_token>`）
  - `POST /api/v1/refresh/mobile`（用 refresh_token 换新 access/refresh）
