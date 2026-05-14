# 06-Remote Sync — 本地开发 + 云端远程控制 设计文档

> **版本**: v1.0
> **日期**: 2026-05-14
> **状态**: 设计完成，待实施

---

## 1. 需求背景

### 1.1 用户场景

开发者在办公室本地电脑上运行 Claude-DevSprite 进行日常开发。当出差或在家时，希望通过任意设备的浏览器登录同一账号，看到与本地完全一致的系统状态，并能远程控制本地系统执行任务。

### 1.2 核心需求

| 维度 | 需求 |
|------|------|
| 同步范围 | 全量 — 本地能看到的一切都要同步到云端 |
| 多设备策略 | 单浏览器控制（同一时间只有一个浏览器能发命令） |
| 离线行为 | 浏览器离线只读（历史数据保留，无法执行命令） |
| 执行者 | 100% 本地机器（服务器纯中继，不执行代码） |
| 用户模型 | 一人一账号一本地机器 |
| 使用场景 | 小团队（3-10人），每人独立 |

### 1.3 非需求（明确排除）

- 不支持多台本地机器同时绑定一个账号
- 服务器不执行任何代码
- 不需要复杂的多设备冲突处理
- 不需要对外公开服务级别的安全机制

---

## 2. 架构设计

### 2.1 系统架构图

```
┌─────────────────────────┐         WebSocket          ┌──────────────────┐
│  本地机器 (办公室)        │  ═══════════════════════>  │  云服务器 (中继)   │
│                         │  <═══════════════════════  │                  │
│  ┌───────────────────┐  │         WebSocket          │  ┌────────────┐  │
│  │ Claude-DevSprite  │  │                            │  │ 状态缓存    │  │
│  │ ├── 数据库 (SQLite)│  │                            │  │ (内存+文件) │  │
│  │ ├── Claude CLI    │  │                            │  └────────────┘  │
│  │ ├── 项目代码      │  │                            │  ┌────────────┐  │
│  │ └── 所有服务      │  │                            │  │ WebSocket  │  │
│  └───────────────────┘  │                            │  │ 路由       │  │
│  ┌───────────────────┐  │                            │  └────────────┘  │
│  │ SyncClient       │  │                            │                  │
│  │ (状态推送+命令接收)│  │                            └──────────────────┘
│  └───────────────────┘  │                                      │
└─────────────────────────┘                                      │
                                                                 │ WebSocket
                                                                 │
                                                 ┌──────────────────┐
                                                 │  浏览器 (任意地方)  │
                                                 │                  │
                                                 │  ┌────────────┐  │
                                                 │  │ 只读显示    │  │
                                                 │  │ +远程控制   │  │
                                                 │  └────────────┘  │
                                                 └──────────────────┘
```

### 2.2 数据流

#### 状态同步（本地 → 服务器 → 浏览器）

```
本地状态变更
  │
  ▼
SyncClient 捕获变更事件
  │
  ▼
通过 WebSocket 推送到服务器
  │
  ▼
SyncServer 接收并转发给已认证的浏览器
  │
  ▼
浏览器前端 Pinia store 更新 → Vue 响应式渲染
```

#### 命令中继（浏览器 → 服务器 → 本地）

```
用户在浏览器操作（发送消息/触发扫描等）
  │
  ▼
前端 WebSocket 发送命令
  │
  ▼
服务器验证 JWT → 转发给对应的本地 Agent
  │
  ▼
本地 SyncClient 接收命令 → 调用本地服务执行
  │
  ▼
执行结果通过状态同步回传
```

### 2.3 双模式设计

服务器支持两种运行模式，向后兼容：

| 模式 | 配置 | 行为 | 适用场景 |
|------|------|------|----------|
| **本地模式**（默认） | `sync.enabled: false` | 服务器自己执行代码，无需认证 | 现有用户，单机使用 |
| **中继模式** | `sync.enabled: true` | 服务器只中继消息，需要 JWT 认证 | 团队远程协作 |

---

## 3. 协议设计

### 3.1 WebSocket 连接

| 路径 | 用途 | 认证方式 |
|------|------|----------|
| `/ws` | 浏览器连接 | JWT token（在 auth 消息中携带） |
| `/ws/agent` | 本地 Agent 连接 | 注册 token（一次性绑定） |

### 3.2 本地 Agent → 服务器 消息

| 消息类型 | 方向 | 字段 | 说明 |
|----------|------|------|------|
| `agent.register` | Agent→Server | `token, name, hostname, projectPaths[]` | 注册为某用户的本地 Agent |
| `agent.register.result` | Server→Agent | `success, agentId, error?` | 注册结果 |
| `agent.heartbeat` | Agent→Server | `agentId` | 保活（30s 间隔） |
| `sync.full` | Agent→Server | `agentId, data` | 全量状态快照（首次连接/重连时） |
| `sync.state` | Agent→Server | `agentId, type, data` | 增量状态变更 |
| `chat.stream` | Agent→Server | `agentId, sessionId, content, team` | 聊天流式输出 |
| `chat.message` | Agent→Server | `agentId, sessionId, message` | 聊天持久化消息 |
| `chat.done` | Agent→Server | `agentId, sessionId` | 聊天完成 |
| `agent.status` | Agent→Server | `agentId, status, currentTask?` | 执行状态（idle/busy/error） |

#### `sync.state.type` 枚举

| type | data 结构 | 说明 |
|------|-----------|------|
| `projects` | `Project[]` | 项目列表变更 |
| `tasks` | `{ projectName, tasks }` | 任务列表变更 |
| `reviews` | `{ projectName, reviews }` | 审查队列变更 |
| `chat.messages` | `{ sessionId, messages }` | 新增聊天消息 |
| `scanner.status` | `{ enabled, isScanning, ... }` | 扫描器状态 |
| `fixer.status` | `{ enabled, isFixing, currentReviewId, ... }` | 修复器状态 |
| `config` | `{ key, value }` | 配置变更 |
| `documents` | `{ projectName, documents }` | 知识库文档变更 |

### 3.3 服务器 → 浏览器 消息

| 消息类型 | 字段 | 说明 |
|----------|------|------|
| `auth.result` | `success, token?, error?` | JWT 登录结果 |
| `sync.full` | `data` | 全量状态快照 |
| `sync.state` | `type, data` | 状态更新 |
| `agent.online` | `agentName, hostname` | 本地 Agent 上线 |
| `agent.offline` | | 本地 Agent 离线 |
| `chat.stream` | `sessionId, content, team` | 聊天流式输出 |
| `chat.message` | `sessionId, message` | 聊天消息 |
| `chat.done` | `sessionId` | 聊天完成 |
| `session.list` | `sessions[]` | 会话列表 |
| `error` | `code, message` | 错误 |

### 3.4 浏览器 → 服务器 → 本地 命令

| 消息类型 | 字段 | 说明 |
|----------|------|------|
| `chat.send` | `sessionId, content` | 发送聊天消息 |
| `session.create` | `title?` | 创建新会话 |
| `session.activate` | `sessionId` | 切换会话 |
| `scan.trigger` | `projectName` | 触发扫描 |
| `fix.trigger` | | 触发修复 |
| `config.update` | `config` | 更新配置 |
| `task.create` | `projectName, task` | 创建任务 |
| `task.update` | `projectName, taskId, updates` | 更新任务 |
| `task.delete` | `projectName, taskId` | 删除任务 |
| `review.approve` | `projectName, reviewId` | 批准审查 |
| `review.ignore` | `projectName, reviewId` | 忽略审查 |

---

## 4. 认证设计

### 4.1 用户认证（浏览器）

```
浏览器                              服务器
  │                                   │
  │  POST /api/auth/login             │
  │  { username, password }           │
  │ ─────────────────────────────────>│
  │                                   │ 验证密码（crypto.scrypt）
  │  { token: "jwt...", user }        │
  │ <─────────────────────────────────│
  │                                   │
  │  WS: { type: "auth", token }     │
  │ ─────────────────────────────────>│
  │                                   │ 验证 JWT
  │  { type: "auth.result", ok: true }│
  │ <─────────────────────────────────│
```

- JWT 使用 Node.js 内置 `crypto` 签发（HMAC-SHA256），无需新依赖
- Token 有效期 24 小时
- 密码使用 `crypto.scrypt` 哈希（内存硬化，抗暴力破解）

### 4.2 Agent 注册（本地机器）

```
本地机器                             服务器
  │                                   │
  │  WS: { type: "agent.register",   │
  │        token: "agent-token-xxx",  │
  │        name: "办公电脑",           │
  │        hostname: "DESKTOP-ABC" }  │
  │ ─────────────────────────────────>│
  │                                   │ 验证 token → 绑定到 user_id
  │  { type: "agent.register.result",│
  │    success: true, agentId: "..." }│
  │ <─────────────────────────────────│
  │                                   │
  │  每 30s: { type: "agent.heartbeat"│
  │           agentId }               │
  │ ─────────────────────────────────>│
```

- Agent 注册 token 是一次性的，绑定到特定用户
- 同一用户只能有一个活跃 Agent 连接
- 新连接会替换旧连接（通知旧连接断开）

---

## 5. 数据库设计

### 5.1 服务器端新增表

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'user',  -- 'user' | 'admin'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent 连接节点
CREATE TABLE IF NOT EXISTS agent_nodes (
  id              TEXT PRIMARY KEY,        -- agent UUID
  user_id         INTEGER NOT NULL UNIQUE, -- 一个用户只能有一个 Agent
  name            TEXT NOT NULL,           -- 显示名称（如"办公电脑"）
  hostname        TEXT,                    -- 主机名
  status          TEXT DEFAULT 'offline',  -- 'online' | 'offline'
  project_paths   TEXT,                    -- JSON: 项目路径列表
  last_heartbeat  TEXT,
  connected_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Agent 注册 token
CREATE TABLE IF NOT EXISTS agent_tokens (
  token_hash  TEXT PRIMARY KEY,            -- token 的 SHA256 哈希
  user_id     INTEGER NOT NULL,
  used        INTEGER DEFAULT 0,           -- 0=未使用, 1=已绑定
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 5.2 本地数据库（无需修改）

本地机器使用现有的 SQLite 数据库，所有表结构不变。SyncClient 只是额外监听状态变化并推送。

---

## 6. 文件清单

### 6.1 新建文件

| 文件 | 行数估算 | 说明 |
|------|----------|------|
| `src/sync/syncProtocol.ts` | ~100 | 消息类型定义 |
| `src/sync/syncClient.ts` | ~300 | 本地同步客户端 |
| `src/sync/syncServer.ts` | ~250 | 服务器端同步处理 |
| `src/relay/auth.ts` | ~120 | JWT + 密码哈希 |
| `src/relay/relayManager.ts` | ~200 | Agent 连接管理 |
| `src/worker/routes/auth.ts` | ~100 | REST 认证端点 |
| `src/agent/agentClient.ts` | ~250 | Agent WS 客户端 |
| `src/agent/index.ts` | ~80 | Agent CLI 入口 |
| `web/src/views/LoginView.vue` | ~120 | 登录页面 |
| `web/src/stores/auth.ts` | ~60 | Pinia 认证 store |
| `web/src/components/relay/AgentStatusPanel.vue` | ~100 | 连接状态面板 |
| `docs/designs/06-remote-sync-design.md` | ~400 | 本文档 |

### 6.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/config.ts` | 添加 `SyncConfig` 接口 |
| `src/worker/db.ts` | 添加 users/agent_nodes/agent_tokens 表 + CRUD |
| `src/worker/server.ts` | 初始化 SyncServer、注册 auth 路由、添加 /ws/agent |
| `src/worker/wsServer.ts` | 添加 Agent 连接管理 |
| `src/worker/wsHandler.ts` | 中继模式命令转发 |
| `src/cli.ts` | 添加 `agent` 子命令 |
| `src/worker/middleware/cors.ts` | 中继模式收紧 CORS |
| `web/src/api/client.ts` | HTTP 请求带 JWT |
| `web/src/api/websocket.ts` | WS auth 带 JWT |
| `web/src/stores/chat.ts` | 处理同步状态事件 |
| `web/src/stores/dashboard.ts` | 处理同步状态事件 |
| `web/src/router/index.ts` | /login 路由 + auth guard |
| `package.json` | 添加 agent bin 入口 |

---

## 7. 实施计划

### Phase 1: 认证基础（预计 2-3 小时）

**目标**：用户可以通过浏览器登录/注册

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1.1 | `src/worker/db.ts` | 添加 users + agent_tokens 表 |
| 1.2 | `src/relay/auth.ts` | JWT 签发/验证 + 密码哈希 |
| 1.3 | `src/worker/routes/auth.ts` | POST /api/auth/login, /register, GET /me |
| 1.4 | `src/config.ts` | 添加 SyncConfig |
| 1.5 | `src/worker/server.ts` | 注册 auth 路由 |
| 1.6 | `web/src/stores/auth.ts` | Pinia 认证 store |
| 1.7 | `web/src/views/LoginView.vue` | 登录页面 |
| 1.8 | `web/src/router/index.ts` | /login 路由 + auth guard |

**验证**：POST /api/auth/register → POST /api/auth/login → 获取 JWT → 浏览器登录页面正常工作

### Phase 2: Agent 连接 + 命令中继（预计 3-4 小时）

**目标**：本地 Agent 能连接服务器，浏览器命令能中继到本地执行

| 步骤 | 文件 | 说明 |
|------|------|------|
| 2.1 | `src/sync/syncProtocol.ts` | 消息类型定义 |
| 2.2 | `src/worker/wsServer.ts` | 添加 /ws/agent 端点 |
| 2.3 | `src/relay/relayManager.ts` | Agent 连接管理、心跳 |
| 2.4 | `src/worker/wsHandler.ts` | 中继模式：chat.send 转发到 Agent |
| 2.5 | `src/agent/agentClient.ts` | Agent WS 客户端 |
| 2.6 | `src/agent/index.ts` | Agent CLI 入口 |
| 2.7 | `src/cli.ts` | 添加 `agent` 命令 |
| 2.8 | `web/src/api/client.ts` | HTTP 带 JWT |
| 2.9 | `web/src/api/websocket.ts` | WS 带 JWT |
| 2.10 | `web/src/components/relay/AgentStatusPanel.vue` | 连接状态面板 |

**验证**：本地 `claude-dev-sprite agent --server <url> --token <token>` → 浏览器发送聊天 → 本地执行 → 结果回传

### Phase 3: 状态同步（预计 3-4 小时）

**目标**：本地状态全量同步到服务器，浏览器看到完整数据

| 步骤 | 文件 | 说明 |
|------|------|------|
| 3.1 | `src/sync/syncClient.ts` | 本地状态监听 + 推送 |
| 3.2 | `src/sync/syncServer.ts` | 服务器接收 + 转发 |
| 3.3 | `web/src/stores/chat.ts` | 适配同步数据源 |
| 3.4 | `web/src/stores/dashboard.ts` | 适配同步数据源 |

**验证**：本地创建任务 → 浏览器自动显示；本地扫描 → 浏览器状态更新

### Phase 4: 安全 & 离线（预计 1-2 小时）

**目标**：完善安全机制和离线体验

| 步骤 | 文件 | 说明 |
|------|------|------|
| 4.1 | `src/worker/middleware/cors.ts` | 中继模式收紧 CORS |
| 4.2 | 离线缓存 | 服务器缓存最后状态 |
| 4.3 | 断线重连 | Agent 和浏览器自动重连 |

---

## 8. 安全设计

| 机制 | 实现 |
|------|------|
| 用户密码 | `crypto.scrypt` 哈希（内存硬化） |
| JWT Token | `crypto.createHmac('sha256', secret)` 签发，24h 过期 |
| Agent 注册 | 一次性 token，SHA256 哈希存储，绑定 user_id |
| CORS | 中继模式下限制为实际 origin（不再 *） |
| HTTPS | 通过反向代理（nginx/caddy）实现，应用层不处理 TLS |
| 数据隔离 | 通过 user_id 严格隔离，Agent 只能访问自己的数据 |

---

## 9. 向后兼容

| 方面 | 兼容策略 |
|------|----------|
| 默认配置 | `sync.enabled: false`，现有用法完全不变 |
| 认证 | 本地模式下 WebSocket 仍接受所有连接 |
| 数据库 | 新表用 `CREATE TABLE IF NOT EXISTS`，无迁移 |
| CLI | 现有命令不变，`agent` 是增量添加 |
| 前端 | 登录页面仅在 sync 模式下显示 |
| API | 现有 API 端点不变，新增 auth 端点 |

---

## 10. 测试策略

### 10.1 单元测试

- `src/relay/auth.test.ts`：JWT 生成/验证、密码哈希
- `src/relay/relayManager.test.ts`：Agent 注册、心跳、命令转发
- `src/sync/syncClient.test.ts`：状态监听、消息构建
- `src/agent/agentClient.test.ts`：连接、重连、命令处理

### 10.2 集成测试

- 认证流程：注册 → 登录 → JWT → WS 认证
- Agent 注册：连接 → 注册 → 心跳 → 状态更新
- 命令中继：浏览器 chat → Agent 执行 → 结果回传
- 状态同步：本地变更 → 推送 → 浏览器更新
- 断线重连：Agent 断开 → 重连 → 全量同步

### 10.3 手动 E2E 测试

1. 服务器启用 sync 模式
2. 注册用户 + 生成 Agent token
3. 本地启动 Agent
4. 浏览器登录 → 看到本地状态
5. 发送命令 → 本地执行 → 结果回传
6. 关闭本地 → 浏览器显示离线
7. 重启本地 → 自动重连 + 同步

---

## 11. 部署指南

### 11.1 服务器部署

```bash
# 1. 安装 Node.js + npm
# 2. 安装 Claude-DevSprite
npm install -g claude-dev-sprite

# 3. 配置 sync 模式
mkdir -p ~/.claude-dev-sprite
cat > ~/.claude-dev-sprite/config.json << 'EOF'
{
  "sync": {
    "enabled": true
  }
}
EOF

# 4. 启动服务
claude-dev-sprite start --port 38888

# 5. 配置反向代理（nginx/caddy）+ HTTPS
```

### 11.2 本地 Agent 启动

```bash
# 1. 安装 Claude-DevSprite
npm install -g claude-dev-sprite

# 2. 启动 Agent（首次需要注册 token）
claude-dev-sprite agent \
  --server https://your-server.com \
  --token "your-agent-token" \
  --project-path /path/to/your/project

# 3. 后续启动（已注册，自动重连）
claude-dev-sprite agent \
  --server https://your-server.com \
  --project-path /path/to/your/project
```

### 11.3 浏览器访问

1. 打开 `https://your-server.com`
2. 登录账号
3. 看到本地系统状态同步
4. 发送命令控制本地系统
